# LOCZ

Static four-page website for LOCZ, a detergent-liquid brand based in Qatar.

## Pages

- `index.html` — Home and about
- `products.html` — Current Carpet Cleaning product
- `upcoming.html` — Detergent Liquid and Laundry Care, marked coming soon
- `contact.html` — Contact information and enquiry form

Carpet Cleaning orders start in WhatsApp. LOCZ confirms the total, payment, and delivery details with the customer in chat; the site does not collect payment online.

The site uses plain HTML, CSS, and JavaScript. It has no package manager or production build step. All site and image paths are relative so the site works at the repository's GitHub Pages project URL.

## GitHub Pages

The workflow in `.github/workflows/pages.yml` publishes the repository root on pushes to `main`. In the repository's **Settings → Pages**, select **GitHub Actions** as the deployment source if GitHub Pages has not already been enabled.
