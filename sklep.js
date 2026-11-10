'use strict';

/* =========================================================
   POLSKIEMC.PL — SKLEP + WŁASNY CHECKOUT VIshop
   Płatność tworzy oficjalne API VIshop. Nie przechowujemy
   danych karty ani danych logowania do operatorów.
========================================================= */

const CONFIG = {
  shopId: 8747,
  apiBase: 'https://dev123.vishop.pl/panel/shops/8747/',
  servers: [
    {
      id: 23500,
      name: 'Mace PvP',
      image: 'https://imgur.com/fWOgs5a.png',
      description: 'Rangi i produkty trybu Mace PvP.'
    },
    {
      id: 11398,
      name: 'Earth SMP',
      image: 'https://imgur.com/GTA8JwV.png',
      description: 'Rangi, klucze i produkty trybu Earth SMP.'
    },
    {
      id: 28733,
      name: '???',
      image: 'https://imgur.com/h6Khcya.png',
      description: 'Dodatkowy tryb dostępny w sklepie.'
    }
  ]
};

const elements = {
  serverView: document.getElementById('serverView'),
  serverGrid: document.getElementById('serverGrid'),
  productsView: document.getElementById('productsView'),
  productsGrid: document.getElementById('productsGrid'),
  categoryBar: document.getElementById('categoryBar'),
  serverTitleAccent: document.getElementById('serverTitleAccent'),
  notice: document.getElementById('notice'),
  changeServer: document.getElementById('changeServer'),
  hamburger: document.getElementById('hamburger'),
  menu: document.getElementById('menu'),

  checkoutModal: document.getElementById('checkoutModal'),
  closeCheckout: document.getElementById('closeCheckout'),
  checkoutForm: document.getElementById('checkoutForm'),
  checkoutProductImage: document.getElementById('checkoutProductImage'),
  checkoutProductName: document.getElementById('checkoutProductName'),
  checkoutProductServer: document.getElementById('checkoutProductServer'),
  checkoutProductDescription: document.getElementById('checkoutProductDescription'),
  checkoutNick: document.getElementById('checkoutNick'),
  checkoutQuantityWrap: document.getElementById('checkoutQuantityWrap'),
  checkoutQuantityLabel: document.getElementById('checkoutQuantityLabel'),
  checkoutQuantity: document.getElementById('checkoutQuantity'),
  checkoutQuantityValue: document.getElementById('checkoutQuantityValue'),
  checkoutQuantityMin: document.getElementById('checkoutQuantityMin'),
  checkoutQuantityMax: document.getElementById('checkoutQuantityMax'),
  checkoutMethods: document.getElementById('checkoutMethods'),
  checkoutSmsInfo: document.getElementById('checkoutSmsInfo'),
  checkoutSmsNumber: document.getElementById('checkoutSmsNumber'),
  checkoutSmsContent: document.getElementById('checkoutSmsContent'),
  checkoutSmsPrice: document.getElementById('checkoutSmsPrice'),
  checkoutSmsCode: document.getElementById('checkoutSmsCode'),
  checkoutDiscountWrap: document.getElementById('checkoutDiscountWrap'),
  checkoutDiscountCode: document.getElementById('checkoutDiscountCode'),
  applyDiscount: document.getElementById('applyDiscount'),
  checkoutDiscountMessage: document.getElementById('checkoutDiscountMessage'),
  checkoutRulesWrap: document.getElementById('checkoutRulesWrap'),
  checkoutRulesAccepted: document.getElementById('checkoutRulesAccepted'),
  checkoutRulesText: document.getElementById('checkoutRulesText'),
  checkoutTotal: document.getElementById('checkoutTotal'),
  checkoutMessage: document.getElementById('checkoutMessage'),
  checkoutSubmit: document.getElementById('checkoutSubmit'),

  voucherModal: document.getElementById('voucherModal'),
  closeVoucher: document.getElementById('closeVoucher'),
  openVoucher: document.getElementById('openVoucher'),
  voucherForm: document.getElementById('voucherForm'),
  voucherNick: document.getElementById('voucherNick'),
  voucherCode: document.getElementById('voucherCode'),
  voucherMessage: document.getElementById('voucherMessage'),

  paymentStatusView: document.getElementById('paymentStatusView'),
  paymentStatusIcon: document.getElementById('paymentStatusIcon'),
  paymentStatusTitle: document.getElementById('paymentStatusTitle'),
  paymentStatusDescription: document.getElementById('paymentStatusDescription'),
  paymentStatusDetails: document.getElementById('paymentStatusDetails'),
  paymentStatusMessage: document.getElementById('paymentStatusMessage'),
  refreshPaymentStatus: document.getElementById('refreshPaymentStatus')
};

let shopData = null;
let currencyCode = 'PLN';
let currentServer = null;
let currentProducts = [];
let currentCategories = [];
let selectedCategory = 'all';
let shopIsOnline = true;

let checkoutProduct = null;
let checkoutProviders = [];
let selectedProvider = null;
let checkoutDiscount = null;
let checkoutQuantity = 1;
let checkoutBusy = false;
let activePaymentId = null;

/* =========================================================
   POWIADOMIENIA I API
========================================================= */

function showNotice(message, type = 'error') {
  elements.notice.textContent = message;
  elements.notice.className = `notice${type === 'success' ? ' success' : ''}`;
  elements.notice.hidden = false;
}

function clearNotice() {
  elements.notice.hidden = true;
  elements.notice.textContent = '';
  elements.notice.className = 'notice';
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json;charset=utf-8' } : {}),
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const error = new Error(getApiErrorMessage(data, response.status));
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

function getApiErrorMessage(data, status = 0) {
  if (typeof data === 'string' && data.trim()) {
    const known = {
      'This shop is offline': 'Sklep jest obecnie wyłączony.',
      'Incorrect payment provider': 'Wybrana metoda płatności jest niedostępna.',
      'Incorrect player name': 'Podany nick Minecraft jest nieprawidłowy.',
      'Incorrect quantity': 'Wybrana ilość jest nieprawidłowa.',
      'Incorrect promo code': 'Kod rabatowy jest nieprawidłowy lub wygasł.',
      'Invalid promo code': 'Kod rabatowy jest nieprawidłowy lub wygasł.'
    };
    return known[data] || data;
  }

  if (Array.isArray(data)) {
    return data.map(item => typeof item === 'string' ? item : JSON.stringify(item)).join(' ');
  }

  if (data && typeof data === 'object') {
    const messages = Object.values(data).flatMap(value => Array.isArray(value) ? value : [value]);
    const message = messages.find(value => typeof value === 'string' && value.trim());
    if (message) return message;
  }

  if (status === 403) return 'Ta funkcja wymaga aktywnego pakietu Premium VIshop.';
  if (status === 404) return 'Nie znaleziono wskazanego produktu lub kodu.';
  return `Nie udało się połączyć z API VIshop (HTTP ${status || '—'}).`;
}

/* =========================================================
   INFORMACJE O SKLEPIE
========================================================= */

async function loadShopInfo() {
  try {
    shopData = await fetchJson(CONFIG.apiBase);

    if (shopData && typeof shopData === 'object') {
      currencyCode = shopData.currency || 'PLN';
      shopIsOnline = shopData.online !== false;
      currentCategories = Array.isArray(shopData.categories) ? shopData.categories : [];
    }
  } catch (error) {
    console.warn('Nie udało się pobrać informacji o sklepie VIshop:', error);
  }
}

function formatPrice(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'Cena niedostępna';

  try {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currencyCode}`;
  }
}

function createElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/* =========================================================
   TRYBY I WIDOKI
========================================================= */

function renderServers() {
  elements.serverGrid.replaceChildren();

  CONFIG.servers.forEach(server => {
    const card = createElement('article', 'server-card');
    const imageWrap = createElement('div', 'server-image-wrap');
    const image = document.createElement('img');
    image.src = server.image;
    image.alt = server.name;
    image.loading = 'lazy';
    image.onerror = () => { image.style.visibility = 'hidden'; };
    imageWrap.append(image);

    const name = createElement('h3', 'server-name', server.name);
    const description = createElement('p', 'server-description', server.description);
    description.hidden = true;

    const button = createElement('button', 'primary-button', 'WYBIERZ TRYB');
    button.type = 'button';
    button.addEventListener('click', () => selectServer(server));

    card.append(imageWrap, name, description, button);
    elements.serverGrid.append(card);
  });
}

function setPageMode(mode) {
  elements.serverView.hidden = mode !== 'servers';
  elements.productsView.hidden = mode !== 'products';
  elements.paymentStatusView.hidden = mode !== 'status';
  clearNotice();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateAddressBar(serverId = null, replace = false) {
  const url = new URL(window.location.href);
  url.searchParams.delete('payment');

  if (serverId === null) url.searchParams.delete('server');
  else url.searchParams.set('server', String(serverId));

  if (replace) window.history.replaceState({}, '', url);
  else window.history.pushState({}, '', url);
}

async function selectServer(server, updateHistory = true) {
  currentServer = server;
  selectedCategory = 'all';
  elements.serverTitleAccent.textContent = server.name;
  setPageMode('products');
  elements.productsGrid.replaceChildren(createElement('div', 'loading-card', 'Ładowanie produktów...'));
  elements.categoryBar.hidden = true;

  if (updateHistory) updateAddressBar(server.id);

  try {
    const data = await fetchJson(`${CONFIG.apiBase}products/?server=${encodeURIComponent(server.id)}`);
    if (!Array.isArray(data)) throw new Error('VIshop zwrócił nieprawidłową listę produktów.');

    currentProducts = data.filter(product => product && product.hidden !== true);
    renderCategories();
    renderProducts();
  } catch (error) {
    console.error('Błąd pobierania produktów:', error);
    elements.productsGrid.replaceChildren(createElement('div', 'empty-state', 'Nie udało się pobrać produktów. Odśwież stronę lub spróbuj ponownie później.'));
    showNotice(`Błąd połączenia z VIshop: ${error.message}`);
  }
}

function renderCategories() {
  elements.categoryBar.replaceChildren();

  const availableIds = new Set(currentProducts.map(product => String(
    typeof product.category === 'object' ? product.category?.id : product.category
  )));

  const categories = currentCategories.filter(category => category && availableIds.has(String(category.id)));
  if (!categories.length) {
    elements.categoryBar.hidden = true;
    return;
  }

  elements.categoryBar.hidden = false;

  const allButton = createElement('button', `category-button${selectedCategory === 'all' ? ' active' : ''}`, 'Wszystkie');
  allButton.type = 'button';
  allButton.addEventListener('click', () => {
    selectedCategory = 'all';
    renderCategories();
    renderProducts();
  });
  elements.categoryBar.append(allButton);

  categories.forEach(category => {
    const active = String(selectedCategory) === String(category.id);
    const button = createElement('button', `category-button${active ? ' active' : ''}`, category.name);
    button.type = 'button';
    button.addEventListener('click', () => {
      selectedCategory = String(category.id);
      renderCategories();
      renderProducts();
    });
    elements.categoryBar.append(button);
  });
}

/* =========================================================
   PRODUKTY I ICH OPISY
========================================================= */

function getProductPrice(product) {
  const base = Number(product.main_price);
  const promo = Number(product.promo);
  const hasPromo = product.promo !== null && product.promo !== undefined && Number.isFinite(promo) && promo > 0;
  return {
    base,
    finalPrice: hasPromo ? base * (1 - promo / 100) : base,
    promo: hasPromo ? promo : null
  };
}

function getProductDescription(product) {
  const values = [product.description, product.short_description, product.desc, product.details, product.content, product.info];
  const value = values.find(item => typeof item === 'string' && item.trim());
  if (!value) return 'Brak opisu produktu.';

  // Zachowujemy znaczniki formatowania, ale nie pozwalamy na wstrzyknięcie HTML.
  let text = value
    .replace(/<\s*(strong|b)\b[^>]*>/gi, '**')
    .replace(/<\s*\/\s*(strong|b)\s*>/gi, '**')
    .replace(/<\s*(em|i)\b[^>]*>/gi, '*')
    .replace(/<\s*\/\s*(em|i)\s*>/gi, '*')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|h[1-6])\s*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '• ')
    .replace(/<\/li\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\\[ \t]*\r?\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(line => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Dekodowanie encji HTML bez wstawiania ich jako HTML do dokumentu.
  const decoder = document.createElement('textarea');
  decoder.innerHTML = text;
  return decoder.value || text;
}

function appendInlineFormatting(parent, text) {
  const pattern = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|(?<!\*)\*[^*]+\*(?!\*))/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parent.append(document.createTextNode(text.slice(lastIndex, match.index)));
    }

    const token = match[0];
    let node;
    if (token.startsWith('**') || token.startsWith('__')) {
      node = document.createElement('strong');
      node.textContent = token.slice(2, -2);
    } else if (token.startsWith('`')) {
      node = document.createElement('code');
      node.textContent = token.slice(1, -1);
    } else {
      node = document.createElement('em');
      node.textContent = token.slice(1, -1);
    }
    parent.append(node);
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    parent.append(document.createTextNode(text.slice(lastIndex)));
  }
}

function renderFormattedDescription(container, description) {
  container.replaceChildren();
  const lines = description.split('\n');
  let list = null;

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) {
      list = null;
      return;
    }

    const listMatch = trimmed.match(/^(?:[-*•]|\d+[.)])\s+(.+)$/);
    if (listMatch) {
      if (!list) {
        list = document.createElement('ul');
        container.append(list);
      }
      const item = document.createElement('li');
      appendInlineFormatting(item, listMatch[1]);
      list.append(item);
      return;
    }

    list = null;
    const paragraph = document.createElement('p');
    appendInlineFormatting(paragraph, trimmed);
    container.append(paragraph);
  });
}

function renderProducts() {
  elements.productsGrid.replaceChildren();

  const products = currentProducts.filter(product => {
    if (selectedCategory === 'all') return true;
    const categoryId = typeof product.category === 'object' ? product.category?.id : product.category;
    return String(categoryId) === String(selectedCategory);
  });

  if (!products.length) {
    elements.productsGrid.append(createElement('div', 'empty-state', 'Brak produktów w tej kategorii.'));
    return;
  }

  products.forEach(product => {
    const card = createElement('article', 'product-card');
    if (product.event === true || product.event_product === true) {
      card.classList.add('product-card-event');
    }

    const imageWrap = createElement('div', 'product-image-wrap');
    const image = document.createElement('img');
    image.src = product.image || '../images/polskiemc.png';
    image.alt = product.name || 'Produkt';
    image.loading = 'lazy';
    image.onerror = () => { image.src = '../images/polskiemc.png'; };
    imageWrap.append(image);

    const name = createElement('h3', 'product-name', product.name || 'Produkt');
    const description = createElement('div', 'product-description');
    renderFormattedDescription(description, getProductDescription(product));

    const price = getProductPrice(product);
    const buyButton = createElement('button', 'product-buy-button');
    buyButton.type = 'button';

    const currentPrice = createElement('span', 'buy-current-price', formatPrice(price.finalPrice));
    buyButton.append(currentPrice);

    if (price.promo !== null) {
      buyButton.append(
        createElement('span', 'buy-old-price', formatPrice(price.base)),
        createElement('span', 'buy-discount', `-${price.promo}%`)
      );
    }

    buyButton.addEventListener('click', () => openCheckout(product));
    card.append(imageWrap, name, description, buyButton);
    elements.productsGrid.append(card);
  });
}

/* =========================================================
   OPIS PRODUKTU — SCROLL I ROZMIAR
========================================================= */

function applyDescriptionStyles() {
  const styleId = 'polskiemc-description-improvements';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    .product-name {
      font-size: 23px !important;
      line-height: 1.35 !important;
      min-height: 75px !important;
      padding: 16px 20px !important;
    }

    .product-description {
      max-height: 190px !important;
      min-height: 0 !important;
      overflow-y: auto !important;
      overflow-x: hidden !important;
      padding: 13px 20px 18px !important;
      margin: 0 0 12px !important;
      text-align: left !important;
      scrollbar-width: thin;
      scrollbar-color: #d61841 #222;
      overflow-wrap: anywhere;
    }

    .product-description p {
      margin: 0 0 9px !important;
      padding: 0 !important;
      line-height: 1.7 !important;
    }

    .product-description p:last-child {
      margin-bottom: 0 !important;
    }

    .product-description strong {
      color: #fff !important;
      font-weight: 800 !important;
    }

    .product-description em {
      color: #e5e5e5 !important;
    }

    .product-description code {
      padding: 2px 5px;
      border-radius: 4px;
      background: rgba(214,24,65,.13);
      color: #ff9bb0;
    }

    .product-description ul {
      margin: 7px 0 10px !important;
      padding-left: 21px !important;
    }

    .product-description li {
      margin: 4px 0 !important;
      line-height: 1.65 !important;
    }

    .product-description::-webkit-scrollbar {
      width: 6px;
    }

    .product-description::-webkit-scrollbar-track {
      background: #222;
      border-radius: 10px;
    }

    .product-description::-webkit-scrollbar-thumb {
      background: #d61841;
      border-radius: 10px;
    }

    .checkout-product-copy strong {
      font-size: 19px !important;
      line-height: 1.4 !important;
    }

    .checkout-product-copy p {
      max-height: 130px;
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: #d61841 #222;
    }

    .payment-method {
      min-height: 66px !important;
      position: relative !important;
      padding: 14px 35px 14px 16px !important;
      border: 2px solid #303039 !important;
      border-radius: 12px !important;
      background: #19191f !important;
      transition: .22s ease !important;
    }

    .payment-method.active {
      border-color: #d61841 !important;
      background: linear-gradient(135deg,rgba(214,24,65,.17),#19191f) !important;
      box-shadow: 0 0 0 1px rgba(214,24,65,.18), 0 0 18px rgba(214,24,65,.12) !important;
    }

    .payment-method::after {
      content: "";
      position: absolute;
      right: 14px;
      top: 50%;
      width: 12px;
      height: 12px;
      transform: translateY(-50%);
      border: 2px solid #777;
      border-radius: 50%;
    }

    .payment-method.active::after {
      border-color: #d61841;
      background: #d61841;
      box-shadow: 0 0 9px rgba(214,24,65,.8);
    }

    .payment-method[data-provider*="paypal"].active {
      border-color: #0070ba !important;
      background: linear-gradient(135deg,rgba(0,112,186,.17),#19191f) !important;
    }

    .payment-method[data-provider*="cashbill"].active {
      border-color: #d61841 !important;
    }

    .payment-method[data-provider*="paysafecard"].active,
    .payment-method[data-provider*="icehost"].active {
      border-color: #f5c400 !important;
      background: linear-gradient(135deg,rgba(245,196,0,.12),#19191f) !important;
    }

    @media(max-width:600px) {
      .product-name {
        font-size: 21px !important;
      }
      .product-description {
        max-height: 170px !important;
      }
    }
  `;
  document.head.append(style);
}

/* =========================================================
   CHECKOUT
========================================================= */

function openCheckout(product) {
  checkoutProduct = product;
  checkoutProviders = [];
  selectedProvider = null;
  checkoutDiscount = null;
  checkoutQuantity = 1;
  checkoutBusy = false;

  elements.checkoutProductName.textContent = product.name || 'Produkt';
  elements.checkoutProductServer.textContent = currentServer?.name || '';
  elements.checkoutProductImage.src = product.image || '../images/polskiemc.png';
  elements.checkoutProductImage.alt = product.name || 'Produkt';
  renderFormattedDescription(
    elements.checkoutProductDescription,
    getProductDescription(product)
  );

  elements.checkoutNick.value = '';
  elements.checkoutDiscountCode.value = '';
  elements.checkoutDiscountMessage.textContent = '';
  elements.checkoutMessage.textContent = '';
  elements.checkoutTotal.textContent = formatPrice(getProductPrice(product).finalPrice);
  elements.checkoutSmsInfo.hidden = true;
  elements.checkoutSmsCode.value = '';

  const min = Math.max(1, Number(product.min_quantity) || 1);
  const max = Math.max(min, Number(product.max_quantity) || min);

  elements.checkoutQuantityWrap.hidden = max <= min;
  elements.checkoutQuantity.min = String(min);
  elements.checkoutQuantity.max = String(max);
  elements.checkoutQuantity.value = String(min);
  elements.checkoutQuantityMin.textContent = String(min);
  elements.checkoutQuantityMax.textContent = String(max);
  elements.checkoutQuantityValue.textContent = String(min);
  checkoutQuantity = min;

  elements.checkoutMethods.replaceChildren(
    createElement('div', 'loading-card', 'Ładowanie metod płatności...')
  );

  elements.checkoutModal.hidden = false;
  document.body.classList.add('checkout-open');
  loadPaymentProviders(product);
  updateCheckoutTotal();
}

function closeCheckout() {
  if (checkoutBusy) return;
  elements.checkoutModal.hidden = true;
  document.body.classList.remove('checkout-open');
}

async function loadPaymentProviders(product) {
  try {
    const data = await fetchJson(
      `${CONFIG.apiBase}products/${encodeURIComponent(product.id)}/providers/`
    );

    checkoutProviders = Array.isArray(data) ? data : (data.providers || []);
    renderPaymentProviders();
  } catch (error) {
    console.error('Błąd metod płatności:', error);
    elements.checkoutMethods.replaceChildren(
      createElement('div', 'empty-state', 'Nie udało się pobrać metod płatności.')
    );
    setCheckoutMessage(error.message);
  }
}

function getProviderValue(provider) {
  return String(provider.value || provider.id || provider.provider || '');
}

function getProviderName(provider) {
  const value = getProviderValue(provider).toLowerCase();
  if (value.includes('paypal')) return 'PayPal';
  if (value.includes('cashbill')) return 'BLIK';
  if (value.includes('paysafecard') || value.includes('icehost')) return 'PSC';
  return provider.name || provider.label || value;
}

function renderPaymentProviders() {
  elements.checkoutMethods.replaceChildren();

  if (!checkoutProviders.length) {
    elements.checkoutMethods.append(
      createElement('div', 'empty-state', 'Brak dostępnych metod płatności.')
    );
    return;
  }

  checkoutProviders.forEach(provider => {
    const value = getProviderValue(provider);
    const name = getProviderName(provider);
    const button = createElement('button', 'payment-method');
    button.type = 'button';
    button.dataset.provider = value;
    button.setAttribute('aria-pressed', 'false');

    const title = createElement('span', 'payment-method-name', name);
    button.append(title);

    if (provider.price !== undefined && provider.price !== null) {
      button.append(createElement('span', 'payment-method-price', formatPrice(provider.price)));
    }

    button.addEventListener('click', () => {
      selectedProvider = provider;
      renderPaymentProviders();
      updateCheckoutTotal();
      updateCheckoutSubmitState();
    });

    if (selectedProvider && getProviderValue(selectedProvider) === value) {
      button.classList.add('active');
      button.setAttribute('aria-pressed', 'true');
    }

    elements.checkoutMethods.append(button);
  });

  if (!selectedProvider && checkoutProviders.length === 1) {
    selectedProvider = checkoutProviders[0];
    renderPaymentProviders();
  }

  updateCheckoutSubmitState();
}

function updateCheckoutTotal() {
  if (!checkoutProduct) return;

  const price = getProductPrice(checkoutProduct);
  let total = price.finalPrice * checkoutQuantity;

  if (checkoutDiscount && Number.isFinite(Number(checkoutDiscount.discount))) {
    total *= 1 - Number(checkoutDiscount.discount) / 100;
  }

  if (selectedProvider && Number.isFinite(Number(selectedProvider.price))) {
    total += Number(selectedProvider.price);
  }

  elements.checkoutTotal.textContent = formatPrice(total);
  elements.checkoutQuantityValue.textContent = String(checkoutQuantity);
}

function setCheckoutMessage(message, success = false) {
  elements.checkoutMessage.textContent = message || '';
  elements.checkoutMessage.classList.toggle('success', success);
}

function updateCheckoutSubmitState() {
  const nick = elements.checkoutNick.value.trim();
  const validNick = /^[A-Za-z0-9_]{3,16}$/.test(nick);
  const rulesValid = elements.checkoutRulesWrap.hidden || elements.checkoutRulesAccepted.checked;

  elements.checkoutSubmit.disabled =
    checkoutBusy ||
    !selectedProvider ||
    !validNick ||
    !rulesValid ||
    !shopIsOnline;
}

function updateQuantity() {
  checkoutQuantity = Math.max(1, Number(elements.checkoutQuantity.value) || 1);
  updateCheckoutTotal();
}

async function applyDiscountCode() {
  const code = elements.checkoutDiscountCode.value.trim();

  if (!code) {
    elements.checkoutDiscountMessage.textContent = 'Wpisz kod rabatowy.';
    return;
  }

  try {
    const data = await fetchJson(`${CONFIG.apiBase}promocodes/${encodeURIComponent(code)}/`);
    checkoutDiscount = data;
    elements.checkoutDiscountMessage.textContent = 'Kod rabatowy został zastosowany.';
    elements.checkoutDiscountMessage.classList.add('success');
    updateCheckoutTotal();
  } catch (error) {
    checkoutDiscount = null;
    elements.checkoutDiscountMessage.textContent = error.message;
    elements.checkoutDiscountMessage.classList.remove('success');
    updateCheckoutTotal();
  }
}

/* =========================================================
   TWORZENIE PŁATNOŚCI — API VIshop
========================================================= */

async function createPayment(event) {
  event.preventDefault();

  if (checkoutBusy || !checkoutProduct || !selectedProvider) return;

  const nick = elements.checkoutNick.value.trim();
  if (!/^[A-Za-z0-9_]{3,16}$/.test(nick)) {
    setCheckoutMessage('Wpisz prawidłowy nick Minecraft (3–16 znaków).');
    return;
  }

  if (!elements.checkoutRulesWrap.hidden && !elements.checkoutRulesAccepted.checked) {
    setCheckoutMessage('Zaakceptuj regulamin przed przejściem do płatności.');
    return;
  }

  checkoutBusy = true;
  elements.checkoutSubmit.disabled = true;
  elements.checkoutSubmit.textContent = 'TWORZENIE PŁATNOŚCI...';
  setCheckoutMessage('');

  try {
    const payload = {
      player: nick,
      product: checkoutProduct.id,
      quantity: checkoutQuantity,
      provider: getProviderValue(selectedProvider)
    };

    if (checkoutDiscount) {
      payload.promo_code = elements.checkoutDiscountCode.value.trim();
    }

    const data = await fetchJson(`${CONFIG.apiBase}payments/`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const paymentUrl = data.payment_url || data.url || data.redirect_url;
    const paymentId = data.id || data.payment_id || data.order_id;

    if (paymentId) {
      activePaymentId = paymentId;
      updateAddressBar(currentServer?.id || null, true);
      const url = new URL(window.location.href);
      url.searchParams.set('payment', String(paymentId));
      window.history.replaceState({}, '', url);
    }

    if (paymentUrl) {
      window.location.assign(paymentUrl);
      return;
    }

    if (data.redirect) {
      window.location.assign(data.redirect);
      return;
    }

    throw new Error('VIshop nie zwrócił adresu płatności.');
  } catch (error) {
    console.error('Błąd tworzenia płatności:', error);
    setCheckoutMessage(error.message);
  } finally {
    checkoutBusy = false;
    elements.checkoutSubmit.textContent = 'PRZEJDŹ DO PŁATNOŚCI';
    updateCheckoutSubmitState();
  }
}

/* =========================================================
   STATUS PŁATNOŚCI
========================================================= */

function showPaymentStatus(data) {
  elements.paymentStatusView.hidden = false;
  elements.paymentStatusIcon.textContent = '✓';
  elements.paymentStatusTitle.textContent = 'Status zamówienia';
  elements.paymentStatusDescription.textContent = 'Aktualny status płatności.';
  elements.paymentStatusDetails.replaceChildren();

  const rows = [
    ['Numer zamówienia', data.id || data.payment_id || activePaymentId],
    ['Status', data.status || data.payment_status || 'Nieznany'],
    ['Nick', data.player || data.username],
    ['Kwota', data.amount !== undefined ? formatPrice(data.amount) : null]
  ].filter(([, value]) => value !== undefined && value !== null && value !== '');

  rows.forEach(([label, value]) => {
    const row = createElement('div', 'payment-status-row');
    row.append(
      createElement('span', '', label),
      createElement('strong', '', String(value))
    );
    elements.paymentStatusDetails.append(row);
  });

  elements.paymentStatusDetails.hidden = false;
}

async function refreshPaymentStatus() {
  const params = new URLSearchParams(window.location.search);
  const paymentId = params.get('payment') || activePaymentId;

  if (!paymentId) {
    elements.paymentStatusMessage.textContent = 'Nie znaleziono numeru zamówienia.';
    return;
  }

  elements.refreshPaymentStatus.disabled = true;
  elements.paymentStatusMessage.textContent = 'Sprawdzanie statusu...';

  try {
    const data = await fetchJson(
      `${CONFIG.apiBase}payments/${encodeURIComponent(paymentId)}/`
    );
    showPaymentStatus(data);
    elements.paymentStatusMessage.textContent = '';
  } catch (error) {
    elements.paymentStatusMessage.textContent = error.message;
  } finally {
    elements.refreshPaymentStatus.disabled = false;
  }
}

/* =========================================================
   VOUCHERY
========================================================= */

function openVoucher() {
  elements.voucherModal.hidden = false;
  elements.voucherNick.focus();
}

function closeVoucher() {
  elements.voucherModal.hidden = true;
}

async function redeemVoucher(event) {
  event.preventDefault();

  const nick = elements.voucherNick.value.trim();
  const code = elements.voucherCode.value.trim();

  if (!/^[A-Za-z0-9_]{3,16}$/.test(nick)) {
    elements.voucherMessage.textContent = 'Wpisz prawidłowy nick Minecraft.';
    return;
  }

  if (!code) {
    elements.voucherMessage.textContent = 'Wpisz kod vouchera.';
    return;
  }

  const submit = elements.voucherForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  elements.voucherMessage.textContent = 'Realizowanie vouchera...';

  try {
    const data = await fetchJson(`${CONFIG.apiBase}vouchers/redeem/`, {
      method: 'POST',
      body: JSON.stringify({ player: nick, code })
    });

    elements.voucherMessage.textContent = data.message || 'Voucher został zrealizowany.';
    elements.voucherMessage.classList.add('success');
  } catch (error) {
    elements.voucherMessage.textContent = error.message;
    elements.voucherMessage.classList.remove('success');
  } finally {
    submit.disabled = false;
  }
}

/* =========================================================
   OBSŁUGA MENU, MODALI I HISTORII
========================================================= */

function setupMenu() {
  if (!elements.hamburger || !elements.menu) return;

  const toggleMenu = () => {
    const open = elements.menu.classList.toggle('open');
    elements.hamburger.setAttribute('aria-expanded', String(open));
  };

  elements.hamburger.addEventListener('click', toggleMenu);
  elements.hamburger.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleMenu();
    }
  });

  elements.menu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      elements.menu.classList.remove('open');
      elements.hamburger.setAttribute('aria-expanded', 'false');
    });
  });
}

function setupEvents() {
  elements.changeServer?.addEventListener('click', () => {
    currentServer = null;
    updateAddressBar(null);
    setPageMode('servers');
  });

  elements.closeCheckout?.addEventListener('click', closeCheckout);
  elements.checkoutModal?.addEventListener('click', event => {
    if (event.target === elements.checkoutModal) closeCheckout();
  });

  elements.checkoutForm?.addEventListener('submit', createPayment);
  elements.checkoutNick?.addEventListener('input', updateCheckoutSubmitState);
  elements.checkoutQuantity?.addEventListener('input', updateQuantity);
  elements.checkoutRulesAccepted?.addEventListener('change', updateCheckoutSubmitState);
  elements.applyDiscount?.addEventListener('click', applyDiscountCode);

  elements.openVoucher?.addEventListener('click', openVoucher);
  elements.closeVoucher?.addEventListener('click', closeVoucher);
  elements.voucherForm?.addEventListener('submit', redeemVoucher);

  elements.voucherModal?.addEventListener('click', event => {
    if (event.target === elements.voucherModal) closeVoucher();
  });

  elements.refreshPaymentStatus?.addEventListener('click', refreshPaymentStatus);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeVoucher();
      closeCheckout();
    }
  });

  window.addEventListener('popstate', handleHistoryChange);
}

function handleHistoryChange() {
  const params = new URLSearchParams(window.location.search);
  const paymentId = params.get('payment');
  const serverId = params.get('server');

  if (paymentId) {
    activePaymentId = paymentId;
    setPageMode('status');
    refreshPaymentStatus();
    return;
  }

  if (serverId) {
    const server = CONFIG.servers.find(item => String(item.id) === serverId);
    if (server) {
      selectServer(server, false);
      return;
    }
  }

  setPageMode('servers');
}

/* =========================================================
   START
========================================================= */

async function initShop() {
  applyDescriptionStyles();
  setupMenu();
  setupEvents();
  renderServers();

  await loadShopInfo();

  if (!shopIsOnline) {
    showNotice('Sklep jest obecnie wyłączony.');
  }

  const params = new URLSearchParams(window.location.search);
  const paymentId = params.get('payment');
  const serverId = params.get('server');

  if (paymentId) {
    activePaymentId = paymentId;
    setPageMode('status');
    await refreshPaymentStatus();
    return;
  }

  if (serverId) {
    const server = CONFIG.servers.find(item => String(item.id) === serverId);
    if (server) {
      await selectServer(server, false);
      return;
    }
  }

  setPageMode('servers');
}

document.addEventListener('DOMContentLoaded', initShop);
  const categories = currentCategories.filter(category => category && availableIds.has(String(category.id)));
  if (!categories.length) {
    elements.categoryBar.hidden = true;
    return;
  }

  elements.categoryBar.hidden = false;

  const allButton = createElement('button', `category-button${selectedCategory === 'all' ? ' active' : ''}`, 'Wszystkie');
  allButton.type = 'button';
  allButton.addEventListener('click', () => {
    selectedCategory = 'all';
    renderCategories();
    renderProducts();
  });
  elements.categoryBar.append(allButton);

  categories.forEach(category => {
    const active = String(selectedCategory) === String(category.id);
    const button = createElement('button', `category-button${active ? ' active' : ''}`, category.name);
    button.type = 'button';
    button.addEventListener('click', () => {
      selectedCategory = String(category.id);
      renderCategories();
      renderProducts();
    });
    elements.categoryBar.append(button);
  });
}

/* =========================================================
   PRODUKTY I ICH OPISY
========================================================= */

function getProductPrice(product) {
  const base = Number(product.main_price);
  const promo = Number(product.promo);
  const hasPromo = product.promo !== null && product.promo !== undefined && Number.isFinite(promo) && promo > 0;
  return {
    base,
    finalPrice: hasPromo ? base * (1 - promo / 100) : base,
    promo: hasPromo ? promo : null
  };
}

function getProductDescription(product) {
  const values = [product.description, product.short_description, product.desc, product.details, product.content, product.info];
  const value = values.find(item => typeof item === 'string' && item.trim());
  if (!value) return 'Brak opisu produktu.';

  // Zachowujemy znaczniki formatowania, ale nie pozwalamy na wstrzyknięcie HTML.
  let text = value
    .replace(/<\s*(strong|b)\b[^>]*>/gi, '**')
    .replace(/<\s*\/\s*(strong|b)\s*>/gi, '**')
    .replace(/<\s*(em|i)\b[^>]*>/gi, '*')
    .replace(/<\s*\/\s*(em|i)\s*>/gi, '*')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|h[1-6])\s*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '• ')
    .replace(/<\/li\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\\[ \t]*\r?\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(line => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Dekodowanie encji HTML bez wstawiania ich jako HTML do dokumentu.
  const decoder = document.createElement('textarea');
  decoder.innerHTML = text;
  return decoder.value || text;
}

function appendInlineFormatting(parent, text) {
  const pattern = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|(?<!\*)\*[^*]+\*(?!\*))/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parent.append(document.createTextNode(text.slice(lastIndex, match.index)));
    }

    const token = match[0];
    let node;
    if (token.startsWith('**') || token.startsWith('__')) {
      node = document.createElement('strong');
      node.textContent = token.slice(2, -2);
    } else if (token.startsWith('`')) {
      node = document.createElement('code');
      node.textContent = token.slice(1, -1);
    } else {
      node = document.createElement('em');
      node.textContent = token.slice(1, -1);
    }
    parent.append(node);
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    parent.append(document.createTextNode(text.slice(lastIndex)));
  }
}

function renderFormattedDescription(container, source) {
  const text = String(source || '').replace(/\r\n?/g, '\n');
  container.replaceChildren();

  const lines = text.split('\n');
  let list = null;
  let listType = null;

  const closeList = () => {
    list = null;
    listType = null;
  };

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) {
      closeList();
      return;
    }

    const bullet = trimmed.match(/^(?:[•*\-]|» )\s*(.+)$/);
    const numbered = trimmed.match(/^\d+[.)]\s+(.+)$/);

    if (bullet || numbered) {
      const type = numbered ? 'ol' : 'ul';
      if (!list || listType !== type) {
        list = document.createElement(type);
        listType = type;
        container.append(list);
      }
      const item = document.createElement('li');
      appendInlineFormatting(item, (bullet || numbered)[1]);
      list.append(item);
      return;
    }

    closeList();
    const paragraph = document.createElement('p');
    appendInlineFormatting(paragraph, trimmed);
    container.append(paragraph);
  });
}

function getProductCategoryName(product) {
  if (!product || typeof product !== 'object') return '';
  const raw = product.category;
  const id = raw && typeof raw === 'object' ? raw.id : raw;
  const category = currentCategories.find(item => item && String(item.id) === String(id));
  const rawName = raw && typeof raw === 'object' ? raw.name : '';

  return String(category?.name || rawName || product.category_name || product.categoryName ||
    (typeof raw === 'string' && !/^\d+$/.test(raw) ? raw : '')).trim();
}

function isEventProduct(product) {
  return getProductCategoryName(product)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .includes('event');
}

function createProductDescription(product) {
  const description = getProductDescription(product);
  const box = createElement('div', 'product-description product-description-scroll');
  renderFormattedDescription(box, description);
  box.setAttribute('tabindex', '0');
  box.setAttribute('aria-label', 'Opis produktu — przewiń, aby przeczytać całość');
  return box;
}

function createProductCard(product) {
  const isEvent = isEventProduct(product);
  const card = createElement('article', `product-card${isEvent ? ' product-card-event' : ''}`);

  const imageWrap = createElement('div', 'product-image-wrap');
  const image = document.createElement('img');
  image.src = product.image || '../images/polskiemc.png';
  image.alt = product.name || 'Produkt';
  image.loading = 'lazy';
  image.onerror = () => { image.src = '../images/polskiemc.png'; };
  imageWrap.append(image);

  const name = createElement('h3', 'product-name', product.name || 'Produkt');
  const description = createProductDescription(product);
  const price = getProductPrice(product);
  const buyButton = createElement('button', `primary-button product-buy-button${isEvent ? ' product-buy-button-event' : ''}`);
  buyButton.type = 'button';
  buyButton.disabled = !shopIsOnline;
  buyButton.setAttribute('aria-label', `Kup ${product.name || 'produkt'} za ${formatPrice(price.finalPrice)}`);

  if (price.promo) {
    buyButton.append(
      createElement('span', 'buy-old-price', formatPrice(price.base)),
      createElement('span', 'buy-current-price', formatPrice(price.finalPrice)),
      createElement('span', 'buy-discount', `-${price.promo}%`)
    );
  } else {
    buyButton.append(createElement('span', 'buy-current-price', formatPrice(price.base)));
  }

  buyButton.addEventListener('click', () => buyProduct(product));
  card.append(imageWrap, name, description, buyButton);
  return card;
}

function renderProducts() {
  elements.productsGrid.replaceChildren();

  const visible = selectedCategory === 'all'
    ? currentProducts
    : currentProducts.filter(product => String(typeof product.category === 'object' ? product.category?.id : product.category) === String(selectedCategory));

  if (!visible.length) {
    elements.productsGrid.append(createElement('div', 'empty-state', 'Brak produktów w tej kategorii.'));
    return;
  }

  visible.forEach(product => elements.productsGrid.append(createProductCard(product)));
}

/* =========================================================
   WŁASNY CHECKOUT — DANE PRODUKTU I OPERATORZY
========================================================= */

async function buyProduct(product) {
  if (!shopIsOnline) {
    showNotice('Sklep jest obecnie wyłączony. Zakupy są chwilowo niedostępne.');
    return;
  }

  if (!product || !product.id) {
    showNotice('Nie udało się rozpoznać produktu. Odśwież stronę.');
    return;
  }

  checkoutProduct = product;
  checkoutProviders = [];
  selectedProvider = null;
  checkoutDiscount = null;
  checkoutQuantity = 1;
  checkoutBusy = false;

  resetCheckoutForm();
  elements.checkoutModal.hidden = false;
  document.body.classList.add('checkout-open');
  elements.checkoutMethods.replaceChildren(createElement('div', 'loading-card', 'Ładowanie metod płatności...'));
  elements.checkoutSubmit.disabled = true;
  elements.checkoutProductName.textContent = product.name || 'Produkt';
  elements.checkoutProductServer.textContent = currentServer ? currentServer.name : '';
  elements.checkoutProductDescription.classList.add('checkout-description-scroll');
  renderFormattedDescription(elements.checkoutProductDescription, getProductDescription(product));
  elements.checkoutProductImage.src = product.image || '../images/polskiemc.png';
  elements.checkoutProductImage.onerror = () => { elements.checkoutProductImage.src = '../images/polskiemc.png'; };
  configureQuantity(product);
  configureRules();
  elements.checkoutDiscountWrap.hidden = Number(product.promo) > 0;

  try {
    const [details, providers] = await Promise.all([
      fetchJson(`${CONFIG.apiBase}products/${encodeURIComponent(product.id)}/`),
      fetchJson(`${CONFIG.apiBase}payments/`)
    ]);

    if (!details || details.hidden === true) throw new Error('Ten produkt nie jest dostępny.');
    if (!Array.isArray(providers)) throw new Error('VIshop zwrócił nieprawidłową listę metod płatności.');

    checkoutProduct = details;
    checkoutProviders = providers.filter(provider => {
      if (!provider || !provider.provider) return false;
      const value = details.prices?.[provider.provider];
      return value !== null && value !== undefined;
    });

    elements.checkoutProductName.textContent = details.name || product.name || 'Produkt';
    renderFormattedDescription(elements.checkoutProductDescription, getProductDescription(details));
    configureQuantity(details);
    elements.checkoutDiscountWrap.hidden = Number(details.promo) > 0;
    renderCheckoutMethods();
    updateCheckoutTotal();
  } catch (error) {
    console.error('Nie udało się przygotować checkoutu:', error);
    elements.checkoutMethods.replaceChildren(createElement('div', 'empty-state', error.message || 'Nie udało się pobrać metod płatności.'));
    setCheckoutMessage(error.message || 'Nie udało się przygotować płatności.');
  }
}

function resetCheckoutForm() {
  elements.checkoutForm.reset();
  elements.checkoutNick.value = '';
  elements.checkoutSmsCode.value = '';
  elements.checkoutDiscountCode.value = '';
  elements.checkoutDiscountMessage.textContent = '';
  elements.checkoutDiscountMessage.className = 'checkout-inline-message';
  elements.checkoutMessage.textContent = '';
  elements.checkoutRulesAccepted.checked = false;
  elements.checkoutSmsInfo.hidden = true;
  elements.checkoutDiscountWrap.hidden = false;
  elements.checkoutQuantityWrap.hidden = true;
  elements.checkoutRulesWrap.hidden = true;
  elements.checkoutTotal.textContent = '—';
  elements.checkoutSubmit.disabled = true;
  elements.checkoutSubmit.textContent = 'PRZEJDŹ DO PŁATNOŚCI';
}

function configureQuantity(product) {
  if (!product || product.slider !== true) {
    checkoutQuantity = 1;
    elements.checkoutQuantityWrap.hidden = true;
    return;
  }

  const min = Math.max(1, parseInt(product.slider_min, 10) || 1);
  const max = Math.max(min, parseInt(product.slider_max, 10) || min);
  checkoutQuantity = min;
  elements.checkoutQuantityWrap.hidden = false;
  elements.checkoutQuantityLabel.textContent = product.slider_name || 'Ilość';
  elements.checkoutQuantity.min = String(min);
  elements.checkoutQuantity.max = String(max);
  elements.checkoutQuantity.value = String(min);
  elements.checkoutQuantityMin.textContent = String(min);
  elements.checkoutQuantityMax.textContent = String(max);
  elements.checkoutQuantityValue.textContent = String(min);
}

function configureRules() {
  const rules = shopData?.rules;
  elements.checkoutRulesWrap.hidden = !rules;
  elements.checkoutRulesAccepted.checked = false;
  elements.checkoutRulesText.replaceChildren();

  if (!rules) return;

  const labelText = 'Akceptuję regulamin sklepu';
  if (typeof rules === 'string' && /^https?:\/\//i.test(rules.trim())) {
    const link = document.createElement('a');
    link.href = rules.trim();
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'regulamin sklepu';
    elements.checkoutRulesText.append(document.createTextNode('Akceptuję '), link);
  } else {
    elements.checkoutRulesText.textContent = typeof rules === 'string' && rules.trim()
      ? `${labelText}: ${rules}`
      : `${labelText}.`;
  }
}

function isSmsProvider(provider) {
  return Boolean(provider?.is_sms) || /_sms$/i.test(provider?.provider || '');
}

function getSmsNumber(provider) {
  if (!provider || !checkoutProduct) return null;
  const id = checkoutProduct.prices?.[provider.provider];
  return (provider.sms_numbers || []).find(number => String(number.id) === String(id)) || null;
}

function getProviderUnitPrice(provider) {
  if (!provider || !checkoutProduct) return NaN;
  if (isSmsProvider(provider)) {
    const smsNumber = getSmsNumber(provider);
    return smsNumber ? Number(smsNumber.price) : NaN;
  }
  return Number(checkoutProduct.prices?.[provider.provider]);
}

function getProviderPresentation(provider) {
  const key = String(provider?.provider || '').toLowerCase();
  const rawName = String(provider?.name || key);

  if (key === 'paypal' || /paypal/i.test(rawName)) {
    return { title: 'PayPal', subtitle: 'Szybka płatność online', code: 'PP', theme: 'paypal' };
  }
  if (key === 'cashbill_transfer' || /blik/i.test(rawName)) {
    return { title: 'BLIK', subtitle: 'Płatność kodem BLIK', code: 'B', theme: 'blik' };
  }
  if (key === 'paysafecard' || key === 'icehost' || /paysafecard|psc/i.test(rawName)) {
    return { title: 'PSC', subtitle: 'Paysafecard', code: 'PSC', theme: 'psc' };
  }
  if (/sms/i.test(rawName) || isSmsProvider(provider)) {
    return { title: rawName, subtitle: 'Płatność SMS', code: 'SMS', theme: 'sms' };
  }
  return { title: rawName, subtitle: 'Bezpieczna płatność', code: 'PL', theme: 'other' };
}

function renderCheckoutMethods() {
  elements.checkoutMethods.replaceChildren();
  elements.checkoutMethods.classList.add('checkout-payment-options');

  if (!checkoutProviders.length) {
    elements.checkoutMethods.append(createElement('div', 'empty-state', 'Brak dostępnych metod płatności dla tego produktu.'));
    selectedProvider = null;
    updateCheckoutTotal();
    return;
  }

  checkoutProviders.forEach(provider => {
    const isSelected = selectedProvider?.provider === provider.provider;
    const presentation = getProviderPresentation(provider);
    const button = createElement('button', `payment-method payment-method-${presentation.theme}${isSelected ? ' active' : ''}`);
    button.type = 'button';
    button.setAttribute('aria-pressed', String(isSelected));
    button.setAttribute('aria-label', `${presentation.title}, ${presentation.subtitle}`);

    const logo = createElement('span', 'payment-method-mark', presentation.code);
    const copy = createElement('span', 'payment-method-copy');
    copy.append(
      createElement('strong', 'payment-method-name', presentation.title),
      createElement('small', 'payment-method-subtitle', presentation.subtitle)
    );
    const unit = getProviderUnitPrice(provider);
    const price = createElement('strong', 'payment-method-price', Number.isFinite(unit) ? formatPrice(unit) : '—');
    const radio = createElement('span', 'payment-method-radio');
    radio.setAttribute('aria-hidden', 'true');
    button.append(logo, copy, price, radio);

    button.addEventListener('click', () => {
      selectedProvider = provider;
      renderCheckoutMethods();
      updateSmsInfo();
    });
    elements.checkoutMethods.append(button);
  });

  if (!selectedProvider || !checkoutProviders.some(provider => provider.provider === selectedProvider.provider)) {
    selectedProvider = checkoutProviders[0];
    const first = elements.checkoutMethods.querySelector('.payment-method');
    if (first) {
      first.classList.add('active');
      first.setAttribute('aria-pressed', 'true');
    }
  }

  updateSmsInfo();
}

function getCurrentQuantity() {
  if (!checkoutProduct?.slider) return 1;
  const min = Math.max(1, parseInt(checkoutProduct.slider_min, 10) || 1);
  const max = Math.max(min, parseInt(checkoutProduct.slider_max, 10) || min);
  const value = parseInt(elements.checkoutQuantity.value, 10);
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function calculateCheckoutPrice() {
  if (!selectedProvider) return NaN;
  const unit = getProviderUnitPrice(selectedProvider);
  if (!Number.isFinite(unit)) return NaN;

  const quantity = getCurrentQuantity();
  let total = unit * quantity;

  if (Number(checkoutProduct?.promo) > 0) {
    total *= 1 - Number(checkoutProduct.promo) / 100;
  } else if (checkoutDiscount?.discount > 0) {
    total *= 1 - checkoutDiscount.discount / 100;
  }

  return total;
}

function updateCheckoutTotal() {
  checkoutQuantity = getCurrentQuantity();
  elements.checkoutQuantityValue.textContent = String(checkoutQuantity);
  elements.checkoutTotal.textContent = Number.isFinite(calculateCheckoutPrice())
    ? formatPrice(calculateCheckoutPrice())
    : 'Cena niedostępna';

  const nickValid = isValidMinecraftNick(elements.checkoutNick.value.trim());
  const rulesValid = elements.checkoutRulesWrap.hidden || elements.checkoutRulesAccepted.checked;
  const smsValid = !selectedProvider || !isSmsProvider(selectedProvider) || elements.checkoutSmsCode.value.trim().length > 0;
  const priceValid = Number.isFinite(calculateCheckoutPrice());
  elements.checkoutSubmit.disabled = checkoutBusy || !shopIsOnline || !selectedProvider || !nickValid || !rulesValid || !smsValid || !priceValid;
}

function updateSmsInfo() {
  const sms = selectedProvider && isSmsProvider(selectedProvider);
  elements.checkoutSmsInfo.hidden = !sms;
  if (!sms) {
    elements.checkoutSmsCode.value = '';
    updateCheckoutTotal();
    return;
  }

  const number = getSmsNumber(selectedProvider);
  elements.checkoutSmsNumber.textContent = number?.number || 'Brak numeru SMS';
  elements.checkoutSmsContent.textContent = number?.sms_content || selectedProvider.sms_content || 'Brak treści SMS';
  elements.checkoutSmsPrice.textContent = number?.price != null ? formatPrice(number.price) : '—';
  updateCheckoutTotal();
}

function isValidMinecraftNick(nick) {
  return /^\.?\w{3,16}$/.test(nick);
}

function setCheckoutMessage(message, type = 'error') {
  elements.checkoutMessage.textContent = message || '';
  elements.checkoutMessage.className = `form-message${type === 'success' ? ' success' : ''}`;
}

function setDiscountMessage(message, type = 'error') {
  elements.checkoutDiscountMessage.textContent = message || '';
  elements.checkoutDiscountMessage.className = `checkout-inline-message${type === 'success' ? ' success' : ''}`;
}

async function applyDiscountCode() {
  if (!checkoutProduct || Number(checkoutProduct.promo) > 0) return;

  const code = elements.checkoutDiscountCode.value.trim();
  if (!code) {
    setDiscountMessage('Wpisz kod rabatowy.');
    return;
  }

  elements.applyDiscount.disabled = true;
  setDiscountMessage('Sprawdzanie kodu...');

  try {
    const result = await fetchJson(`${CONFIG.apiBase}codes/use/`, {
      method: 'POST',
      body: JSON.stringify({ code, product: checkoutProduct.id })
    });

    if (!result || !Number.isFinite(Number(result.discount))) throw new Error('VIshop nie zwrócił poprawnej wartości rabatu.');
    checkoutDiscount = { code, discount: Number(result.discount) };
    setDiscountMessage(`Kod został zastosowany: -${checkoutDiscount.discount}%.`, 'success');
    updateCheckoutTotal();
  } catch (error) {
    checkoutDiscount = null;
    setDiscountMessage(error.message || 'Nie udało się zastosować kodu.');
    updateCheckoutTotal();
  } finally {
    elements.applyDiscount.disabled = false;
  }
}

function buildPaymentStatusUrl(paymentId) {
  const url = new URL(window.location.href);
  url.searchParams.delete('server');
  url.searchParams.set('payment', paymentId);
  return url.toString();
}

async function submitCheckout(event) {
  event.preventDefault();
  if (checkoutBusy) return;

  const player = elements.checkoutNick.value.trim();
  if (!isValidMinecraftNick(player)) {
    setCheckoutMessage('Podaj prawidłowy nick Minecraft (3–16 znaków, litery, cyfry i podkreślenie).');
    elements.checkoutNick.focus();
    return;
  }
  if (!selectedProvider) {
    setCheckoutMessage('Wybierz metodę płatności.');
    return;
  }
  if (!elements.checkoutRulesWrap.hidden && !elements.checkoutRulesAccepted.checked) {
    setCheckoutMessage('Zaakceptuj regulamin sklepu.');
    return;
  }
  if (isSmsProvider(selectedProvider) && !elements.checkoutSmsCode.value.trim()) {
    setCheckoutMessage('Wpisz kod otrzymany w odpowiedzi SMS.');
    elements.checkoutSmsCode.focus();
    return;
  }
  if (!shopIsOnline) {
    setCheckoutMessage('Sklep jest obecnie wyłączony.');
    return;
  }

  const body = {
    player,
    provider: selectedProvider.provider,
    success_page: buildPaymentStatusUrl('{PAYMENT_ID}')
  };

  if (checkoutProduct.slider === true) body.quantity = getCurrentQuantity();
  if (checkoutDiscount?.code && Number(checkoutProduct.promo) <= 0) body.promo_code = checkoutDiscount.code;
  if (isSmsProvider(selectedProvider)) body.sms_code = elements.checkoutSmsCode.value.trim();

  checkoutBusy = true;
  elements.checkoutSubmit.disabled = true;
  elements.checkoutSubmit.textContent = 'TWORZENIE PŁATNOŚCI...';
  setCheckoutMessage('Przygotowywanie płatności. Nie zamykaj tego okna.');

  try {
    const result = await fetchJson(`${CONFIG.apiBase}products/${encodeURIComponent(checkoutProduct.id)}/payments/`, {
      method: 'POST',
      body: JSON.stringify(body)
    });

    if (!result?.id) throw new Error('VIshop nie zwrócił identyfikatora płatności.');

    if (isSmsProvider(selectedProvider)) {
      window.location.assign(buildPaymentStatusUrl(result.id));
      return;
    }

    if (!result.payment_url) throw new Error('Nie udało się wygenerować adresu płatności.');
    const paymentUrl = new URL(result.payment_url, window.location.origin);
    if (paymentUrl.protocol !== 'https:' && paymentUrl.hostname !== window.location.hostname) {
      throw new Error('Operator zwrócił niebezpieczny adres płatności.');
    }

    window.location.assign(paymentUrl.toString());
  } catch (error) {
    console.error('Błąd tworzenia płatności:', error);
    setCheckoutMessage(error.message || 'Nie udało się utworzyć płatności.');
    checkoutBusy = false;
    elements.checkoutSubmit.textContent = 'PRZEJDŹ DO PŁATNOŚCI';
    updateCheckoutTotal();
  }
}

function closeCheckout() {
  if (checkoutBusy) return;
  elements.checkoutModal.hidden = true;
  document.body.classList.remove('checkout-open');
}

/* =========================================================
   STATUS PŁATNOŚCI
========================================================= */

function showPaymentStatus(data) {
  const status = String(data?.status || data?.payment_status || '').toLowerCase();
  const paid = ['paid', 'completed', 'success', 'finished'].includes(status);
  const failed = ['failed', 'cancelled', 'canceled', 'expired', 'rejected'].includes(status);

  elements.paymentStatusIcon.textContent = paid ? '✓' : failed ? '!' : '…';
  elements.paymentStatusTitle.textContent = paid
    ? 'Płatność zakończona'
    : failed
      ? 'Płatność nie została zakończona'
      : 'Oczekiwanie na płatność';

  elements.paymentStatusDescription.textContent = paid
    ? 'Dziękujemy za zakup! Jeżeli produkt nie został jeszcze przyznany, poczekaj chwilę.'
    : failed
      ? 'Płatność nie została potwierdzona. Możesz wrócić do sklepu i spróbować ponownie.'
      : 'Oczekujemy na potwierdzenie płatności od operatora.';

  elements.paymentStatusDetails.replaceChildren();

  const rows = [
    ['Numer zamówienia', data.id || data.payment_id || activePaymentId],
    ['Status', data.status || data.payment_status || 'Nieznany'],
    ['Nick', data.player || data.username],
    ['Kwota', data.amount !== undefined ? formatPrice(data.amount) : null]
  ].filter(([, value]) => value !== undefined && value !== null && value !== '');

  rows.forEach(([label, value]) => {
    const row = createElement('div', 'payment-status-row');
    row.append(
      createElement('span', '', label),
      createElement('strong', '', String(value))
    );
    elements.paymentStatusDetails.append(row);
  });

  elements.paymentStatusDetails.hidden = rows.length === 0;
}

async function refreshPaymentStatus() {
  const params = new URLSearchParams(window.location.search);
  const paymentId = params.get('payment') || activePaymentId;

  if (!paymentId) {
    elements.paymentStatusMessage.textContent = 'Nie znaleziono numeru zamówienia.';
    return;
  }

  elements.refreshPaymentStatus.disabled = true;
  elements.paymentStatusMessage.textContent = 'Sprawdzanie statusu...';

  try {
    const data = await fetchJson(`${CONFIG.apiBase}payments/${encodeURIComponent(paymentId)}/`);
    showPaymentStatus(data);
    elements.paymentStatusMessage.textContent = '';
  } catch (error) {
    elements.paymentStatusMessage.textContent = error.message;
  } finally {
    elements.refreshPaymentStatus.disabled = false;
  }
}

/* =========================================================
   VOUCHERY
========================================================= */

async function redeemVoucher(event) {
  event.preventDefault();

  const player = elements.voucherNick.value.trim();
  const code = elements.voucherCode.value.trim();

  if (!isValidMinecraftNick(player)) {
    elements.voucherMessage.textContent = 'Podaj prawidłowy nick Minecraft.';
    return;
  }

  if (!code) {
    elements.voucherMessage.textContent = 'Wpisz kod vouchera.';
    return;
  }

  const button = elements.voucherForm.querySelector('button[type="submit"]');
  button.disabled = true;
  elements.voucherMessage.textContent = 'Sprawdzanie vouchera...';
  elements.voucherMessage.classList.remove('success');

  try {
    const result = await fetchJson(`${CONFIG.apiBase}vouchers/redeem/`, {
      method: 'POST',
      body: JSON.stringify({ player, code })
    });

    elements.voucherMessage.textContent = result?.message || 'Voucher został zrealizowany.';
    elements.voucherMessage.classList.add('success');
  } catch (error) {
    elements.voucherMessage.textContent = error.message || 'Nie udało się zrealizować vouchera.';
  } finally {
    button.disabled = false;
  }
}

function openVoucherModal() {
  elements.voucherModal.hidden = false;
  elements.voucherNick.focus();
}

function closeVoucherModal() {
  elements.voucherModal.hidden = true;
}

/* =========================================================
   MENU, HISTORIA I OBSŁUGA ZDARZEŃ
========================================================= */

function setupMenu() {
  if (!elements.hamburger || !elements.menu) return;

  const toggle = () => {
    const open = elements.menu.classList.toggle('open');
    elements.hamburger.setAttribute('aria-expanded', String(open));
  };

  elements.hamburger.addEventListener('click', toggle);
  elements.hamburger.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggle();
    }
  });

  elements.menu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      elements.menu.classList.remove('open');
      elements.hamburger.setAttribute('aria-expanded', 'false');
    });
  });
}

function handleHistoryChange() {
  const params = new URLSearchParams(window.location.search);
  const paymentId = params.get('payment');
  const serverId = params.get('server');

  if (paymentId) {
    activePaymentId = paymentId;
    setPageMode('status');
    refreshPaymentStatus();
    return;
  }

  if (serverId) {
    const server = CONFIG.servers.find(item => String(item.id) === serverId);
    if (server) {
      selectServer(server, false);
      return;
    }
  }

  setPageMode('servers');
}

function setupEvents() {
  elements.changeServer?.addEventListener('click', () => {
    currentServer = null;
    updateAddressBar(null);
    setPageMode('servers');
  });

  elements.closeCheckout?.addEventListener('click', closeCheckout);
  elements.checkoutModal?.addEventListener('click', event => {
    if (event.target === elements.checkoutModal) closeCheckout();
  });

  elements.checkoutForm?.addEventListener('submit', submitCheckout);
  elements.checkoutNick?.addEventListener('input', updateCheckoutTotal);
  elements.checkoutQuantity?.addEventListener('input', updateCheckoutTotal);
  elements.checkoutRulesAccepted?.addEventListener('change', updateCheckoutTotal);
  elements.checkoutSmsCode?.addEventListener('input', updateCheckoutTotal);
  elements.applyDiscount?.addEventListener('click', applyDiscountCode);

  elements.openVoucher?.addEventListener('click', openVoucherModal);
  elements.closeVoucher?.addEventListener('click', closeVoucherModal);
  elements.voucherForm?.addEventListener('submit', redeemVoucher);

  elements.voucherModal?.addEventListener('click', event => {
    if (event.target === elements.voucherModal) closeVoucherModal();
  });

  elements.refreshPaymentStatus?.addEventListener('click', refreshPaymentStatus);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeCheckout();
      closeVoucherModal();
    }
  });

  window.addEventListener('popstate', handleHistoryChange);
}

/* =========================================================
   START SKLEPU
========================================================= */

async function initShop() {
  applyDescriptionStyles();
  setupMenu();
  setupEvents();
  renderServers();

  await loadShopInfo();

  if (!shopIsOnline) {
    showNotice('Sklep jest obecnie wyłączony.');
  }

  const params = new URLSearchParams(window.location.search);
  const paymentId = params.get('payment');
  const serverId = params.get('server');

  if (paymentId) {
    activePaymentId = paymentId;
    setPageMode('status');
    await refreshPaymentStatus();
    return;
  }

  if (serverId) {
    const server = CONFIG.servers.find(item => String(item.id) === serverId);
    if (server) {
      await selectServer(server, false);
      return;
    }
  }

  setPageMode('servers');
}

document.addEventListener('DOMContentLoaded', initShop);
    if (paymentUrl.protocol !== 'https:') throw new Error('VIshop zwrócił nieprawidłowy adres płatności.');
    window.location.assign(paymentUrl.toString());
  } catch (error) {
    console.error('Błąd tworzenia płatności:', error);
    setCheckoutMessage(error.message || 'Nie udało się utworzyć płatności.');
    checkoutBusy = false;
    elements.checkoutSubmit.textContent = 'SPRÓBUJ PONOWNIE';
    updateCheckoutTotal();
  }
}

function closeCheckout() {
  elements.checkoutModal.hidden = true;
  document.body.classList.remove('checkout-open');
  checkoutBusy = false;
}

/* =========================================================
   STATUS PŁATNOŚCI
========================================================= */

async function loadPaymentStatus(paymentId) {
  activePaymentId = paymentId;
  setPageMode('status');
  elements.paymentStatusIcon.textContent = '…';
  elements.paymentStatusTitle.textContent = 'Sprawdzanie płatności...';
  elements.paymentStatusDescription.textContent = 'Pobieramy aktualny status zamówienia.';
  elements.paymentStatusDetails.hidden = true;
  elements.paymentStatusMessage.textContent = '';
  elements.refreshPaymentStatus.disabled = true;

  try {
    const data = await fetchJson(`${CONFIG.apiBase}payment-status/${encodeURIComponent(paymentId)}/`);
    const status = String(data.status || '').toLowerCase();

    if (status === 'waiting') {
      elements.paymentStatusIcon.textContent = '…';
      elements.paymentStatusTitle.textContent = 'Oczekujemy na płatność';
      elements.paymentStatusDescription.textContent = 'Nie otrzymaliśmy jeszcze potwierdzenia od operatora. Po opłaceniu zamówienia jego realizacja rozpocznie się automatycznie.';
    } else if (status === 'canceled') {
      elements.paymentStatusIcon.textContent = '×';
      elements.paymentStatusTitle.textContent = 'Zamówienie anulowane';
      elements.paymentStatusDescription.textContent = 'Ta transakcja została anulowana. W razie problemów skontaktuj się z administracją serwera.';
    } else if (status === 'executing') {
      elements.paymentStatusIcon.textContent = '✓';
      elements.paymentStatusTitle.textContent = 'Płatność potwierdzona';
      elements.paymentStatusDescription.textContent = 'Płatność została potwierdzona. Zamówienie oczekuje na realizację przez serwer.';
    } else if (status === 'executed') {
      elements.paymentStatusIcon.textContent = '✓';
      elements.paymentStatusTitle.textContent = 'Zamówienie zrealizowane';
      elements.paymentStatusDescription.textContent = 'Płatność została potwierdzona, a zamówienie zrealizowane.';
    } else {
      elements.paymentStatusIcon.textContent = 'i';
      elements.paymentStatusTitle.textContent = 'Status zamówienia';
      elements.paymentStatusDescription.textContent = `Aktualny status: ${data.status || 'nieznany'}.`;
    }

    const details = [
      ['Gracz', data.player],
      ['Produkt', data.product_name],
      ['Ilość', data.quantity],
      ['Status', data.status]
    ].filter(([, value]) => value !== null && value !== undefined && value !== '');

    elements.paymentStatusDetails.replaceChildren();
    details.forEach(([label, value]) => {
      const row = createElement('div', 'payment-status-row');
      row.append(createElement('span', '', label), createElement('strong', '', String(value)));
      elements.paymentStatusDetails.append(row);
    });
    elements.paymentStatusDetails.hidden = details.length === 0;
  } catch (error) {
    elements.paymentStatusIcon.textContent = '!';
    elements.paymentStatusTitle.textContent = 'Nie udało się sprawdzić statusu';
    elements.paymentStatusDescription.textContent = 'Spróbuj ponownie za chwilę. Identyfikator zamówienia pozostaje w adresie strony.';
    elements.paymentStatusMessage.textContent = error.message || 'Błąd pobierania statusu.';
  } finally {
    elements.refreshPaymentStatus.disabled = false;
  }
}

/* =========================================================
   VOUCHERY
========================================================= */

function openVoucher() {
  elements.voucherModal.hidden = false;
  document.body.classList.add('checkout-open');
}

function closeVoucher() {
  elements.voucherModal.hidden = true;
  document.body.classList.remove('checkout-open');
}

async function submitVoucher(event) {
  event.preventDefault();
  const player = elements.voucherNick.value.trim();
  const code = elements.voucherCode.value.trim();

  if (!isValidMinecraftNick(player)) {
    elements.voucherMessage.textContent = 'Podaj prawidłowy nick Minecraft.';
    return;
  }
  if (!code) {
    elements.voucherMessage.textContent = 'Wpisz kod vouchera.';
    return;
  }

  const button = elements.voucherForm.querySelector('button[type="submit"]');
  button.disabled = true;
  elements.voucherMessage.textContent = 'Sprawdzanie vouchera...';
  elements.voucherMessage.className = 'form-message';

  try {
    await fetchJson(`${CONFIG.apiBase}vouchers/use/`, {
      method: 'POST',
      body: JSON.stringify({ code, player })
    });
    elements.voucherMessage.textContent = 'Voucher został zrealizowany. Sprawdź swoje konto na serwerze.';
    elements.voucherMessage.className = 'form-message success';
  } catch (error) {
    elements.voucherMessage.textContent = error.message || 'Nie udało się zrealizować vouchera.';
    elements.voucherMessage.className = 'form-message';
  } finally {
    button.disabled = false;
  }
}

/* =========================================================
   NAWIGACJA I ZDARZENIA
========================================================= */

function setupNavigation() {
  elements.hamburger.addEventListener('click', () => {
    const isOpen = elements.menu.classList.toggle('open');
    elements.hamburger.setAttribute('aria-expanded', String(isOpen));
  });

  elements.hamburger.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      elements.hamburger.click();
    }
  });

  elements.menu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      elements.menu.classList.remove('open');
      elements.hamburger.setAttribute('aria-expanded', 'false');
    });
  });

  elements.changeServer.addEventListener('click', () => showServerList(true));

  window.addEventListener('popstate', () => {
    const params = new URLSearchParams(window.location.search);
    const paymentId = params.get('payment');
    if (paymentId) {
      loadPaymentStatus(paymentId);
      return;
    }
    const id = params.get('server');
    const server = CONFIG.servers.find(item => String(item.id) === String(id));
    if (server) selectServer(server, false);
    else showServerList(false);
  });

  elements.checkoutForm.addEventListener('submit', submitCheckout);
  elements.closeCheckout.addEventListener('click', closeCheckout);
  elements.checkoutModal.addEventListener('click', event => {
    if (event.target === elements.checkoutModal) closeCheckout();
  });
  elements.checkoutNick.addEventListener('input', updateCheckoutTotal);
  elements.checkoutQuantity.addEventListener('input', updateCheckoutTotal);
  elements.checkoutSmsCode.addEventListener('input', updateCheckoutTotal);
  elements.checkoutRulesAccepted.addEventListener('change', updateCheckoutTotal);
  elements.applyDiscount.addEventListener('click', applyDiscountCode);

  elements.closeVoucher.addEventListener('click', closeVoucher);
  elements.voucherModal.addEventListener('click', event => {
    if (event.target === elements.voucherModal) closeVoucher();
  });
  elements.voucherForm.addEventListener('submit', submitVoucher);
  elements.refreshPaymentStatus.addEventListener('click', () => {
    if (activePaymentId) loadPaymentStatus(activePaymentId);
  });

  if (elements.openVoucher) elements.openVoucher.addEventListener('click', openVoucher);

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (!elements.checkoutModal.hidden) closeCheckout();
    if (!elements.voucherModal.hidden) closeVoucher();
  });
}

function showServerList(updateHistory = true) {
  currentServer = null;
  currentProducts = [];
  selectedCategory = 'all';
  setPageMode('servers');
  if (updateHistory) updateAddressBar(null);
}

/* =========================================================
   DROBNE POPRAWKI WYGLĄDU CHECKOUTU — BEZ ZMIAN W HTML
========================================================= */

function injectCheckoutPresentationStyles() {
  const oldDescription = elements.checkoutProductDescription;
  if (oldDescription && oldDescription.tagName === 'P') {
    const replacement = document.createElement('div');
    replacement.id = oldDescription.id;
    replacement.className = oldDescription.className;
    oldDescription.replaceWith(replacement);
    elements.checkoutProductDescription = replacement;
  }

  if (document.getElementById('polskiemc-checkout-js-styles')) return;
  const style = document.createElement('style');
  style.id = 'polskiemc-checkout-js-styles';
  style.textContent = `
    .checkout-product-copy strong { font-size: 21px !important; line-height: 1.3 !important; }
    .checkout-description-scroll, .product-description-scroll {
      display: block; min-height: 0 !important; max-height: 145px; overflow-y: auto; overflow-x: hidden;
      padding: 10px 12px; border: 1px solid rgba(255,255,255,.09); border-radius: 9px;
      background: rgba(0,0,0,.20); color: #c7c7c7; line-height: 1.75;
      scrollbar-width: thin; scrollbar-color: #d61841 rgba(255,255,255,.06);
      overflow-wrap: anywhere; white-space: normal;
    }
    .checkout-description-scroll p, .product-description-scroll p { margin: 0 0 8px; }
    .checkout-description-scroll p:last-child, .product-description-scroll p:last-child { margin-bottom: 0; }
    .checkout-description-scroll ul, .checkout-description-scroll ol,
    .product-description-scroll ul, .product-description-scroll ol { margin: 5px 0 8px; padding-left: 22px; }
    .checkout-description-scroll strong, .product-description-scroll strong { color: #fff; font-weight: 800; }
    .checkout-description-scroll code, .product-description-scroll code {
      padding: 2px 5px; border-radius: 4px; background: rgba(255,255,255,.09); color: #fff;
    }
    .product-name { font-size: 22px !important; line-height: 1.35 !important; }
    .checkout-payment-options { display: grid !important; grid-template-columns: repeat(auto-fit,minmax(145px,1fr)); gap: 10px !important; }
    .checkout-payment-options .payment-method {
      position: relative; min-height: 82px; display: grid; grid-template-columns: 38px minmax(0,1fr) 12px;
      grid-template-rows: auto auto; align-items: center; column-gap: 10px;
      padding: 13px 12px; border: 1px solid rgba(255,255,255,.13); border-radius: 11px;
      background: #19191f; color: #fff; text-align: left; transition: .2s ease;
    }
    .checkout-payment-options .payment-method:hover { transform: translateY(-2px); border-color: rgba(255,255,255,.32); background: #202027; }
    .checkout-payment-options .payment-method.active { border-color: #d61841; background: linear-gradient(135deg,rgba(214,24,65,.19),#19191f 75%); box-shadow: 0 0 0 1px rgba(214,24,65,.22),0 7px 18px rgba(0,0,0,.2); }
    .payment-method-mark { grid-row: 1 / 3; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; border-radius: 9px; background: rgba(255,255,255,.09); color: #fff; font-size: 11px; font-weight: 900; }
    .payment-method-paypal .payment-method-mark { background: rgba(0,112,186,.2); color: #67baff; }
    .payment-method-blik .payment-method-mark { background: rgba(214,24,65,.18); color: #ff7894; }
    .payment-method-psc .payment-method-mark { background: rgba(245,196,0,.16); color: #f5d45e; }
    .payment-method-copy { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
    .payment-method-copy .payment-method-name { color: #fff; font-size: 12px; font-weight: 900; }
    .payment-method-subtitle { color: #92929b; font-size: 9px; line-height: 1.35; }
    .checkout-payment-options .payment-method-price { grid-column: 2 / 3; color: #c7c7ce; font-size: 11px; font-weight: 700; }
    .payment-method-radio { grid-column: 3; grid-row: 1 / 3; width: 12px; height: 12px; border: 2px solid #777; border-radius: 50%; }
    .payment-method.active .payment-method-radio { border-color: #d61841; background: #d61841; box-shadow: inset 0 0 0 2px #19191f; }
    @media(max-width:600px) {
      .checkout-product-copy strong { font-size: 18px !important; }
      .checkout-payment-options { grid-template-columns: repeat(2,minmax(0,1fr)); }
      .checkout-payment-options .payment-method { grid-template-columns: 32px minmax(0,1fr) 10px; padding: 10px 8px; }
      .payment-method-mark { width: 32px; height: 32px; font-size: 9px; }
      .payment-method-copy .payment-method-name { font-size: 11px; }
      .payment-method-subtitle { font-size: 8px; }
    }
  `;
  document.head.append(style);
}

/* =========================================================
   START
========================================================= */

async function init() {
  injectCheckoutPresentationStyles();
  setupNavigation();
  renderServers();
  await loadShopInfo();

  const params = new URLSearchParams(window.location.search);
  const paymentId = params.get('payment');
  if (paymentId) {
    await loadPaymentStatus(paymentId);
    return;
  }

  const requestedServerId = params.get('server');
  const requestedServer = CONFIG.servers.find(server => String(server.id) === String(requestedServerId));
  if (requestedServer) await selectServer(requestedServer, false);
  else setPageMode('servers');
}

init().catch(error => {
  console.error('Nie udało się uruchomić sklepu:', error);
  showNotice('Wystąpił nieoczekiwany błąd podczas uruchamiania sklepu.');
});
