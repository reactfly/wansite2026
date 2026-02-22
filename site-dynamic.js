const API = {
  siteContent: '/api/site-content',
  portfolio: '/api/portfolio',
  products: '/api/products',
};

const DEFAULTS = {
  artist_name: "Wan Bit'ha",
  artist_role: 'Artista Brasileira',
  hero_services: 'Pintura | Ilustracoes | Bordados | Acessorios.',
  hero_line_1: 'Artes que contam historias',
  hero_line_2: 'Vivencias da Alma Criadora',
  hero_line_3: 'Resgatando o fluxo de vida da Arte Ancestral',
};

const IDS = {
  manifesto: 'dynamic-manifesto',
  portfolio: 'works-acervo',
  shop: 'shop-products',
  lightbox: 'wb-portfolio-lightbox',
};

const portfolioRuntime = {
  items: [],
  activeIndex: -1,
  revealObserver: null,
  keyboardBound: false,
  tiltState: {}, // rastrear estado de tilt por card
  gyroActive: false,
  gyroPermission: null,
  currentZoomLevel: 1,
  panX: 0,
  panY: 0,
};

const normalizeText = (value) => String(value || '').trim();

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

// Utility functions for animations
const lerp = (start, end, factor) => start + (end - start) * factor;
const clamp = (val, min, max) => Math.min(Math.max(val, min), max);
const mapRange = (val, inMin, inMax, outMin, outMax) => {
  return ((val - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin;
};

const prefersReducedMotion = () => {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

const fetchJson = async (url) => {
  const response = await fetch(url, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`Falha em ${url}: HTTP ${response.status}`);
  }
  return response.json();
};

const ensureDynamicStyle = () => {
  if (document.getElementById('dynamic-site-style')) {
    return;
  }

  const style = document.createElement('style');
  style.id = 'dynamic-site-style';
  style.textContent = `
    .wb-dynamic-wrap {
      background:
        radial-gradient(circle at 8% 10%, rgba(255, 215, 232, 0.55) 0%, rgba(255, 246, 251, 0.25) 40%, rgba(255, 250, 244, 0.12) 65%),
        linear-gradient(180deg, #fff9fd 0%, #fffaf4 100%);
      border-top: 1px solid rgba(255, 45, 155, 0.18);
      border-bottom: 1px solid rgba(255, 45, 155, 0.12);
    }
    .wb-dynamic-inner {
      max-width: 1240px;
      margin: 0 auto;
      padding: 56px 24px;
      font-family: "Manrope", "Outfit", sans-serif;
      color: #1a1a2e;
    }
    .wb-dynamic-kicker {
      margin: 0 0 10px;
      font-size: 11px;
      letter-spacing: 0.24em;
      text-transform: uppercase;
      color: #e5007d;
      font-weight: 600;
    }
    .wb-dynamic-title {
      margin: 0 0 10px;
      font-size: clamp(28px, 5vw, 52px);
      line-height: 1.02;
      font-weight: 300;
    }
    .wb-dynamic-role {
      margin: 0 0 14px;
      font-size: 15px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #4a4a6a;
      font-weight: 500;
    }
    .wb-portfolio-filters {
      display: flex;
      gap: 10px;
      margin-bottom: 28px;
      flex-wrap: wrap;
      padding: 12px 0;
    }
    .wb-portfolio-filter {
      padding: 8px 16px;
      border: 1.5px solid #d4d4d4;
      background: #fff;
      border-radius: 999px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      color: #4a4a6a;
      transition: all 0.25s ease;
    }
    .wb-portfolio-filter:hover {
      border-color: #ff2d9b;
      color: #ff2d9b;
    }
    .wb-portfolio-filter.active {
      background: #ff2d9b;
      border-color: #ff2d9b;
      color: #fff;
    }
    .wb-dynamic-lines {
      display: grid;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
      color: #2f2f44;
      font-size: 16px;
      line-height: 1.5;
      font-weight: 400;
    }
    .wb-portfolio-stage {
      margin-top: 28px;
      position: relative;
    }
    .wb-portfolio-stage::before {
      content: "";
      position: absolute;
      inset: -20px -10px;
      background: radial-gradient(circle at 20% 0%, rgba(255, 45, 155, 0.09), transparent 52%);
      pointer-events: none;
      z-index: 0;
    }
    .wb-portfolio-grid {
      position: relative;
      z-index: 1;
      display: grid;
      gap: 18px;
      grid-template-columns: repeat(12, minmax(0, 1fr));
      grid-auto-rows: minmax(68px, auto);
      perspective: 1200px;
    }
    .wb-portfolio-card {
      grid-column: span 6;
      border: 1px solid rgba(229, 0, 125, 0.16);
      border-radius: 18px;
      overflow: hidden;
      background: #ffffff;
      box-shadow: 0 20px 40px rgba(15, 15, 26, 0.08);
      opacity: 0;
      transform: translateY(26px) scale(0.985);
      transition: opacity 0.65s ease, transform 0.65s cubic-bezier(.2,.72,.21,1), box-shadow 0.35s ease;
      will-change: transform, opacity;
      position: relative;
      cursor: pointer;
      transform-style: preserve-3d;
    }
    .wb-portfolio-card.is-visible {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    .wb-portfolio-card.is-tilting {
      transition: none;
    }
    .wb-portfolio-card:nth-child(3n+1) {
      grid-column: span 7;
      grid-row: span 5;
    }
    .wb-portfolio-card:nth-child(3n+2) {
      grid-column: span 5;
      grid-row: span 4;
    }
    .wb-portfolio-card:nth-child(3n) {
      grid-column: span 4;
      grid-row: span 4;
    }
    .wb-portfolio-card::after {
      content: '';
      position: absolute;
      inset: 0;
      background: radial-gradient(
        600px at var(--mouse-x, 50%) var(--mouse-y, 50%),
        rgba(255, 255, 255, 0.1),
        transparent 80%
      );
      opacity: 0;
      pointer-events: none;
      border-radius: inherit;
      z-index: 10;
    }
    .wb-portfolio-card:hover::after {
      opacity: 1;
    }
    .wb-portfolio-card:hover {
      transform: translateY(-6px) scale(1.005) rotateX(0deg) rotateY(0deg);
      box-shadow: 0 24px 54px rgba(15, 15, 26, 0.14);
    }
    .wb-portfolio-media {
      position: relative;
      overflow: hidden;
      aspect-ratio: 5 / 4;
      background: linear-gradient(160deg, #f6d6e6, #f8f3ff);
      transform-style: preserve-3d;
      transform: translateZ(0);
    }
    .wb-portfolio-card:nth-child(3n+1) .wb-portfolio-media {
      aspect-ratio: 5 / 5;
    }
    .wb-portfolio-card:nth-child(3n) .wb-portfolio-media {
      aspect-ratio: 4 / 5;
    }
    .wb-portfolio-media img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      transform: scale(1) translateZ(0);
      transition: transform 0.8s cubic-bezier(.2,.72,.21,1), filter 0.45s ease;
    }
    .wb-portfolio-card:hover .wb-portfolio-media img {
      transform: scale(1.15) rotate(-0.5deg) translateZ(0);
      filter: saturate(1.12) contrast(1.08) brightness(1.05);
    }
    .wb-portfolio-gradient {
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(16, 23, 26, 0) 34%, rgba(16, 23, 26, 0.68) 100%);
      opacity: 0.86;
      transition: opacity 0.45s ease;
      pointer-events: none;
      transform-style: preserve-3d;
      transform: translateZ(10px);
    }
    .wb-portfolio-floating {
      position: absolute;
      left: 14px;
      top: 14px;
      z-index: 2;
      padding: 8px 12px;
      border-radius: 999px;
      font-size: 10px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: #fff;
      background: rgba(26, 26, 46, 0.48);
      backdrop-filter: blur(4px);
      border: 1px solid rgba(255, 255, 255, 0.25);
      font-weight: 600;
    }
    .wb-portfolio-open {
      position: absolute;
      right: 14px;
      bottom: 14px;
      z-index: 3;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      border: 1px solid rgba(255, 255, 255, 0.36);
      background: rgba(8, 10, 14, 0.42);
      color: #fff;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      font-size: 10px;
      font-weight: 600;
      border-radius: 999px;
      padding: 10px 12px;
      cursor: pointer;
      transition: transform 0.24s ease, background 0.24s ease, border-color 0.24s ease;
      backdrop-filter: blur(4px);
    }
    .wb-portfolio-open:hover {
      transform: translateY(-3px) scale(1.12);
      background: rgba(229, 0, 125, 0.9);
      border-color: rgba(255, 255, 255, 0.95);
      box-shadow: 0 12px 32px rgba(229, 0, 125, 0.5), 0 0 20px rgba(229, 0, 125, 0.35);
    }
    .wb-portfolio-open svg {
      width: 14px;
      height: 14px;
    }
    .wb-portfolio-body {
      padding: 15px 14px 14px;
      display: grid;
      gap: 8px;
      background: #fff;
    }
    .wb-portfolio-category {
      margin: 0;
      font-size: 11px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: #ff6b35;
      font-weight: 600;
    }
    .wb-portfolio-name {
      margin: 0;
      font-size: 24px;
      line-height: 1.04;
      font-weight: 400;
      color: #1a1a2e;
    }
    .wb-portfolio-desc {
      margin: 0;
      font-size: 13px;
      color: #4a4a6a;
      line-height: 1.45;
      min-height: 38px;
    }
    .wb-portfolio-meta {
      margin: 2px 0 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: #4a4a6a;
      font-weight: 600;
      flex-wrap: wrap;
    }
    .wb-portfolio-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(74, 74, 106, 0.24);
      border-radius: 999px;
      padding: 8px 10px;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      color: #4a4a6a;
      background: #fafafa;
      font-weight: 600;
      white-space: nowrap;
    }
    .wb-lightbox {
      position: fixed;
      inset: 0;
      z-index: 99999;
      background: rgba(7, 8, 12, 0.94);
      display: grid;
      place-items: center;
      padding: 30px;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.24s ease;
    }
    .wb-lightbox.is-open {
      opacity: 1;
      pointer-events: auto;
    }
    .wb-lightbox-stage {
      width: min(1200px, 100%);
      max-height: calc(100vh - 110px);
      display: grid;
      grid-template-rows: 1fr auto;
      gap: 12px;
      transform: translateY(12px) scale(0.98);
      transition: transform 0.28s cubic-bezier(.2,.72,.21,1);
    }
    .wb-lightbox.is-open .wb-lightbox-stage {
      transform: translateY(0) scale(1);
    }
    .wb-lightbox-figure {
      margin: 0;
      min-height: 0;
      border-radius: 18px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.16);
      background: #121520;
      display: grid;
      place-items: center;
      position: relative;
    }
    .wb-lightbox-img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      max-height: calc(100vh - 210px);
      transform-origin: center center;
      animation: wb-lightbox-zoom 0.36s cubic-bezier(0.17, 0.67, 0.33, 0.96);
      cursor: zoom-in;
      transition: transform 0.2s ease;
      user-select: none;
    }
    .wb-lightbox-img.is-zoomed {
      cursor: zoom-out;
      transform: scale(2);
    }
    @keyframes wb-lightbox-zoom {
      from {
        transform: scale(0.84);
        opacity: 0.3;
        filter: blur(3px);
      }
      to {
        transform: scale(1);
        opacity: 1;
        filter: blur(0);
      }
    }
    .wb-lightbox-caption {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
      color: #fff;
      font-family: "Manrope", "Outfit", sans-serif;
      font-size: 13px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      opacity: 0.9;
      padding: 0 6px;
    }
    .wb-lightbox-caption strong {
      font-size: 14px;
      letter-spacing: 0.08em;
      font-weight: 600;
    }
    .wb-lightbox-close,
    .wb-lightbox-nav {
      position: absolute;
      z-index: 4;
      border: 1px solid rgba(255, 255, 255, 0.34);
      background: rgba(4, 5, 8, 0.54);
      color: #fff;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: transform 0.2s ease, background 0.2s ease;
      backdrop-filter: blur(4px);
    }
    .wb-lightbox-close {
      top: 16px;
      right: 16px;
      width: 42px;
      height: 42px;
      font-size: 20px;
      line-height: 1;
    }
    .wb-lightbox-nav {
      top: 50%;
      transform: translateY(-50%);
      width: 44px;
      height: 44px;
      font-size: 22px;
      line-height: 1;
    }
    .wb-lightbox-nav.prev {
      left: 16px;
    }
    .wb-lightbox-nav.next {
      right: 16px;
    }
    .wb-lightbox-close:hover,
    .wb-lightbox-nav:hover {
      background: rgba(229, 0, 125, 0.9);
      transform: translateY(-50%) scale(1.12);
      box-shadow: 0 12px 32px rgba(229, 0, 125, 0.6), 0 0 20px rgba(229, 0, 125, 0.35);
    }
    .wb-lightbox-close:hover {
      transform: scale(1.12);
      box-shadow: 0 12px 32px rgba(229, 0, 125, 0.6), 0 0 20px rgba(229, 0, 125, 0.35);
    }
    .wb-shop-grid {
      margin-top: 26px;
      display: grid;
      gap: 16px;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    }
    .wb-shop-card {
      border: 1px solid rgba(229, 0, 125, 0.14);
      border-radius: 16px;
      overflow: hidden;
      background: #fff;
      box-shadow: 0 12px 30px rgba(15, 15, 26, 0.07);
    }
    .wb-shop-card img {
      width: 100%;
      aspect-ratio: 4 / 3;
      object-fit: cover;
      display: block;
      background: #fff0f5;
    }
    .wb-shop-body {
      padding: 14px;
      display: grid;
      gap: 8px;
    }
    .wb-shop-category {
      font-size: 11px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: #ff6b35;
      font-weight: 600;
      margin: 0;
    }
    .wb-shop-name {
      margin: 0;
      font-size: 22px;
      line-height: 1.08;
      font-weight: 400;
      color: #1a1a2e;
    }
    .wb-shop-desc {
      margin: 0;
      font-size: 13px;
      color: #4a4a6a;
      line-height: 1.45;
      min-height: 38px;
    }
    .wb-shop-meta {
      margin: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .wb-shop-price {
      font-size: 20px;
      color: #e5007d;
      font-weight: 600;
    }
    .wb-shop-stock {
      font-size: 11px;
      color: #4a4a6a;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .wb-shop-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(229, 0, 125, 0.2);
      border-radius: 999px;
      text-decoration: none;
      color: #e5007d;
      font-size: 11px;
      letter-spacing: 0.2em;
      font-weight: 600;
      text-transform: uppercase;
      padding: 11px 12px;
      transition: 0.2s ease;
    }
    .wb-shop-link:hover {
      background: #e5007d;
      color: #fff;
    }
    @media (max-width: 980px) {
      .wb-portfolio-card,
      .wb-portfolio-card:nth-child(3n+1),
      .wb-portfolio-card:nth-child(3n+2),
      .wb-portfolio-card:nth-child(3n) {
        grid-column: span 12;
        grid-row: span 1;
      }
      .wb-lightbox {
        padding: 16px;
      }
      .wb-lightbox-nav {
        width: 38px;
        height: 38px;
      }
      .wb-lightbox-nav.prev {
        left: 8px;
      }
      .wb-lightbox-nav.next {
        right: 8px;
      }
      .wb-lightbox-close {
        top: 8px;
        right: 8px;
      }
    }
  `;

  document.head.appendChild(style);
};

const getOrCreateSection = (id) => {
  let section = document.getElementById(id);
  if (section) {
    return section;
  }

  section = document.createElement('section');
  section.id = id;
  section.className = 'wb-dynamic-wrap';

  const root = document.getElementById('root');
  if (root && root.parentNode) {
    root.insertAdjacentElement('afterend', section);
  } else {
    document.body.appendChild(section);
  }

  return section;
};

const formatCurrency = (value) => {
  const parsed = Number(value || 0);
  return parsed.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const buildManifesto = (content) => {
  const data = { ...DEFAULTS, ...content };
  const section = getOrCreateSection(IDS.manifesto);

  section.innerHTML = `
    <div class="wb-dynamic-inner">
      <p class="wb-dynamic-kicker">Conteudo Dinamico</p>
      <h2 class="wb-dynamic-title">${escapeHtml(data.artist_name)}</h2>
      <p class="wb-dynamic-role">${escapeHtml(data.artist_role)}</p>
      <ul class="wb-dynamic-lines">
        <li>${escapeHtml(data.hero_services)}</li>
        <li>${escapeHtml(data.hero_line_1)}</li>
        <li>${escapeHtml(data.hero_line_2)}</li>
        <li>${escapeHtml(data.hero_line_3)}</li>
      </ul>
    </div>
  `;

  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription) {
    metaDescription.setAttribute(
      'content',
      `Portfolio de ${data.artist_name}. ${data.hero_services.replaceAll('|', '-')} ${data.hero_line_1}`
    );
  }

  document.title = `${data.artist_name} | Wanessa Alcantara - ${data.artist_role}`;
};

const hideLegacyWorksSection = () => {
  const legacy = document.getElementById('works');
  if (!legacy) {
    return;
  }

  legacy.style.display = 'none';
  legacy.setAttribute('aria-hidden', 'true');
};

const createZoomIcon = () =>
  `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 4h6v6" stroke="currentColor" stroke-width="1.7"/><path d="M10 20H4v-6" stroke="currentColor" stroke-width="1.7"/><path d="M20 4l-7 7" stroke="currentColor" stroke-width="1.7"/><path d="M4 20l7-7" stroke="currentColor" stroke-width="1.7"/></svg>`;

const buildPortfolio = (items) => {
  hideLegacyWorksSection();

  const section = getOrCreateSection(IDS.portfolio);
  const activeItems = (Array.isArray(items) ? items : [])
    .filter((item) => item && item.isActive !== false)
    .slice(0, 30);

  portfolioRuntime.items = activeItems.map((item) => ({
    id: Number(item.id),
    title: normalizeText(item.title) || 'Trabalho sem titulo',
    description: normalizeText(item.description) || 'Trabalho autoral do portfolio.',
    image: normalizeText(item.image) || '/public/uploads/logo-wanbitha.png',
    category: normalizeText(item.category) || 'Portfolio',
    year: normalizeText(item.year) || 'Sem ano',
  }));

  const categories = Array.from(
    new Set(portfolioRuntime.items.map(item => item.category))
  ).sort();

  const filters = [
    '<button class="wb-portfolio-filter active" data-filter="all">Todos</button>',
    ...categories.map(
      (cat) => `<button class="wb-portfolio-filter" data-filter="${escapeHtml(cat)}">` +
      `${escapeHtml(cat)}</button>`
    )
  ].join('');

  const cards = portfolioRuntime.items
    .map(
      (item, index) => `
      <article class="wb-portfolio-card wb-reveal" data-portfolio-index="${index}" data-portfolio-category="${escapeHtml(item.category)}">
        <div class="wb-portfolio-media">
          <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" loading="lazy" />
          <div class="wb-portfolio-gradient"></div>
          <div class="wb-portfolio-floating">${escapeHtml(item.category)}</div>
          <button type="button" class="wb-portfolio-open" data-portfolio-open="${index}" aria-label="Abrir ${escapeHtml(item.title)} em tela cheia">
            ${createZoomIcon()}
            <span>Zoom</span>
          </button>
        </div>
        <div class="wb-portfolio-body">
          <p class="wb-portfolio-category">${escapeHtml(item.category)}</p>
          <h3 class="wb-portfolio-name">${escapeHtml(item.title)}</h3>
          <p class="wb-portfolio-desc">${escapeHtml(item.description)}</p>
          <p class="wb-portfolio-meta">
            <span>${escapeHtml(item.year)}</span>
            <span class="wb-portfolio-badge">Portfolio - nao a venda</span>
          </p>
        </div>
      </article>
    `
    )
    .join('');

  section.innerHTML = `
    <div class="wb-dynamic-inner">
      <p class="wb-dynamic-kicker">Galeria Premium</p>
      <h2 class="wb-dynamic-title">Portfólio de Trabalhos</h2>
      <p class="wb-dynamic-role">Explore a coleção completa de criações artísticas</p>
      ${portfolioRuntime.items.length > 0 ? `<div class="wb-portfolio-filters">${filters}</div>` : ''}
      <div class="wb-portfolio-stage">
        <div class="wb-portfolio-grid">
          ${cards || '<p class="wb-portfolio-desc" style="grid-column: 1 / -1; text-align: center; padding: 40px;">Nenhum trabalho ativo no portfolio.</p>'}
        </div>
      </div>
    </div>
  `;

  wirePortfolioReveal();
  wirePortfolioOpenButtons();
  wirePortfolioFilters();
  wirePortfolioFilters();
  ensurePortfolioLightbox();
};

const buildShop = (products) => {
  const section = getOrCreateSection(IDS.shop);
  const active = (Array.isArray(products) ? products : [])
    .filter((item) => item && item.isActive !== false)
    .slice(0, 12);

  const cards = active
    .map((product) => {
      const image = normalizeText(product.image) || '/imagens/logo-wanbitha.png';
      const category = normalizeText(product.category) || 'Colecao';
      const shortDescription = normalizeText(product.shortDescription) || 'Peca artistica exclusiva.';
      const stock = Number(product.stock || 0);
      const stockLabel = stock > 0 ? `Estoque ${stock}` : 'Sem estoque';
      const ask = encodeURIComponent(`Ola! Tenho interesse no produto "${product.name}".`);

      return `
        <article class="wb-shop-card">
          <img src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}" loading="lazy" />
          <div class="wb-shop-body">
            <p class="wb-shop-category">${escapeHtml(category)}</p>
            <h3 class="wb-shop-name">${escapeHtml(product.name)}</h3>
            <p class="wb-shop-desc">${escapeHtml(shortDescription)}</p>
            <p class="wb-shop-meta">
              <span class="wb-shop-price">${formatCurrency(product.price)}</span>
              <span class="wb-shop-stock">${escapeHtml(stockLabel)}</span>
            </p>
            <a class="wb-shop-link" href="#contact?produto=${ask}">Tenho interesse</a>
          </div>
        </article>
      `;
    })
    .join('');

  section.innerHTML = `
    <div class="wb-dynamic-inner">
      <p class="wb-dynamic-kicker">Loja Dinamica</p>
      <h2 class="wb-dynamic-title">Produtos Cadastrados</h2>
      <p class="wb-dynamic-role">Renderizado por /api/products</p>
      <div class="wb-shop-grid">
        ${cards || '<p class="wb-shop-desc">Nenhum produto ativo no momento.</p>'}
      </div>
    </div>
  `;
};

const ensurePortfolioLightbox = () => {
  let lightbox = document.getElementById(IDS.lightbox);
  if (lightbox) {
    return lightbox;
  }

  lightbox = document.createElement('div');
  lightbox.id = IDS.lightbox;
  lightbox.className = 'wb-lightbox';
  lightbox.setAttribute('aria-hidden', 'true');
  lightbox.innerHTML = `
    <div class="wb-lightbox-stage">
      <figure class="wb-lightbox-figure">
        <button type="button" class="wb-lightbox-close" data-lightbox-close aria-label="Fechar">x</button>
        <button type="button" class="wb-lightbox-nav prev" data-lightbox-prev aria-label="Imagem anterior">&#8249;</button>
        <img class="wb-lightbox-img" data-lightbox-image alt="" />
        <button type="button" class="wb-lightbox-nav next" data-lightbox-next aria-label="Proxima imagem">&#8250;</button>
      </figure>
      <figcaption class="wb-lightbox-caption">
        <strong data-lightbox-title></strong>
        <span data-lightbox-meta></span>
      </figcaption>
    </div>
  `;

  document.body.appendChild(lightbox);

  lightbox.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target === lightbox || target.dataset.lightboxClose !== undefined) {
      closePortfolioLightbox();
      return;
    }
    if (target.dataset.lightboxPrev !== undefined) {
      stepPortfolioLightbox(-1);
      return;
    }
    if (target.dataset.lightboxNext !== undefined) {
      stepPortfolioLightbox(1);
    }
  });

  if (!portfolioRuntime.keyboardBound) {
    document.addEventListener('keydown', (event) => {
      const isOpen = lightbox.classList.contains('is-open');
      if (!isOpen) {
        return;
      }

      if (event.key === 'Escape') {
        closePortfolioLightbox();
      } else if (event.key === 'ArrowRight') {
        stepPortfolioLightbox(1);
      } else if (event.key === 'ArrowLeft') {
        stepPortfolioLightbox(-1);
      }
    });
    portfolioRuntime.keyboardBound = true;
  }

  return lightbox;
};

const renderPortfolioLightbox = () => {
  const lightbox = ensurePortfolioLightbox();
  const item = portfolioRuntime.items[portfolioRuntime.activeIndex];
  if (!item) {
    return;
  }

  const imageEl = lightbox.querySelector('[data-lightbox-image]');
  const titleEl = lightbox.querySelector('[data-lightbox-title]');
  const metaEl = lightbox.querySelector('[data-lightbox-meta]');

  if (!(imageEl instanceof HTMLImageElement) || !(titleEl instanceof HTMLElement) || !(metaEl instanceof HTMLElement)) {
    return;
  }

  imageEl.src = item.image;
  imageEl.alt = item.title;
  titleEl.textContent = item.title;
  metaEl.textContent = `${item.category} - ${item.year} - Portfolio`;
};

const openPortfolioLightbox = (index) => {
  const safeIndex = Number(index);
  if (!Number.isFinite(safeIndex) || safeIndex < 0 || safeIndex >= portfolioRuntime.items.length) {
    return;
  }

  portfolioRuntime.activeIndex = safeIndex;
  renderPortfolioLightbox();

  const lightbox = ensurePortfolioLightbox();
  lightbox.classList.add('is-open');
  lightbox.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
};

const closePortfolioLightbox = () => {
  const lightbox = ensurePortfolioLightbox();
  lightbox.classList.remove('is-open');
  lightbox.setAttribute('aria-hidden', 'true');
  portfolioRuntime.activeIndex = -1;
  document.body.style.overflow = '';
};

const stepPortfolioLightbox = (direction) => {
  if (!portfolioRuntime.items.length) {
    return;
  }

  const next = (portfolioRuntime.activeIndex + direction + portfolioRuntime.items.length) % portfolioRuntime.items.length;
  portfolioRuntime.activeIndex = next;
  renderPortfolioLightbox();
};

const wirePortfolioOpenButtons = () => {
  const buttons = Array.from(document.querySelectorAll('[data-portfolio-open]'));
  for (const button of buttons) {
    if (!(button instanceof HTMLElement) || button.dataset.portfolioBound === '1') {
      continue;
    }

    button.dataset.portfolioBound = '1';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const index = Number(button.dataset.portfolioOpen);
      openPortfolioLightbox(index);
    });
  }
};

const wirePortfolioFilters = () => {
  const filters = Array.from(document.querySelectorAll('[data-filter]'));
  const cards = Array.from(document.querySelectorAll('[data-portfolio-category]'));
  
  if (!filters.length) return;

  for (const filter of filters) {
    if (!(filter instanceof HTMLElement) || filter.dataset.filterBound === '1') {
      continue;
    }

    filter.dataset.filterBound = '1';
    filter.addEventListener('click', () => {
      // Update active state
      filters.forEach(f => f.classList.remove('active'));
      filter.classList.add('active');
      
      // Filter cards
      const selectedFilter = filter.dataset.filter;
      cards.forEach(card => {
        if (selectedFilter === 'all' || card.dataset.portfolioCategory === selectedFilter) {
          card.style.display = '';
          requestAnimationFrame(() => card.classList.add('is-visible'));
        } else {
          card.classList.remove('is-visible');
          card.style.display = 'none';
        }
      });
    });
  }
};

const wirePortfolioReveal = () => {
  const cards = Array.from(document.querySelectorAll('.wb-portfolio-card'));
  if (!cards.length) {
    return;
  }

  if (portfolioRuntime.revealObserver) {
    portfolioRuntime.revealObserver.disconnect();
  }

  const onVisible = (element, index) => {
    window.setTimeout(() => {
      element.classList.add('is-visible');
    }, Math.min(index * 70, 500));
  };

  if (!('IntersectionObserver' in window)) {
    cards.forEach((card, index) => onVisible(card, index));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const element = entry.target;
          const index = cards.indexOf(element);
          onVisible(element, index >= 0 ? index : 0);
          observer.unobserve(element);
        }
      }
    },
    { threshold: 0.16, rootMargin: '0px 0px -8% 0px' }
  );

  cards.forEach((card) => observer.observe(card));
  portfolioRuntime.revealObserver = observer;
};

const wireWorksButtons = () => {
  const candidates = Array.from(document.querySelectorAll('button, a')).filter((element) => {
    const text = normalizeText(element.textContent).toLowerCase();
    const href = String(element.getAttribute('href') || '').toLowerCase();
    return text.includes('obras') || href === '#works';
  });

  for (const element of candidates) {
    if (element.dataset.worksBound === '1') {
      continue;
    }

    element.dataset.worksBound = '1';
    element.addEventListener(
      'click',
      (event) => {
        const targetSection = document.getElementById(IDS.portfolio);
        if (!targetSection) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        window.scrollTo({ top: targetSection.offsetTop, behavior: 'smooth' });
      },
      { capture: true }
    );
  }
};

const wireShopButtons = () => {
  const buttons = Array.from(document.querySelectorAll('button,a')).filter((element) =>
    /loja/i.test(normalizeText(element.textContent))
  );

  for (const button of buttons) {
    if (button.dataset.shopBound === '1') {
      continue;
    }

    button.dataset.shopBound = '1';
    button.addEventListener(
      'click',
      (event) => {
        const href = button.getAttribute('href');
        if (button.tagName === 'A' && href && href.startsWith('#') && href !== '#') {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        const shopSection = document.getElementById(IDS.shop);
        if (shopSection) {
          window.scrollTo({ top: shopSection.offsetTop, behavior: 'smooth' });
        }
      },
      { capture: true }
    );
  }
};

const toContentMap = (items) => {
  const map = { ...DEFAULTS };
  for (const item of Array.isArray(items) ? items : []) {
    if (!item || !item.key) {
      continue;
    }
    map[item.key] = String(item.value ?? '');
  }
  return map;
};

// 3D TILT CARD SYSTEM
const wirePortfolioCardTilt = () => {
  if (prefersReducedMotion()) return;

  const cards = Array.from(document.querySelectorAll('.wb-portfolio-card'));
  
  // Desktop mouse tracking
  cards.forEach((card) => {
    const media = card.querySelector('.wb-portfolio-media');
    if (!media) return;

    portfolioRuntime.tiltState[card.id || 'card'] = {
      rotateX: { current: 0, target: 0 },
      rotateY: { current: 0, target: 0 },
      glareX: 50,
      glareY: 50,
    };

    card.addEventListener('mouseenter', () => {
      card.classList.add('is-tilting');
    });

    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateY = mapRange(x, 0, rect.width, -15, 15);
      const rotateX = mapRange(y, 0, rect.height, 15, -15);

      card.style.setProperty('--mouse-x', `${(x / rect.width) * 100}%`);
      card.style.setProperty('--mouse-y', `${(y / rect.height) * 100}%`);

      card.style.transform = `
        translateY(-6px) scale(1.005)
        rotateX(${rotateX}deg)
        rotateY(${rotateY}deg)
      `.trim();

      media.style.transform = `translateZ(20px)`;
    });

    card.addEventListener('mouseleave', () => {
      card.classList.remove('is-tilting');
      card.style.transform = 'translateY(-6px) scale(1.005) rotateX(0) rotateY(0)';
      media.style.transform = 'translateZ(0)';
    });
  });
};

// GYROSCOPE SUPPORT
const setupGyroscope = () => {
  if (prefersReducedMotion()) return;
  
  const hasGyro = 'DeviceOrientationEvent' in window;
  if (!hasGyro) return;

  const requestGyroPermission = async () => {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission === 'granted') {
          portfolioRuntime.gyroPermission = 'granted';
          activateGyroTilt();
        }
      } catch (err) {
        console.log('Gyro permission denied or unavailable');
      }
    } else {
      // Non-iOS devices
      portfolioRuntime.gyroPermission = 'granted';
      activateGyroTilt();
    }
  };

  // Adicionar botão para solicitar permissão
  const cards = Array.from(document.querySelectorAll('.wb-portfolio-card'));
  if (cards.length > 0 && !portfolioRuntime.gyroPermission) {
    document.addEventListener('touchstart', requestGyroPermission, { once: true });
  }
};

const activateGyroTilt = () => {
  const cards = Array.from(document.querySelectorAll('.wb-portfolio-card'));
  const smoothFactor = 0.12;

  window.addEventListener('deviceorientation', (event) => {
    const { beta, gamma } = event;
    if (beta === null || gamma === null) return;

    cards.forEach((card) => {
      const rotateX = mapRange(beta, -45, 45, -15, 15);
      const rotateY = mapRange(gamma, -45, 45, -15, 15);

      const state = portfolioRuntime.tiltState[card.id] || { rotateX: { current: 0 }, rotateY: { current: 0 } };
      state.rotateX.current = lerp(state.rotateX.current, rotateX, smoothFactor);
      state.rotateY.current = lerp(state.rotateY.current, rotateY, smoothFactor);

      card.style.transform = `
        translateY(-6px) scale(1.005)
        rotateX(${state.rotateX.current}deg)
        rotateY(${state.rotateY.current}deg)
      `.trim();
    });
  });

  portfolioRuntime.gyroActive = true;
};

// ADVANCED LIGHTBOX WITH ZOOM & PAN
const upgradePortfolioLightbox = () => {
  const lightbox = document.getElementById(IDS.lightbox);
  if (!lightbox) return;

  const imageEl = lightbox.querySelector('[data-lightbox-image]');
  if (!(imageEl instanceof HTMLImageElement)) return;

  let currentZoom = 1;
  let panX = 0;
  let panY = 0;
  let lastX = 0, lastY = 0;
  let isPanning = false;

  // Zoom com mouse wheel
  lightbox.addEventListener('wheel', (e) => {
    if (e.deltaY === 0) return;
    e.preventDefault();

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = clamp(currentZoom * delta, 1, 3);
    
    if (newZoom !== currentZoom) {
      currentZoom = newZoom;
      updateImageTransform();
    }
  }, { passive: false });

  // Touch pinch-to-zoom
  let lastDistance = 0;
  lightbox.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (lastDistance > 0) {
        const factor = distance / lastDistance;
        const newZoom = clamp(currentZoom * factor, 1, 3);
        if (newZoom !== currentZoom) {
          currentZoom = newZoom;
          updateImageTransform();
        }
      }
      lastDistance = distance;
    }
  }, { passive: false });

  lightbox.addEventListener('touchend', () => {
    lastDistance = 0;
  });

  // Pan com drag quando em zoom
  imageEl.addEventListener('mousedown', (e) => {
    if (currentZoom > 1) {
      isPanning = true;
      lastX = e.clientX;
      lastY = e.clientY;
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (isPanning && lightbox.classList.contains('is-open')) {
      const deltaX = e.clientX - lastX;
      const deltaY = e.clientY - lastY;

      panX = clamp(panX + deltaX, -(imageEl.width * (currentZoom - 1)) / 2, (imageEl.width * (currentZoom - 1)) / 2);
      panY = clamp(panY + deltaY, -(imageEl.height * (currentZoom - 1)) / 2, (imageEl.height * (currentZoom - 1)) / 2);

      lastX = e.clientX;
      lastY = e.clientY;
      updateImageTransform();
    }
  });

  document.addEventListener('mouseup', () => {
    isPanning = false;
  });

  // Resetar zoom ao fechar
  const origClose = window.closePortfolioLightbox;
  window.closePortfolioLightbox = function() {
    currentZoom = 1;
    panX = 0;
    panY = 0;
    updateImageTransform();
    origClose.call(this);
  };

  function updateImageTransform() {
    imageEl.style.transform = `
      scale(${currentZoom})
      translate(${panX}px, ${panY}px)
    `.trim();
  }

  portfolioRuntime.currentZoomLevel = currentZoom;
};

const initDynamicPublicContent = async () => {
  ensureDynamicStyle();

  const [contentResult, portfolioResult, productsResult] = await Promise.allSettled([
    fetchJson(API.siteContent),
    fetchJson(API.portfolio),
    fetchJson(API.products),
  ]);

  const contentMap = contentResult.status === 'fulfilled' ? toContentMap(contentResult.value) : { ...DEFAULTS };
  const portfolioItems = portfolioResult.status === 'fulfilled' ? portfolioResult.value : [];
  const products = productsResult.status === 'fulfilled' ? productsResult.value : [];

  buildManifesto(contentMap);
  buildPortfolio(portfolioItems);
  buildShop(products);
  wireWorksButtons();
  wireShopButtons();
  wirePortfolioCardTilt();
  setupGyroscope();
  upgradePortfolioLightbox();

  const root = document.getElementById('root');
  if (root) {
    const observer = new MutationObserver(() => {
      hideLegacyWorksSection();
      wireWorksButtons();
      wireShopButtons();
    });

    observer.observe(root, { subtree: true, childList: true });
    window.setTimeout(() => observer.disconnect(), 25000);
  }
};

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => {
    initDynamicPublicContent().catch(() => {
      // fail silently to preserve the main site
    });
  });
} else {
  initDynamicPublicContent().catch(() => {
    // fail silently to preserve the main site
  });
}
