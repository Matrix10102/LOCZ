CREATE TABLE IF NOT EXISTS public.locz_orders (
  order_id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  payload_hash TEXT NOT NULL,
  payload JSONB,
  email_status TEXT NOT NULL CHECK (email_status IN ('queued', 'sending', 'sent', 'failed')),
  email_id TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error TEXT
);

CREATE INDEX IF NOT EXISTS locz_orders_status_updated
  ON public.locz_orders(email_status, updated_at);

CREATE TABLE IF NOT EXISTS public.locz_order_rate_limits (
  ip_hash TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (ip_hash, window_start)
);

ALTER TABLE public.locz_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locz_order_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.locz_orders FROM anon, authenticated;
REVOKE ALL ON public.locz_order_rate_limits FROM anon, authenticated;
GRANT ALL ON public.locz_orders TO service_role;
GRANT ALL ON public.locz_order_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.locz_claim_order(
  p_order_id TEXT,
  p_idempotency_key TEXT,
  p_payload_hash TEXT,
  p_payload JSONB,
  p_ip_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order public.locz_orders%ROWTYPE;
  v_window_start TIMESTAMPTZ := date_trunc('hour', NOW());
  v_count INTEGER;
BEGIN
  INSERT INTO public.locz_orders
    (order_id, idempotency_key, payload_hash, payload, email_status, attempts)
  VALUES
    (p_order_id, p_idempotency_key, p_payload_hash, p_payload, 'queued', 0)
  ON CONFLICT (idempotency_key) DO NOTHING;

  SELECT * INTO v_order
  FROM public.locz_orders
  WHERE idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF v_order.payload_hash <> p_payload_hash THEN
    RETURN jsonb_build_object('state', 'conflict');
  END IF;
  IF v_order.email_status = 'sent' THEN
    RETURN jsonb_build_object('state', 'sent', 'order_id', v_order.order_id);
  END IF;
  IF v_order.email_status = 'sending' AND v_order.updated_at > NOW() - INTERVAL '90 seconds' THEN
    RETURN jsonb_build_object('state', 'processing', 'order_id', v_order.order_id);
  END IF;

  IF p_ip_hash IS NOT NULL THEN
    INSERT INTO public.locz_order_rate_limits (ip_hash, window_start, request_count)
    VALUES (p_ip_hash, v_window_start, 1)
    ON CONFLICT (ip_hash, window_start)
    DO UPDATE SET request_count = public.locz_order_rate_limits.request_count + 1
    RETURNING request_count INTO v_count;
    DELETE FROM public.locz_order_rate_limits
    WHERE window_start < NOW() - INTERVAL '48 hours';
    IF v_count > 10 THEN
      RETURN jsonb_build_object('state', 'rate_limited', 'order_id', v_order.order_id);
    END IF;
  END IF;

  UPDATE public.locz_orders
  SET email_status = 'sending', attempts = attempts + 1, updated_at = NOW()
  WHERE order_id = v_order.order_id;

  RETURN jsonb_build_object(
    'state', 'claimed',
    'order_id', v_order.order_id,
    'payload', v_order.payload,
    'created_at', v_order.created_at,
    'attempts', v_order.attempts + 1
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.locz_finish_order(
  p_order_id TEXT,
  p_success BOOLEAN,
  p_email_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.locz_orders
  SET email_status = CASE WHEN p_success THEN 'sent' ELSE 'failed' END,
      email_id = CASE WHEN p_success THEN p_email_id ELSE NULL END,
      payload = CASE WHEN p_success THEN NULL ELSE payload END,
      last_error = CASE WHEN p_success THEN NULL ELSE 'notification_failed' END,
      updated_at = NOW()
  WHERE order_id = p_order_id AND email_status = 'sending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('state', 'not_updated');
  END IF;
  RETURN jsonb_build_object('state', CASE WHEN p_success THEN 'sent' ELSE 'failed' END);
END;
$$;

REVOKE ALL ON FUNCTION public.locz_claim_order(TEXT, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.locz_finish_order(TEXT, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.locz_claim_order(TEXT, TEXT, TEXT, JSONB, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.locz_finish_order(TEXT, BOOLEAN, TEXT) TO service_role;
