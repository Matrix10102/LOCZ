import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOrderEmail, validateOrder } from './order.mjs';

const valid = () => ({
  customer: { name: 'Aisha LOCZ', phone: '+974 5555 1212', location: 'Doha', address: 'Building 10, Street 15', note: 'Call on arrival' },
  items: [{ id: 'carpet-cleaning', quantity: 2 }],
  website: ''
});

test('accepts only server-listed, currently available Carpet Cleaning', () => {
  const result = validateOrder({ ...valid(), paymentMethod: 'credit-card' });
  assert.equal(result.error, undefined);
  assert.deepEqual(result.order.items, [{ id: 'carpet-cleaning', name: 'Carpet Cleaning', quantity: 2 }]);
  assert.equal(result.order.paymentMethod, 'Cash on delivery');
  assert.match(validateOrder({ ...valid(), items: [{ id: 'detergent-liquid', quantity: 1 }] }).error, /not currently available/);
});

test('rejects invalid customer details, quantities, and honeypot submissions', () => {
  assert.match(validateOrder({ ...valid(), customer: { ...valid().customer, phone: 'x' } }).error, /phone/);
  assert.match(validateOrder({ ...valid(), customer: { ...valid().customer, address: '' } }).error, /address/);
  assert.match(validateOrder({ ...valid(), items: [{ id: 'carpet-cleaning', quantity: 0 }] }).error, /quantity/);
  assert.match(validateOrder({ ...valid(), website: 'spam' }).error, /accepted/);
});

test('renders mobile-friendly branded HTML and escapes customer-controlled content', () => {
  const result = validateOrder(valid());
  const email = buildOrderEmail({ ...result.order, orderId: 'LOCZ-20261122-ABCD1234', createdAt: Date.now(), customer: { ...result.order.customer, name: '<script>alert(1)</script>' } });
  assert.match(email.html, /LOCZ-20261122-ABCD1234/);
  assert.match(email.html, /Cash on delivery/);
  assert.match(email.html, /&lt;script&gt;/);
  assert.doesNotMatch(email.html, /<script>/);
  assert.match(email.text, /Carpet Cleaning — quantity 2/);
});
