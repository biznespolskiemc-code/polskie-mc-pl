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
  checkoutTitleProduct: document.getElementById('checkoutTitleProduct'),
  checkoutProductImage: document.getElementById('checkoutProductImage'),
  checkoutProductName: document.getElementById('checkoutProductName'),
  checkoutProductServer: document.getElementById('checkoutProductServer'),
  checkoutProductDescription: document.getElementById('checkoutProductDescription'),
  checkoutNick: document.getElementById('checkoutNick'),
  checkoutQuantityWrap: document.getElementById('checkoutQuantityWrap'),
  checkoutQuantityLabel: document.getElementById('checkoutQuantityLabel'),
  checkoutQuantityNumber: document.getElementById('checkoutQuantityNumber'),
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

  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li)\s*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '» ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\*\*/g, '')
    .replace(/\\[ \t]*\r?\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(line => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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
  return createElement('p', 'product-description', description.length > 110 ? 'Wybierz, aby zobaczyć więcej informacji' : description);
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
  elements.checkoutTitleProduct.textContent = String(product.name || 'PRODUKT').toLocaleUpperCase('pl-PL');
  elements.checkoutProductName.textContent = product.name || 'Produkt';
  elements.checkoutProductServer.textContent = currentServer ? currentServer.name : '';
  elements.checkoutProductDescription.textContent = product.short_description || getProductDescription(product);
  elements.checkoutProductImage.src = product.image || '../images/polskiemc.png';
  elements.checkoutProductImage.onerror = () => { elements.checkoutProductImage.src = '../images/polskiemc.png'; };
  configureQuantity(product);
  configureRules();

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

    elements.checkoutTitleProduct.textContent = String(details.name || product.name || 'PRODUKT').toLocaleUpperCase('pl-PL');
    elements.checkoutProductName.textContent = details.name || product.name || 'Produkt';
    elements.checkoutProductServer.textContent = currentServer ? currentServer.name : '';
    elements.checkoutProductDescription.textContent = details.short_description || getProductDescription(details);
    configureQuantity(details);
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
  elements.checkoutSubmit.textContent = 'ZAKUP';
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
  elements.checkoutQuantityNumber.min = String(min);
  elements.checkoutQuantityNumber.max = String(max);
  elements.checkoutQuantityNumber.value = String(min);
  elements.checkoutQuantityMin.textContent = String(min);
  elements.checkoutQuantityMax.textContent = String(max);
  elements.checkoutQuantityValue.textContent = String(min);
  elements.checkoutQuantityValue.style.left = '0%';
  elements.checkoutQuantity.style.setProperty('--range-progress', '0%');
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

function renderCheckoutMethods() {
  elements.checkoutMethods.replaceChildren();

  if (!checkoutProviders.length) {
    elements.checkoutMethods.append(createElement('div', 'empty-state', 'Brak dostępnych metod płatności dla tego produktu.'));
    selectedProvider = null;
    updateCheckoutTotal();
    return;
  }

  checkoutProviders.forEach(provider => {
    const button = createElement('button', `payment-method${selectedProvider?.id === provider.id ? ' active' : ''}`);
    button.type = 'button';
    button.setAttribute('aria-pressed', String(selectedProvider?.id === provider.id));

    const name = createElement('span', 'payment-method-name', provider.name || provider.provider);
    const unit = getProviderUnitPrice(provider);
    const price = createElement('strong', 'payment-method-price', Number.isFinite(unit) ? formatPrice(unit) : '—');
    button.append(name, price);

    if (isSmsProvider(provider)) {
      button.append(createElement('small', 'payment-method-note', 'Płatność SMS'));
    }

    button.addEventListener('click', () => {
      selectedProvider = provider;
      renderCheckoutMethods();
      updateCheckoutTotal();
      updateSmsInfo();
    });

    elements.checkoutMethods.append(button);
  });

  if (!selectedProvider && checkoutProviders.length) {
    selectedProvider = checkoutProviders[0];
    renderCheckoutMethods();
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
  if (elements.checkoutQuantityNumber) elements.checkoutQuantityNumber.value = String(checkoutQuantity);
  if (elements.checkoutQuantity && !elements.checkoutQuantityWrap.hidden) {
    const min = Number(elements.checkoutQuantity.min) || 1;
    const max = Number(elements.checkoutQuantity.max) || min;
    const progress = max > min ? ((checkoutQuantity - min) / (max - min)) * 100 : 0;
    elements.checkoutQuantity.style.setProperty('--range-progress', `${progress}%`);
    elements.checkoutQuantityValue.style.left = `${progress}%`;
  }
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

  const enteredDiscountCode = elements.checkoutDiscountCode.value.trim();
  if (enteredDiscountCode && Number(checkoutProduct.promo) <= 0 && checkoutDiscount?.code !== enteredDiscountCode) {
    checkoutBusy = true;
    elements.checkoutSubmit.disabled = true;
    elements.checkoutSubmit.textContent = 'SPRAWDZANIE KODU...';
    await applyDiscountCode();

    if (checkoutDiscount?.code !== enteredDiscountCode) {
      checkoutBusy = false;
      setCheckoutMessage('Nie udało się zastosować kodu rabatowego. Sprawdź go i spróbuj ponownie.');
      updateCheckoutTotal();
      return;
    }

    checkoutBusy = false;
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
  elements.checkoutQuantityNumber.addEventListener('input', () => {
    const min = Number(elements.checkoutQuantity.min) || 1;
    const max = Number(elements.checkoutQuantity.max) || min;
    const entered = Number.parseInt(elements.checkoutQuantityNumber.value, 10);
    if (!Number.isFinite(entered)) return;
    elements.checkoutQuantity.value = String(Math.min(max, Math.max(min, entered)));
    updateCheckoutTotal();
  });
  elements.checkoutQuantityNumber.addEventListener('change', () => {
    const min = Number(elements.checkoutQuantity.min) || 1;
    const max = Number(elements.checkoutQuantity.max) || min;
    const entered = Number.parseInt(elements.checkoutQuantityNumber.value, 10);
    const safeValue = Number.isFinite(entered) ? Math.min(max, Math.max(min, entered)) : min;
    elements.checkoutQuantity.value = String(safeValue);
    updateCheckoutTotal();
  });
  elements.checkoutSmsCode.addEventListener('input', updateCheckoutTotal);
  elements.checkoutRulesAccepted.addEventListener('change', updateCheckoutTotal);
  elements.applyDiscount.addEventListener('click', applyDiscountCode);
  elements.checkoutDiscountCode.addEventListener('input', () => {
    const code = elements.checkoutDiscountCode.value.trim();
    if (!code || (checkoutDiscount && checkoutDiscount.code !== code)) {
      checkoutDiscount = null;
      elements.checkoutDiscountMessage.textContent = '';
      elements.checkoutDiscountMessage.className = 'checkout-inline-message';
      updateCheckoutTotal();
    }
  });

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
   START
========================================================= */

async function init() {
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
