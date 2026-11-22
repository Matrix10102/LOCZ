import test from 'node:test';
import assert from 'node:assert/strict';
import { handleOrderRequest } from './handler.mjs';

const payload = () => ({
  customer: { name: 'Aisha LOCZ', phone: '+974 5555 1212', location: 'Doha', address: 'Building 10, Street 15', note: 'Call on arrival' },
  items: [{ id: 'carpet-cleaning', quantity: 2 }], website: ''
});

class SupabaseStub {
  orders = new Map();
  async fetch(url, options) {
    const body = JSON.parse(options.body);
    if (url.endsWith('/rpc/locz_claim_order')) {
      const order = this.orders.get(body.p_idempotency_key);
      if (!order) {
        this.orders.set(body.p_idempotency_key, { order_id: body.p_order_id, hash: body.p_payload_hash, payload: body.p_payload, state: 'sending', created_at: new Date().toISOString() });
        return Response.json({ state: 'claimed', order_id: body.p_order_id, payload: body.p_payload, created_at: new Date().toISOString() });
      }
      if (order.hash !== body.p_payload_hash) return Response.json({ state: 'conflict' });
      if (order.state === 'sent') return Response.json({ state: 'sent', order_id: order.order_id });
      if (order.state === 'sending') return Response.json({ state: 'processing', order_id: order.order_id });
      order.state = 'sending';
      return Response.json({ state: 'claimed', order_id: order.order_id, payload: order.payload, created_at: order.created_at });
    }
    if (url.endsWith('/rpc/locz_finish_order')) {
      const order = [...this.orders.values()].find(item => item.order_id === body.p_order_id);
      if (!order) return Response.json({ state: 'not_updated' });
      order.state = body.p_success ? 'sent' : 'failed';
      return Response.json({ state: order.state });
    }
    return Response.json({ message: 'unknown RPC' }, { status: 404 });
  }
}

const createEnv = () => ({
  SUPABASE_URL: 'https://locz-test.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-test-only',
  RESEND_API_KEY: 'resend-test-only',
  LOCZ_FROM_EMAIL: 'LOCZ Orders <orders@loczqatar.dpdns.org>',
  LOCZ_NOTIFICATION_EMAIL: 'loczqatar@gmail.com',
  ALLOWED_ORIGINS: 'https://matrix10102.github.io'
});

const createRequest = (data, key = 'locz-checkout-test-0001') => new Request('https://locz-test.supabase.co/functions/v1/create-order', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'idempotency-key': key, origin: 'https://matrix10102.github.io' },
  body: JSON.stringify(data)
});

test('valid order sends one branded owner email and returns a unique order reference', async () => {
  const originalFetch = globalThis.fetch;
  const supabase = new SupabaseStub();
  const emails = [];
  globalThis.fetch = async (url, options) => {
    if (String(url).includes('.supabase.co/rest/v1/')) return supabase.fetch(String(url), options);
    emails.push({ options, body: JSON.parse(options.body) });
    return Response.json({ id: 'resend_email_test_1' });
  };
  try {
    const response = await handleOrderRequest(createRequest(payload()), createEnv());
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.success, true);
    assert.match(data.orderId, /^LOCZ-\d{8}-[A-F0-9]{8}$/);
    assert.equal(emails.length, 1);
    assert.equal(emails[0].body.to[0], 'loczqatar@gmail.com');
    assert.match(emails[0].body.subject, new RegExp(data.orderId));
    assert.match(emails[0].body.html, /Cash on delivery/);
    assert.equal(emails[0].options.headers['Idempotency-Key'], `locz-order-${data.orderId}`);
  } finally { globalThis.fetch = originalFetch; }
});

test('duplicate submission returns the original reference without sending a second email', async () => {
  const originalFetch = globalThis.fetch;
  const supabase = new SupabaseStub();
  let sends = 0;
  globalThis.fetch = async (url, options) => {
    if (String(url).includes('.supabase.co/rest/v1/')) return supabase.fetch(String(url), options);
    sends += 1;
    return Response.json({ id: 'resend_email_test_2' });
  };
  try {
    const first = await handleOrderRequest(createRequest(payload()), createEnv());
    const firstBody = await first.json();
    const second = await handleOrderRequest(createRequest(payload()), createEnv());
    const secondBody = await second.json();
    assert.equal(firstBody.orderId, secondBody.orderId);
    assert.equal(secondBody.duplicate, true);
    assert.equal(sends, 1);
  } finally { globalThis.fetch = originalFetch; }
});

test('invalid details and unavailable products are rejected before any email call', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return Response.json({ id: 'unexpected' }); };
  try {
    const badPhone = payload(); badPhone.customer.phone = 'x';
    const response = await handleOrderRequest(createRequest(badPhone), createEnv());
    assert.equal(response.status, 400);
    const upcoming = payload(); upcoming.items[0].id = 'laundry-care';
    const unavailable = await handleOrderRequest(createRequest(upcoming, 'locz-checkout-test-0002'), createEnv());
    assert.equal(unavailable.status, 400);
    assert.equal(calls, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test('email delivery failure is retryable and Resend receives the same idempotency key', async () => {
  const originalFetch = globalThis.fetch;
  const supabase = new SupabaseStub();
  let count = 0;
  const emailKeys = [];
  globalThis.fetch = async (url, options) => {
    if (String(url).includes('.supabase.co/rest/v1/')) return supabase.fetch(String(url), options);
    count += 1;
    emailKeys.push(options.headers['Idempotency-Key']);
    return count === 1 ? Response.json({ message: 'temporary error' }, { status: 503 }) : Response.json({ id: 'resend_email_retry' });
  };
  try {
    const failed = await handleOrderRequest(createRequest(payload()), createEnv());
    const failedBody = await failed.json();
    assert.equal(failed.status, 502);
    assert.equal(failedBody.retryable, true);
    const retried = await handleOrderRequest(createRequest(payload()), createEnv());
    const retriedBody = await retried.json();
    assert.equal(retried.status, 200);
    assert.equal(retriedBody.orderId, failedBody.orderId);
    assert.deepEqual(emailKeys, [`locz-order-${failedBody.orderId}`, `locz-order-${failedBody.orderId}`]);
  } finally { globalThis.fetch = originalFetch; }
});

test('same idempotency key cannot change order contents and foreign origins are rejected', async () => {
  const originalFetch = globalThis.fetch;
  const supabase = new SupabaseStub();
  let emails = 0;
  globalThis.fetch = async (url, options) => {
    if (String(url).includes('.supabase.co/rest/v1/')) return supabase.fetch(String(url), options);
    emails += 1;
    return Response.json({ id: 'resend_email_test_3' });
  };
  try {
    await handleOrderRequest(createRequest(payload()), createEnv());
    const changed = payload(); changed.items[0].quantity = 3;
    const conflict = await handleOrderRequest(createRequest(changed), createEnv());
    assert.equal(conflict.status, 409);
    const outsider = new Request('https://locz-test.supabase.co/functions/v1/create-order', {
      method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': 'locz-checkout-test-0003', origin: 'https://attacker.invalid' }, body: JSON.stringify(payload())
    });
    const forbidden = await handleOrderRequest(outsider, createEnv());
    assert.equal(forbidden.status, 403);
    assert.equal(emails, 1);
  } finally { globalThis.fetch = originalFetch; }
});
