const PRODUCT_CATALOG = Object.freeze({ 'carpet-cleaning': 'Carpet Cleaning' });

export function validateOrder(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'Enter valid order details.' };
  const clean = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
  if (clean(input.website, 200)) return { error: 'Order could not be accepted.' };
  const customer = {
    name: clean(input.customer?.name, 100),
    phone: clean(input.customer?.phone, 32),
    location: clean(input.customer?.location, 120),
    address: clean(input.customer?.address, 400),
    note: clean(input.customer?.note, 1000)
  };
  if (customer.name.length < 2) return { error: 'Enter your full name.' };
  const digits = customer.phone.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15 || !/^[+()\d\s.-]+$/.test(customer.phone)) return { error: 'Enter a valid phone number.' };
  if (!customer.location) return { error: 'Enter your delivery location.' };
  if (customer.address.length < 5) return { error: 'Enter your delivery address.' };
  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 10) return { error: 'Your cart is empty or invalid.' };
  const items = [];
  for (const item of input.items) {
    if (!item || typeof item !== 'object' || !PRODUCT_CATALOG[item.id]) return { error: 'One or more products are not currently available.' };
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) return { error: 'Enter a valid product quantity.' };
    items.push({ id: item.id, name: PRODUCT_CATALOG[item.id], quantity: item.quantity });
  }
  return { order: { customer, items, paymentMethod: 'Cash on delivery' } };
}

const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);

export function buildOrderEmail(order) {
  const date = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Qatar', dateStyle: 'long', timeStyle: 'short'
  }).format(new Date(order.createdAt));
  const rows = order.items.map(item => `<tr><td style="padding:12px;border-bottom:1px solid #e8edf2">${escapeHtml(item.name)}</td><td style="padding:12px;text-align:center;border-bottom:1px solid #e8edf2">${item.quantity}</td></tr>`).join('');
  const note = order.customer.note
    ? `<p style="margin:8px 0 0;white-space:pre-wrap">${escapeHtml(order.customer.note)}</p>`
    : '<p style="margin:8px 0 0;color:#65758b">No additional notes.</p>';
  const html = `<!doctype html><html><body style="margin:0;background:#f2f6fa;font-family:Arial,Helvetica,sans-serif;color:#172638"><div style="max-width:680px;margin:24px auto;padding:0 12px"><div style="background:#071421;padding:24px 28px;border-bottom:4px solid #179fe7"><div style="font-size:26px;font-weight:800;letter-spacing:3px;color:#fff">LOCZ</div><div style="margin-top:5px;color:#b8dff3;font-size:13px">New customer order · Cash on delivery</div></div><div style="background:#fff;padding:26px 28px"><h1 style="margin:0 0 6px;font-size:23px">New order ${escapeHtml(order.orderId)}</h1><p style="margin:0 0 22px;color:#64758b">${escapeHtml(date)} · Qatar</p><h2 style="font-size:16px;margin:24px 0 8px">Order items</h2><table role="presentation" style="width:100%;border-collapse:collapse"><thead><tr><th align="left" style="padding:10px 12px;background:#edf5fa">Product</th><th style="padding:10px 12px;background:#edf5fa">Quantity</th></tr></thead><tbody>${rows}</tbody></table><p style="margin:12px 0;color:#53677b">Product price and delivery charges: confirm with customer.</p><h2 style="font-size:16px;margin:24px 0 8px">Customer</h2><table role="presentation" style="width:100%;border-collapse:collapse"><tr><td style="padding:7px 0;color:#64758b;width:140px">Name</td><td style="padding:7px 0">${escapeHtml(order.customer.name)}</td></tr><tr><td style="padding:7px 0;color:#64758b">Phone</td><td style="padding:7px 0"><a style="color:#087dbb" href="tel:${escapeHtml(order.customer.phone)}">${escapeHtml(order.customer.phone)}</a></td></tr><tr><td style="padding:7px 0;color:#64758b">Location</td><td style="padding:7px 0">${escapeHtml(order.customer.location)}</td></tr><tr><td style="padding:7px 0;color:#64758b;vertical-align:top">Address</td><td style="padding:7px 0;white-space:pre-wrap">${escapeHtml(order.customer.address)}</td></tr><tr><td style="padding:7px 0;color:#64758b">Payment</td><td style="padding:7px 0">Cash on delivery</td></tr></table><h2 style="font-size:16px;margin:24px 0 8px">Additional notes</h2>${note}</div><div style="padding:16px 28px;color:#687b8f;font-size:12px">LOCZ · Doha, Qatar</div></div></body></html>`;
  const text = [
    `NEW LOCZ CUSTOMER ORDER — ${order.orderId}`,
    `Date: ${date} Qatar time`,
    'Payment: Cash on delivery',
    '', 'PRODUCTS',
    ...order.items.map(item => `${item.name} — quantity ${item.quantity}`),
    'Price and delivery: confirm with customer.',
    '', 'CUSTOMER',
    `Name: ${order.customer.name}`,
    `Phone: ${order.customer.phone}`,
    `Location: ${order.customer.location}`,
    `Address: ${order.customer.address}`,
    `Additional notes: ${order.customer.note || 'None'}`
  ].join('\n');
  return { html, text };
}

export const sha256 = async value => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
};
