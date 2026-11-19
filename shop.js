(() => {
  'use strict';

  const cartKey = 'locz-cart-v1';
  const products = {
    'detergent-liquid': {
      id: 'detergent-liquid', name: 'Detergent Liquid', category: 'Laundry', status: 'available',
      image: 'assets/detergent-liquid.jpg', alt: 'LOCZ Detergent Liquid bottle with folded towels',
      description: 'LOCZ Detergent Liquid is currently available to order.',
      extra: 'Contact LOCZ to confirm available sizes and product information before ordering.'
    },
    'carpet-cleaning': {
      id: 'carpet-cleaning', name: 'Carpet Cleaning', category: 'Carpet', status: 'coming-soon',
      image: 'assets/carpet-cleaning.jpg', alt: 'LOCZ Carpet Cleaning promotional artwork',
      description: 'LOCZ Carpet Cleaning is an upcoming product.',
      extra: 'This product is not yet available for purchase.'
    },
    'laundry-care': {
      id: 'laundry-care', name: 'Laundry Care', category: 'Laundry', status: 'coming-soon',
      image: 'assets/laundry-care.jpg', alt: 'LOCZ Laundry Care bottle with folded towels',
      description: 'LOCZ Laundry Care is an upcoming product.',
      extra: 'This product is not yet available for purchase.'
    }
  };

  const readCart = () => {
    try {
      const raw = JSON.parse(localStorage.getItem(cartKey) || '{}');
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
      return Object.fromEntries(Object.entries(raw).filter(([id, quantity]) =>
        products[id]?.status === 'available' && Number.isSafeInteger(quantity) && quantity > 0
      ));
    } catch { return {}; }
  };
  const saveCart = cart => {
    try { localStorage.setItem(cartKey, JSON.stringify(cart)); }
    catch { showToast('Your browser could not save the cart. Keep this page open while ordering.'); }
    updateCartCount();
  };
  const totalQuantity = cart => Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);

  let toastTimer;
  const showToast = message => {
    let toast = document.querySelector('.cart-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'cart-toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.append(toast);
    }
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 3000);
  };

  const updateCartCount = () => {
    const count = totalQuantity(readCart());
    document.querySelectorAll('[data-cart-count]').forEach(el => { el.textContent = String(count); });
  };

  document.querySelectorAll('[data-add-to-cart]').forEach(button => {
    const id = button.dataset.productId || new URLSearchParams(location.search).get('id') || 'detergent-liquid';
    const product = products[id];
    if (!product || product.status !== 'available') {
      button.disabled = true;
      button.textContent = 'Coming soon';
      return;
    }
    button.addEventListener('click', () => {
      const input = document.querySelector('[data-quantity-for="' + id + '"]') || document.querySelector('#detail-quantity');
      const requested = Number(input?.value ?? 1);
      const quantity = Number.isSafeInteger(requested) && requested > 0 ? requested : 1;
      if (input && quantity !== requested) input.value = '1';
      const cart = readCart();
      cart[id] = (cart[id] || 0) + quantity;
      saveCart(cart);
      showToast(`${product.name} added to your cart.`);
    });
  });

  const detail = document.querySelector('[data-product-detail]');
  if (detail) {
    const id = new URLSearchParams(location.search).get('id') || 'detergent-liquid';
    const product = products[id] || products['detergent-liquid'];
    document.title = `${product.name} — LOCZ`;
    detail.querySelector('[data-detail-name]').textContent = product.name;
    detail.querySelector('[data-detail-image]').src = product.image;
    detail.querySelector('[data-detail-image]').alt = product.alt;
    detail.querySelector('[data-detail-description]').textContent = product.description;
    detail.querySelector('[data-detail-extra]').textContent = product.extra;
    detail.querySelector('[data-detail-status]').textContent = product.status === 'available' ? 'AVAILABLE' : 'COMING SOON';
    detail.querySelector('[data-detail-availability]').textContent = product.status === 'available' ? 'Available' : 'Coming soon';
    detail.querySelector('[data-detail-price]').textContent = 'Confirmed with LOCZ';
    if (product.status !== 'available') {
      detail.querySelector('[data-add-to-cart]').disabled = true;
      detail.querySelector('[data-add-to-cart]').textContent = 'Coming soon';
      detail.querySelector('#detail-quantity').disabled = true;
      detail.querySelector('[data-detail-note]').textContent = 'This product cannot be ordered yet.';
    }
  }

  const search = document.querySelector('[data-product-search]');
  const category = document.querySelector('[data-category-filter]');
  const sorting = document.querySelector('[data-product-sort]');
  const grid = document.querySelector('[data-product-grid]');
  const emptyResults = document.querySelector('[data-no-results]');
  const filterProducts = () => {
    if (!grid) return;
    const query = (search?.value || '').trim().toLowerCase();
    const selectedCategory = category?.value || 'all';
    const selectedSort = sorting?.value || 'featured';
    const cards = [...grid.querySelectorAll('[data-product-card]')];
    cards.sort((a, b) => {
      const first = products[a.dataset.productId], second = products[b.dataset.productId];
      if (selectedSort === 'name') return first.name.localeCompare(second.name);
      if (selectedSort === 'availability') return (first.status === 'available' ? -1 : 1) - (second.status === 'available' ? -1 : 1);
      return Number(second.status === 'available') - Number(first.status === 'available');
    });
    let visible = 0;
    cards.forEach(card => {
      const product = products[card.dataset.productId];
      const matches = (!query || `${product.name} ${product.category} ${product.status}`.toLowerCase().includes(query))
        && (selectedCategory === 'all' || product.category.toLowerCase() === selectedCategory);
      card.hidden = !matches;
      if (matches) visible++;
      grid.append(card);
    });
    if (emptyResults) emptyResults.hidden = visible > 0;
  };
  [search, category, sorting].filter(Boolean).forEach(control => control.addEventListener('input', filterProducts));
  [category, sorting].filter(Boolean).forEach(control => control.addEventListener('change', filterProducts));
  filterProducts();

  const cartItems = document.querySelector('[data-cart-items]');
  const emptyCart = document.querySelector('[data-cart-empty]');
  const renderCart = () => {
    if (!cartItems) return;
    const cart = readCart();
    const entries = Object.entries(cart);
    cartItems.replaceChildren();
    if (emptyCart) emptyCart.hidden = entries.length > 0;
    const form = document.querySelector('[data-checkout-form]');
    if (form) form.hidden = entries.length === 0;
    entries.forEach(([id, quantity]) => {
      const product = products[id];
      const item = document.createElement('article');
      item.className = 'cart-item';
      item.innerHTML = `<img src="${product.image}" alt="${product.alt}"><div class="cart-item-info"><p class="eyebrow">${product.category} / LOCZ</p><h3><a href="product.html?id=${product.id}">${product.name}</a></h3><p>Price confirmed with LOCZ</p><button class="remove-item" type="button" data-remove-item="${product.id}">Remove</button></div><div class="cart-item-controls"><label>Quantity <input type="number" min="1" step="1" value="${quantity}" inputmode="numeric" data-cart-quantity="${product.id}" aria-label="Quantity of ${product.name}"></label></div>`;
      cartItems.append(item);
    });
    document.querySelectorAll('[data-summary-quantity]').forEach(el => { el.textContent = String(totalQuantity(cart)); });
    document.querySelectorAll('[data-summary-subtotal]').forEach(el => { el.textContent = entries.length ? 'Confirmed with LOCZ' : '—'; });
    updateCartCount();
  };

  if (cartItems) {
    cartItems.addEventListener('click', event => {
      const button = event.target.closest('[data-remove-item]');
      if (!button) return;
      const cart = readCart();
      delete cart[button.dataset.removeItem];
      saveCart(cart);
      renderCart();
    });
    cartItems.addEventListener('change', event => {
      const input = event.target.closest('[data-cart-quantity]');
      if (!input) return;
      const quantity = Number(input.value);
      const cart = readCart();
      if (Number.isSafeInteger(quantity) && quantity > 0) cart[input.dataset.cartQuantity] = quantity;
      else if (input.dataset.cartQuantity in cart) cart[input.dataset.cartQuantity] = 1;
      saveCart(cart);
      renderCart();
    });
    renderCart();
  }

  const checkoutForm = document.querySelector('[data-checkout-form]');
  if (checkoutForm) checkoutForm.addEventListener('submit', event => {
    event.preventDefault();
    const cart = readCart();
    const entries = Object.entries(cart);
    if (!entries.length) return;
    const formData = new FormData(checkoutForm);
    const lines = [
      'Hi LOCZ, I would like to place an order:',
      ...entries.map(([id, quantity]) => `- ${products[id].name} — quantity ${quantity}`),
      '',
      `Name: ${formData.get('name')}`,
      `Phone: ${formData.get('phone')}`,
      `Delivery location: ${formData.get('location')}`,
      `Address: ${formData.get('address')}`,
      formData.get('note') ? `Order note: ${formData.get('note')}` : '',
      '',
      'Please confirm product sizes, total price, payment, and delivery details. This request is not confirmed until LOCZ replies.'
    ].filter(Boolean);
    location.href = `https://wa.me/97470595504?text=${encodeURIComponent(lines.join('\n'))}`;
  });

  updateCartCount();
})();
