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
