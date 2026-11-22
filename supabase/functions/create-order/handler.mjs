import { buildOrderEmail, sha256, validateOrder } from '../_shared/order.mjs';

const respond = (body, status, origin, allowedOrigin) => {
  const headers = new Headers({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  if (origin && origin === allowedOrigin) {
    headers.set('access-control-allow-origin', origin);
    headers.set('vary', 'Origin');
  }
  return new Response(JSON.stringify(body), { status, headers });
};

const envValue = (env, key) => typeof env[key] === 'string' ? env[key].trim() : '';

async function rpc(env, name, body) {
  const baseUrl = envValue(env, 'SUPABASE_URL').replace(/\/+$/, '');
  const serviceKey = envValue(env, 'SUPABASE_SERVICE_ROLE_KEY');
  if (!baseUrl || !serviceKey) throw new Error('Order database is not configured.');
  const response = await fetch(`${baseUrl}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data || typeof data !== 'object') throw new Error('Order database could not process the request.');
  return data;
}

async function emailIdempotencyKey(orderId) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`locz-order-email:${orderId}`))).slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function sendOwnerEmail(env, orderId, payload, createdAt) {
  const apiKey = envValue(env, 'BREVO_API_KEY');
  const from = envValue(env, 'LOCZ_FROM_EMAIL');
  const fromName = envValue(env, 'LOCZ_FROM_NAME') || 'LOCZ Orders';
  const to = envValue(env, 'LOCZ_NOTIFICATION_EMAIL') || 'loczqatar@gmail.com';
  if (!apiKey || !from) throw new Error('Email sender is not configured.');
  const email = buildOrderEmail({ ...payload, orderId, createdAt });
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      sender: { name: fromName, email: from },
      to: [{ email: to }],
      subject: `NEW LOCZ CUSTOMER ORDER — ${orderId}`,
      htmlContent: email.html,
      textContent: email.text,
      headers: { idempotencyKey: await emailIdempotencyKey(orderId) }
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.messageId) throw new Error('Email provider did not accept the order notification.');
  return data.messageId;
}

export async function handleOrderRequest(request, env) {
  const origins = new Set(envValue(env, 'ALLOWED_ORIGINS').split(',').map(value => value.trim()).filter(Boolean));
  const origin = request.headers.get('origin') || '';
  const allowedOrigin = origins.has(origin) ? origin : '';
  if (origin && !allowedOrigin) return respond({ success: false, message: 'This website is not allowed to submit orders.' }, 403, '', '');
  if (request.method === 'OPTIONS') {
    if (!allowedOrigin) return new Response(null, { status: 204 });
    return new Response(null, { status: 204, headers: {
      'access-control-allow-origin': allowedOrigin,
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'apikey, authorization, x-client-info, content-type, idempotency-key',
      'access-control-max-age': '86400', vary: 'Origin'
    } });
  }
  if (request.method !== 'POST') return respond({ success: false, message: 'Method not allowed.' }, 405, origin, allowedOrigin);
  if (!(request.headers.get('content-type') || '').toLowerCase().includes('application/json')) {
    return respond({ success: false, message: 'Submit order details as JSON.' }, 415, origin, allowedOrigin);
  }
  if (Number(request.headers.get('content-length') || 0) > 16000) return respond({ success: false, message: 'Order details are too large.' }, 413, origin, allowedOrigin);

  const idempotencyKey = request.headers.get('idempotency-key') || '';
  if (!/^[A-Za-z0-9_-]{16,100}$/.test(idempotencyKey)) return respond({ success: false, message: 'Refresh checkout and try again.' }, 400, origin, allowedOrigin);
  const raw = await request.text();
  if (raw.length > 16000) return respond({ success: false, message: 'Order details are too large.' }, 413, origin, allowedOrigin);
  let input;
  try { input = JSON.parse(raw); }
  catch { return respond({ success: false, message: 'Enter valid order details.' }, 400, origin, allowedOrigin); }
  const validated = validateOrder(input);
  if (validated.error) return respond({ success: false, message: validated.error }, 400, origin, allowedOrigin);
  const payload = validated.order;
  const payloadHash = await sha256(JSON.stringify(payload));
  const now = new Date();
  const orderId = `LOCZ-${now.toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '';
  const ipHash = ip ? await sha256(ip) : null;

  let claim;
  try {
    claim = await rpc(env, 'locz_claim_order', {
      p_order_id: orderId,
      p_idempotency_key: idempotencyKey,
      p_payload_hash: payloadHash,
      p_payload: payload,
      p_ip_hash: ipHash
    });
  } catch {
    return respond({ success: false, message: 'The order service is temporarily unavailable. Please retry.' }, 503, origin, allowedOrigin);
  }
  if (claim.state === 'conflict') return respond({ success: false, message: 'This checkout reference is already linked to different details. Refresh checkout to continue.' }, 409, origin, allowedOrigin);
  if (claim.state === 'rate_limited') return respond({ success: false, orderId: claim.order_id, message: 'Too many order attempts. Wait a while or contact LOCZ.' }, 429, origin, allowedOrigin);
  if (claim.state === 'processing') return respond({ success: false, orderId: claim.order_id, retryable: true, message: 'Your order is still being processed. Wait a moment, then retry.' }, 409, origin, allowedOrigin);
  if (claim.state === 'sent') return respond({ success: true, orderId: claim.order_id, duplicate: true }, 200, origin, allowedOrigin);
  if (claim.state !== 'claimed' || !claim.order_id || !claim.payload) return respond({ success: false, message: 'The order could not be prepared. Please retry.' }, 503, origin, allowedOrigin);

  let emailId;
  try {
    emailId = await sendOwnerEmail(env, claim.order_id, claim.payload, claim.created_at);
  } catch {
    try { await rpc(env, 'locz_finish_order', { p_order_id: claim.order_id, p_success: false, p_email_id: null }); } catch { /* A retry can recover a stale sending claim. */ }
    return respond({ success: false, orderId: claim.order_id, retryable: true, message: 'We could not send the order email. Your order is saved; please retry.' }, 502, origin, allowedOrigin);
  }

  try {
    const finished = await rpc(env, 'locz_finish_order', { p_order_id: claim.order_id, p_success: true, p_email_id: emailId });
    if (finished.state !== 'sent') throw new Error('Order state was not finalized.');
  } catch {
    return respond({ success: false, orderId: claim.order_id, retryable: true, message: 'The email was accepted, but order confirmation could not be saved. Retry safely using the same checkout.' }, 503, origin, allowedOrigin);
  }
  return respond({ success: true, orderId: claim.order_id }, 200, origin, allowedOrigin);
}
