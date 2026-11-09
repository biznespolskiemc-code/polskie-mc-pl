
'use strict';

/* =========================================================
   KONFIGURACJA POLSKIEMC.PL
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

/* =========================================================
   ELEMENTY STRONY
========================================================= */

const elements = {
  serverView: document.getElementById('serverView'),
  serverGrid: document.getElementById('serverGrid'),
  productsView: document.getElementById('productsView'),
  productsGrid: document.getElementById('productsGrid'),
  categoryBar: document.getElementById('categoryBar'),
  currentServerName: document.getElementById('currentServerName'),
  serverTitleAccent: document.getElementById('serverTitleAccent'),
  notice: document.getElementById('notice'),
  changeServer: document.getElementById('changeServer'),
  backToServers: document.getElementById('backToServers'),
  hamburger: document.getElementById('hamburger'),
  menu: document.getElementById('menu'),
};

let shopData = null;
let currencyCode = 'PLN';
let currentServer = null;
let currentProducts = [];
let currentCategories = [];
let selectedCategory = 'all';
let shopIsOnline = true;

/* =========================================================
   POWIADOMIENIA
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

/* =========================================================
   API
========================================================= */

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  const text = await response.text();
  let data;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const message = typeof data === 'string'
      ? data
      : `Błąd API (${response.status}).`;

    throw new Error(message || `Błąd API (${response.status}).`);
  }

  return data;
}

async function loadShopInfo() {
  try {
    shopData = await fetchJson(CONFIG.apiBase);

    if (shopData && typeof shopData === 'object') {
      currencyCode = shopData.currency || 'PLN';
      shopIsOnline = shopData.online !== false;

      currentCategories = Array.isArray(shopData.categories)
        ? shopData.categories
        : [];
    }
  } catch (error) {
    console.warn('Nie udało się pobrać informacji o sklepie VIshop:', error);
  }
}

/* =========================================================
   FORMATOWANIE CEN
========================================================= */

function formatPrice(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return 'Cena niedostępna';
  }

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

/* =========================================================
   TWORZENIE ELEMENTÓW
========================================================= */

function createElement(tag, className, text) {
  const node = document.createElement(tag);

  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;

  return node;
}

/* =========================================================
   LISTA TRYBÓW
========================================================= */

function renderServers() {
  elements.serverGrid.replaceChildren();

  CONFIG.servers.forEach((server) => {
    const card = createElement('article', 'server-card');

    const imageWrap = createElement('div', 'server-image-wrap');
    const image = document.createElement('img');

    image.src = server.image;
    image.alt = server.name;
    image.loading = 'lazy';
    image.onerror = () => {
      image.style.visibility = 'hidden';
    };

    imageWrap.append(image);

    const name = createElement('h3', 'server-name', server.name);

    const description = createElement(
      'p',
      'server-description',
      server.description
    );

    description.hidden = true;

    const button = createElement(
      'button',
      'primary-button',
      'WYBIERZ TRYB'
    );

    button.type = 'button';
    button.addEventListener('click', () => selectServer(server));

    card.append(imageWrap, name, description, button);
    elements.serverGrid.append(card);
  });
}

/* =========================================================
   PRZEŁĄCZANIE WIDOKÓW
========================================================= */

function setPageMode(mode) {
  const showServers = mode === 'servers';

  elements.serverView.hidden = !showServers;
  elements.productsView.hidden = showServers;

  clearNotice();

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}

/* =========================================================
   ADRES STRONY
========================================================= */

function updateAddressBar(serverId = null, replace = false) {
  const url = new URL(window.location.href);

  if (serverId === null) {
    url.searchParams.delete('server');
  } else {
    url.searchParams.set('server', String(serverId));
  }

  if (replace) {
    window.history.replaceState({}, '', url);
  } else {
    window.history.pushState({}, '', url);
  }
}

/* =========================================================
   WYBÓR TRYBU
========================================================= */

async function selectServer(server, updateHistory = true) {
  currentServer = server;
  selectedCategory = 'all';

  elements.currentServerName.textContent = server.name;
  elements.serverTitleAccent.textContent = `${server.name}.`;

  setPageMode('products');

  elements.productsGrid.replaceChildren(
    createElement('div', 'loading-card', 'Ładowanie produktów...')
  );

  elements.categoryBar.hidden = true;

  if (updateHistory) {
    updateAddressBar(server.id);
  }

  try {
    const data = await fetchJson(
      `${CONFIG.apiBase}products/?server=${encodeURIComponent(server.id)}`
    );

    if (!Array.isArray(data)) {
      throw new Error('VIshop zwrócił nieprawidłową listę produktów.');
    }

    currentProducts = data.filter(
      (product) => product && product.hidden !== true
    );

    renderCategories();
    renderProducts();

  } catch (error) {
    console.error('Błąd pobierania produktów:', error);

    elements.productsGrid.replaceChildren(
      createElement(
        'div',
        'empty-state',
        'Nie udało się pobrać produktów. Odśwież stronę lub spróbuj ponownie później.'
      )
    );

    showNotice(`Błąd połączenia z VIshop: ${error.message}`);
  }
}

/* =========================================================
   KATEGORIE
========================================================= */

function renderCategories() {
  elements.categoryBar.replaceChildren();

  const availableIds = new Set(
    currentProducts.map((product) => String(product.category))
  );

  const categories = currentCategories.filter(
    (category) => availableIds.has(String(category.id))
  );

  if (!categories.length) {
    elements.categoryBar.hidden = true;
    return;
  }

  elements.categoryBar.hidden = false;

  const allButton = createElement(
    'button',
    `category-button${selectedCategory === 'all' ? ' active' : ''}`,
    'Wszystkie'
  );

  allButton.type = 'button';

  allButton.addEventListener('click', () => {
    selectedCategory = 'all';
    renderCategories();
    renderProducts();
  });

  elements.categoryBar.append(allButton);

  categories.forEach((category) => {
    const isActive = String(selectedCategory) === String(category.id);

    const button = createElement(
      'button',
      `category-button${isActive ? ' active' : ''}`,
      category.name
    );

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
   CENA PRODUKTU
========================================================= */

function getProductPrice(product) {
  const base = Number(product.main_price);
  const promo = Number(product.promo);

  const hasPromo =
    product.promo !== null &&
    product.promo !== undefined &&
    Number.isFinite(promo) &&
    promo > 0;

  const finalPrice = hasPromo
    ? base * (1 - promo / 100)
    : base;

  return {
    base,
    finalPrice,
    promo: hasPromo ? promo : null
  };
}

/* =========================================================
   OPIS PRODUKTU
========================================================= */

function getProductDescription(product) {
  const possibleDescriptions = [
    product.description,
    product.short_description,
    product.desc,
    product.details,
    product.content,
    product.info
  ];

  const value = possibleDescriptions.find(
    (item) => typeof item === 'string' && item.trim().length > 0
  );

  if (!value) {
    return 'Brak opisu produktu.';
  }

  return value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* =========================================================
   KARTA PRODUKTU
========================================================= */

function createProductCard(product) {
  const card = createElement('article', 'product-card');

  /* ZDJĘCIE */

  const imageWrap = createElement('div', 'product-image-wrap');
  const image = document.createElement('img');

  image.src = product.image || '../images/polskiemc.png';
  image.alt = product.name || 'Produkt';
  image.loading = 'lazy';

  image.onerror = () => {
    image.src = '../images/polskiemc.png';
  };

  imageWrap.append(image);

  /* NAZWA */

  const name = createElement(
    'h3',
    'product-name',
    product.name || 'Produkt'
  );

  /* OPIS ZAMIAST CENY */

  const description = createElement(
    'p',
    'product-description',
    getProductDescription(product)
  );

  /* CENA W PRZYCISKU */

  const price = getProductPrice(product);

  const buyButton = createElement(
    'button',
    'primary-button product-buy-button'
  );

  buyButton.type = 'button';
  buyButton.disabled = !shopIsOnline;

  buyButton.setAttribute(
    'aria-label',
    `Kup ${product.name || 'produkt'} za ${formatPrice(price.finalPrice)}`
  );

  if (price.promo) {
    buyButton.append(
      createElement(
        'span',
        'buy-old-price',
        formatPrice(price.base)
      ),
      createElement(
        'span',
        'buy-current-price',
        formatPrice(price.finalPrice)
      ),
      createElement(
        'span',
        'buy-discount',
        `-${price.promo}%`
      )
    );
  } else {
    buyButton.append(
      createElement(
        'span',
        'buy-current-price',
        formatPrice(price.base)
      )
    );
  }

  /* OBSŁUGA ZAKUPU VIshop */

  buyButton.addEventListener('click', () => buyProduct(product));

  card.append(
    imageWrap,
    name,
    description,
    buyButton
  );

  return card;
}

/* =========================================================
   WYŚWIETLANIE PRODUKTÓW
========================================================= */

function renderProducts() {
  elements.productsGrid.replaceChildren();

  const visibleProducts = selectedCategory === 'all'
    ? currentProducts
    : currentProducts.filter(
        (product) => String(product.category) === String(selectedCategory)
      );

  if (!visibleProducts.length) {
    elements.productsGrid.append(
      createElement(
        'div',
        'empty-state',
        'Brak produktów w tej kategorii.'
      )
    );

    return;
  }

  visibleProducts.forEach((product) => {
    elements.productsGrid.append(
      createProductCard(product)
    );
  });
}

/* =========================================================
   ZAKUP PRODUKTU — VIshop Pay
========================================================= */

function buyProduct(product) {
  if (!shopIsOnline) {
    showNotice(
      'Sklep jest obecnie wyłączony. Zakupy są chwilowo niedostępne.'
    );

    return;
  }

  if (!product || !product.id) {
    showNotice(
      'Nie udało się rozpoznać produktu. Odśwież stronę.'
    );

    return;
  }

  if (typeof window.vishopPay === 'function') {
    window.vishopPay(CONFIG.shopId, product.id);
  } else {
    window.location.href =
      `https://pay.vishop.pl/${CONFIG.shopId}/${encodeURIComponent(product.id)}`;
  }
}

/* =========================================================
   POWRÓT DO LISTY TRYBÓW
========================================================= */

function showServerList(updateHistory = true) {
  currentServer = null;
  currentProducts = [];
  selectedCategory = 'all';

  setPageMode('servers');

  if (updateHistory) {
    updateAddressBar(null);
  }
}

/* =========================================================
   VOUCHER — OTWIERANIE
========================================================= */

function openVoucherModal() {
  elements.voucherMessage.textContent = '';
  elements.voucherMessage.className = 'form-message';

  elements.voucherModal.hidden = false;
  document.body.style.overflow = 'hidden';

  document.getElementById('voucherNick').focus();

  elements.menu.classList.remove('open');
  elements.hamburger.setAttribute('aria-expanded', 'false');
}

/* =========================================================
   VOUCHER — ZAMYKANIE
========================================================= */

function closeVoucherModal() {
  elements.voucherModal.hidden = true;
  document.body.style.overflow = '';
}

/* =========================================================
   REALIZACJA VOUCHERA
========================================================= */

async function redeemVoucher(event) {
  event.preventDefault();

  const formData = new FormData(elements.voucherForm);

  const player = String(formData.get('player') || '').trim();
  const code = String(formData.get('code') || '').trim();

  elements.voucherMessage.textContent = 'Sprawdzanie kodu...';
  elements.voucherMessage.className = 'form-message';

  if (!/^\.?\w{3,16}$/.test(player)) {
    elements.voucherMessage.textContent =
      'Wpisz poprawny nick Minecraft (3–16 znaków).';

    return;
  }

  if (!code) {
    elements.voucherMessage.textContent =
      'Wpisz kod vouchera.';

    return;
  }

  try {
    const result = await fetchJson(
      `${CONFIG.apiBase}vouchers/use/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code,
          player
        })
      }
    );

    elements.voucherMessage.textContent =
      typeof result === 'string'
        ? result
        : 'Voucher został przekazany do realizacji.';

    elements.voucherMessage.className = 'form-message success';

    elements.voucherForm.reset();

  } catch (error) {
    elements.voucherMessage.textContent =
      `Nie udało się zrealizować vouchera: ${error.message}`;

    elements.voucherMessage.className = 'form-message';
  }
}

/* =========================================================
   NAWIGACJA
========================================================= */

function setupNavigation() {
  elements.hamburger.addEventListener('click', () => {
    const isOpen = elements.menu.classList.toggle('open');

    elements.hamburger.setAttribute(
      'aria-expanded',
      String(isOpen)
    );
  });

  elements.menu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      elements.menu.classList.remove('open');

      elements.hamburger.setAttribute(
        'aria-expanded',
        'false'
      );
    });
  });

  elements.changeServer.addEventListener(
    'click',
    () => showServerList(true)
  );

  elements.backToServers.addEventListener('click', (event) => {
    event.preventDefault();
    showServerList(true);
  });

  window.addEventListener('popstate', () => {
    const id = new URLSearchParams(
      window.location.search
    ).get('server');

    const server = CONFIG.servers.find(
      (item) => String(item.id) === String(id)
    );

    if (server) {
      selectServer(server, false);
    } else {
      showServerList(false);
    }
  });
}

/* =========================================================
   START
========================================================= */

async function init() {
  setupNavigation();
  renderServers();

  await loadShopInfo();

  const requestedServerId = new URLSearchParams(
    window.location.search
  ).get('server');

  const requestedServer = CONFIG.servers.find(
    (server) => String(server.id) === String(requestedServerId)
  );

  if (requestedServer) {
    await selectServer(requestedServer, false);
  } else {
    setPageMode('servers');
  }
}

init();
