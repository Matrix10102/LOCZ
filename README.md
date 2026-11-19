# LOCZ

Premium Qatar-based LOCZ website and WhatsApp-order storefront. The existing HTML/CSS/JavaScript site has been extended without replacing its branding, logo, or supplied product artwork.

## Pages

- `index.html` — Home, brand information, featured product, upcoming lines
- `products.html` — Searchable and filterable product catalogue
- `product.html?id=detergent-liquid` — Product details (also accepts `carpet-cleaning` and `laundry-care`)
- `cart.html` — Persistent cart and WhatsApp order preparation
- `upcoming.html` — Upcoming Carpet Cleaning and Laundry Care lines
- `contact.html` — LOCZ contact information and enquiry form

## Availability and ordering

Detergent Liquid is currently available. Carpet Cleaning and Laundry Care are marked coming soon and cannot be added to the cart. Prices, sizes, product specifications, delivery area, and delivery charges are not shown as facts because LOCZ has not supplied them.

The cart stores product IDs and quantities in the visitor's browser. Checkout collects name, phone, and delivery details in the page and places them into a prefilled WhatsApp message to LOCZ at +974 7059 5504 only when the customer chooses Continue to WhatsApp. The customer reviews and sends that message. Opening WhatsApp does not confirm an order; LOCZ confirms availability, price, payment, and delivery in chat. No online payment is collected.

## Development and deployment

The site is static HTML, CSS, and JavaScript with no package manager or production build step. Run `node --check site.js` and `node --check shop.js` for JavaScript syntax validation. GitHub Actions publishes the repository root to GitHub Pages on pushes to `main`.
