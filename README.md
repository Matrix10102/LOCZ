# LOCZ

Premium Qatar-based LOCZ website and WhatsApp-order storefront. The existing HTML/CSS/JavaScript site has been extended without replacing its branding, logo, or supplied product artwork.

## Pages

- `index.html` — Home, brand information, featured product, upcoming lines
- `products.html` — Searchable and filterable product catalogue
- `product.html?id=detergent-liquid` — Product details (also accepts `carpet-cleaning` and `laundry-care`)
- `cart.html` — Persistent cart and cash-on-delivery checkout
- `upcoming.html` — Upcoming Detergent Liquid and Laundry Care lines
- `contact.html` — LOCZ contact information and enquiry form

## Availability and ordering

Carpet Cleaning is currently available. Detergent Liquid and Laundry Care are marked coming soon and cannot be added to the cart. Prices, sizes, product specifications, delivery area, and delivery charges are not shown as facts because LOCZ has not supplied them.

The cart stores product IDs and quantities in the visitor's browser. Carpet Cleaning is the only orderable product; checkout presents only Cash on Delivery and collects name, phone, location, address, and optional notes. Checkout opens WhatsApp with the order details addressed to LOCZ. The customer must tap Send in WhatsApp for the order to reach LOCZ; the website cannot detect or confirm that message was sent. LOCZ confirms product availability, price, and delivery details in chat. The optional Supabase/Brevo email backend is documented in `supabase/README.md` and is not required for WhatsApp checkout.

The order backend and public Supabase project settings require account setup before online checkout is active. See [`supabase/README.md`](supabase/README.md). Do not claim real notifications are live until the deployed endpoint has sent a real test order email that is confirmed in the LOCZ inbox.

## Development and deployment

The website is static HTML, CSS, and JavaScript with no frontend build step. Run `node --check site.js`, `node --check shop.js`, and `node --test supabase/functions/_shared/order.test.mjs supabase/functions/create-order/handler.test.mjs` for local checks. GitHub Actions publishes the repository root to GitHub Pages on pushes to `main`.
