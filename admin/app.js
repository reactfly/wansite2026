const state = {
  user: null,
  currentTab: 'dashboard',
  dashboard: null,
  content: [],
  filteredContent: [],
  posts: [],
  filteredPosts: [],
  portfolio: [],
  filteredPortfolio: [],
  products: [],
  filteredProducts: [],
  orders: [],
  selectedOrderId: null,
  media: [],
  users: [],
  filteredUsers: [],
};

const ORDER_LABELS = {
  novo: 'Novo',
  aguardando_pagamento: 'Aguardando pagamento',
  pago: 'Pago',
  em_preparo: 'Em preparo',
  enviado: 'Enviado',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

const loginView = document.getElementById('login-view');
const adminView = document.getElementById('admin-view');
const toast = document.getElementById('toast');
const userLabel = document.getElementById('user-label');

const loginForm = document.getElementById('login-form');
const loginUsername = document.getElementById('login-username');
const loginPassword = document.getElementById('login-password');
const logoutBtn = document.getElementById('logout-btn');
const refreshAllBtn = document.getElementById('refresh-all');

const tabsNav = document.getElementById('tabs-nav');

const dashPosts = document.getElementById('dash-posts');
const dashLikes = document.getElementById('dash-likes');
const dashContent = document.getElementById('dash-content');
const dashPortfolio = document.getElementById('dash-portfolio');
const dashProducts = document.getElementById('dash-products');
const dashActiveProducts = document.getElementById('dash-active-products');
const dashOrders = document.getElementById('dash-orders');
const dashPendingOrders = document.getElementById('dash-pending-orders');
const dashUsers = document.getElementById('dash-users');
const dashUpdated = document.getElementById('dash-updated');

const contentFormTitle = document.getElementById('content-form-title');
const contentForm = document.getElementById('content-form');
const contentResetBtn = document.getElementById('content-reset');
const contentSearch = document.getElementById('content-search');
const contentTable = document.getElementById('content-table');
const contentId = document.getElementById('content-id');
const contentKey = document.getElementById('content-key');
const contentSection = document.getElementById('content-section');
const contentTitle = document.getElementById('content-title');
const contentType = document.getElementById('content-type');
const contentValue = document.getElementById('content-value');
const contentSort = document.getElementById('content-sort');

const postFormTitle = document.getElementById('post-form-title');
const postForm = document.getElementById('post-form');
const postResetBtn = document.getElementById('post-reset');
const postSearch = document.getElementById('post-search');
const postsTable = document.getElementById('posts-table');
const postId = document.getElementById('post-id');
const postTitle = document.getElementById('post-title');
const postExcerpt = document.getElementById('post-excerpt');
const postContent = document.getElementById('post-content');
const postDate = document.getElementById('post-date');
const postImage = document.getElementById('post-image');
const postImageFile = document.getElementById('post-image-file');
const postLikes = document.getElementById('post-likes');

const portfolioFormTitle = document.getElementById('portfolio-form-title');
const portfolioForm = document.getElementById('portfolio-form');
const portfolioResetBtn = document.getElementById('portfolio-reset');
const portfolioSearch = document.getElementById('portfolio-search');
const portfolioTable = document.getElementById('portfolio-table');
const portfolioId = document.getElementById('portfolio-id');
const portfolioTitle = document.getElementById('portfolio-title');
const portfolioCategory = document.getElementById('portfolio-category');
const portfolioYear = document.getElementById('portfolio-year');
const portfolioSort = document.getElementById('portfolio-sort');
const portfolioImage = document.getElementById('portfolio-image');
const portfolioImageFile = document.getElementById('portfolio-image-file');
const portfolioDescription = document.getElementById('portfolio-description');
const portfolioActive = document.getElementById('portfolio-active');

const productFormTitle = document.getElementById('product-form-title');
const productForm = document.getElementById('product-form');
const productResetBtn = document.getElementById('product-reset');
const productSearch = document.getElementById('product-search');
const productsTable = document.getElementById('products-table');
const productId = document.getElementById('product-id');
const productName = document.getElementById('product-name');
const productSlug = document.getElementById('product-slug');
const productCategory = document.getElementById('product-category');
const productPrice = document.getElementById('product-price');
const productStock = document.getElementById('product-stock');
const productImage = document.getElementById('product-image');
const productActive = document.getElementById('product-active');
const productShort = document.getElementById('product-short');
const productDescription = document.getElementById('product-description');
const productGallery = document.getElementById('product-gallery');

const ordersStatusFilter = document.getElementById('orders-status-filter');
const ordersTable = document.getElementById('orders-table');
const orderSelected = document.getElementById('order-selected');
const orderDetails = document.getElementById('order-details');
const orderUpdateForm = document.getElementById('order-update-form');
const orderStatus = document.getElementById('order-status');
const orderNotes = document.getElementById('order-notes');
const orderDeleteBtn = document.getElementById('order-delete');

const mediaUploadForm = document.getElementById('media-upload-form');
const mediaUploadFile = document.getElementById('media-upload-file');
const mediaRefreshBtn = document.getElementById('media-refresh');
const mediaGrid = document.getElementById('media-grid');

const userFormTitle = document.getElementById('user-form-title');
const userForm = document.getElementById('user-form');
const userResetBtn = document.getElementById('user-reset');
const usersSearch = document.getElementById('users-search');
const usersTable = document.getElementById('users-table');
const userId = document.getElementById('user-id');
const userUsername = document.getElementById('user-username');
const userPassword = document.getElementById('user-password');
const userActive = document.getElementById('user-active');

const todayPtBr = () => new Date().toLocaleDateString('pt-BR');

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const formatMoney = (value) =>
  Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

const formatDateTime = (value) => {
  if (!value) return '-';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return String(value);
  return dt.toLocaleString('pt-BR');
};

const statusLabel = (status) => ORDER_LABELS[status] || status || '-';

const showToast = (message, type = 'success') => {
  toast.textContent = message;
  toast.classList.remove('hidden', 'error', 'success');
  toast.classList.add(type);

  window.clearTimeout(showToast._timer);
  showToast._timer = window.setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
};

const apiRequest = async (url, options = {}) => {
  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {}),
    },
    ...options,
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const errorMessage =
      data && typeof data === 'object' && data.error
        ? data.details
          ? `${data.error}: ${data.details}`
          : data.error
        : data?.message || data || `Erro HTTP ${response.status}`;
    throw new Error(errorMessage);
  }

  return data;
};

const renderEmptyRow = (tableBody, colspan, message) => {
  tableBody.innerHTML = '';
  const tr = document.createElement('tr');
  tr.innerHTML = `<td colspan="${colspan}">${escapeHtml(message)}</td>`;
  tableBody.appendChild(tr);
};

const setView = (authenticated) => {
  if (authenticated) {
    loginView.classList.add('hidden');
    adminView.classList.remove('hidden');
  } else {
    adminView.classList.add('hidden');
    loginView.classList.remove('hidden');
  }
};

const setActiveTab = (tabName) => {
  state.currentTab = tabName;

  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  document.querySelectorAll('.panel').forEach((panel) => {
    const isActive = panel.id === `tab-${tabName}`;
    panel.classList.toggle('hidden', !isActive);
    panel.classList.toggle('active-panel', isActive);
  });
};

const loadDashboard = async () => {
  state.dashboard = await apiRequest('/api/admin/dashboard');
  dashPosts.textContent = String(state.dashboard.posts || 0);
  dashLikes.textContent = String(state.dashboard.likes || 0);
  dashContent.textContent = String(state.dashboard.siteContent || 0);
  dashPortfolio.textContent = String(state.dashboard.portfolio || 0);
  dashProducts.textContent = String(state.dashboard.products || 0);
  dashActiveProducts.textContent = String(state.dashboard.activeProducts || 0);
  dashOrders.textContent = String(state.dashboard.orders || 0);
  dashPendingOrders.textContent = String(state.dashboard.pendingOrders || 0);
  dashUsers.textContent = String(state.dashboard.users || 0);
  dashUpdated.textContent = new Date().toLocaleString('pt-BR');
};

const loadAllData = async () => {
  await Promise.all([
    loadDashboard(),
    loadContent(),
    loadPosts(),
    loadPortfolio(),
    loadProducts(),
    loadOrders(),
    loadMedia(),
    loadUsers(),
  ]);
};

const checkAuth = async () => {
  try {
    const result = await apiRequest('/api/admin/auth/me');
    state.user = result.user;
    userLabel.textContent = `Logado como ${state.user.username}`;
    setView(true);
    await loadAllData();
  } catch {
    setView(false);
  }
};

const domBindings = {
  loginView,
  adminView,
  toast,
  userLabel,
  loginForm,
  loginUsername,
  loginPassword,
  logoutBtn,
  refreshAllBtn,
  tabsNav,
  dashPosts,
  dashLikes,
  dashContent,
  dashPortfolio,
  dashProducts,
  dashActiveProducts,
  dashOrders,
  dashPendingOrders,
  dashUsers,
  dashUpdated,
  contentFormTitle,
  contentForm,
  contentResetBtn,
  contentSearch,
  contentTable,
  contentId,
  contentKey,
  contentSection,
  contentTitle,
  contentType,
  contentValue,
  contentSort,
  postFormTitle,
  postForm,
  postResetBtn,
  postSearch,
  postsTable,
  postId,
  postTitle,
  postExcerpt,
  postContent,
  postDate,
  postImage,
  postImageFile,
  postLikes,
  portfolioFormTitle,
  portfolioForm,
  portfolioResetBtn,
  portfolioSearch,
  portfolioTable,
  portfolioId,
  portfolioTitle,
  portfolioCategory,
  portfolioYear,
  portfolioSort,
  portfolioImage,
  portfolioImageFile,
  portfolioDescription,
  portfolioActive,
  productFormTitle,
  productForm,
  productResetBtn,
  productSearch,
  productsTable,
  productId,
  productName,
  productSlug,
  productCategory,
  productPrice,
  productStock,
  productImage,
  productActive,
  productShort,
  productDescription,
  productGallery,
  ordersStatusFilter,
  ordersTable,
  orderSelected,
  orderDetails,
  orderUpdateForm,
  orderStatus,
  orderNotes,
  orderDeleteBtn,
  mediaUploadForm,
  mediaUploadFile,
  mediaRefreshBtn,
  mediaGrid,
  userFormTitle,
  userForm,
  userResetBtn,
  usersSearch,
  usersTable,
  userId,
  userUsername,
  userPassword,
  userActive,
};

const missingDomBindings = Object.entries(domBindings)
  .filter(([, element]) => !element)
  .map(([name]) => name);

const hasAllDomBindings = missingDomBindings.length === 0;

if (!hasAllDomBindings) {
  console.error(
    `[admin] Estrutura do painel incompleta. Atualize o deploy/cache e recarregue a pagina. Elementos ausentes: ${missingDomBindings.join(', ')}`
  );
}

const clearContentForm = () => {
  contentId.value = '';
  contentKey.value = '';
  contentSection.value = 'geral';
  contentTitle.value = '';
  contentType.value = 'text';
  contentValue.value = '';
  contentSort.value = '0';
  contentFormTitle.textContent = 'Novo conteudo';
};

const fillContentForm = (item) => {
  contentId.value = String(item.id);
  contentKey.value = item.key || '';
  contentSection.value = item.section || 'geral';
  contentTitle.value = item.title || '';
  contentType.value = item.type || 'text';
  contentValue.value = item.value || '';
  contentSort.value = String(Number(item.sortOrder || 0));
  contentFormTitle.textContent = `Editando conteudo #${item.id}`;
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const renderContent = () => {
  if (!state.filteredContent.length) {
    renderEmptyRow(contentTable, 5, 'Nenhum conteudo encontrado.');
    return;
  }

  contentTable.innerHTML = '';
  state.filteredContent.forEach((item) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.id}</td>
      <td><strong>${escapeHtml(item.key)}</strong><br /><small>${escapeHtml(item.title || '-')}</small></td>
      <td>${escapeHtml(item.section || '-')}</td>
      <td>${escapeHtml(String(item.value || '').slice(0, 90))}</td>
      <td>
        <div class="actions">
          <button type="button" class="secondary" data-action="edit" data-id="${item.id}">Editar</button>
          <button type="button" class="danger" data-action="delete" data-id="${item.id}">Excluir</button>
        </div>
      </td>
    `;
    contentTable.appendChild(tr);
  });
};

const applyContentFilter = () => {
  const term = String(contentSearch.value || '').trim().toLowerCase();

  state.filteredContent = state.content.filter((item) => {
    if (!term) return true;
    return [item.key, item.section, item.title, item.value].some((field) =>
      String(field || '').toLowerCase().includes(term)
    );
  });

  renderContent();
};

const loadContent = async () => {
  const content = await apiRequest('/api/admin/site-content');
  state.content = Array.isArray(content) ? content : [];
  applyContentFilter();
};

const clearPostForm = () => {
  postId.value = '';
  postTitle.value = '';
  postExcerpt.value = '';
  postContent.value = '';
  postDate.value = todayPtBr();
  postImage.value = '';
  postImageFile.value = '';
  postLikes.value = '0';
  postFormTitle.textContent = 'Novo post';
};

const fillPostForm = (post) => {
  postId.value = String(post.id);
  postTitle.value = post.title || '';
  postExcerpt.value = post.excerpt || '';
  postContent.value = post.content || '';
  postDate.value = post.date || todayPtBr();
  postImage.value = post.image || '';
  postImageFile.value = '';
  postLikes.value = String(Number(post.likes || 0));
  postFormTitle.textContent = `Editando post #${post.id}`;
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const renderPosts = () => {
  if (!state.filteredPosts.length) {
    renderEmptyRow(postsTable, 5, 'Nenhum post encontrado.');
    return;
  }

  postsTable.innerHTML = '';
  state.filteredPosts.forEach((post) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${post.id}</td>
      <td><strong>${escapeHtml(post.title || '')}</strong><br /><small>${escapeHtml(String(post.excerpt || '').slice(0, 80))}</small></td>
      <td>${escapeHtml(post.date || '-')}</td>
      <td>${Number(post.likes || 0)}</td>
      <td>
        <div class="actions">
          <button type="button" class="secondary" data-action="edit" data-id="${post.id}">Editar</button>
          <button type="button" class="danger" data-action="delete" data-id="${post.id}">Excluir</button>
        </div>
      </td>
    `;
    postsTable.appendChild(tr);
  });
};

const applyPostFilter = () => {
  const term = String(postSearch.value || '').trim().toLowerCase();
  state.filteredPosts = state.posts.filter((post) => {
    if (!term) return true;
    return [post.title, post.excerpt, post.content].some((field) =>
      String(field || '').toLowerCase().includes(term)
    );
  });
  renderPosts();
};

const loadPosts = async () => {
  const posts = await apiRequest('/api/admin/posts');
  state.posts = Array.isArray(posts) ? posts.sort((a, b) => Number(b.id) - Number(a.id)) : [];
  applyPostFilter();
};

const clearPortfolioForm = () => {
  portfolioId.value = '';
  portfolioTitle.value = '';
  portfolioCategory.value = '';
  portfolioYear.value = '';
  portfolioSort.value = '0';
  portfolioImage.value = '';
  portfolioImageFile.value = '';
  portfolioDescription.value = '';
  portfolioActive.checked = true;
  portfolioFormTitle.textContent = 'Novo trabalho do acervo';
};

const fillPortfolioForm = (item) => {
  portfolioId.value = String(item.id);
  portfolioTitle.value = item.title || '';
  portfolioCategory.value = item.category || '';
  portfolioYear.value = item.year || '';
  portfolioSort.value = String(Number(item.sortOrder || 0));
  portfolioImage.value = item.image || '';
  portfolioImageFile.value = '';
  portfolioDescription.value = item.description || '';
  portfolioActive.checked = Boolean(item.isActive);
  portfolioFormTitle.textContent = `Editando trabalho #${item.id}`;
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const renderPortfolio = () => {
  if (!state.filteredPortfolio.length) {
    renderEmptyRow(portfolioTable, 6, 'Nenhum trabalho no acervo.');
    return;
  }

  portfolioTable.innerHTML = '';
  state.filteredPortfolio.forEach((item) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.id}</td>
      <td>
        <strong>${escapeHtml(item.title || '')}</strong>
        <div><small>${escapeHtml(String(item.description || '').slice(0, 80))}</small></div>
      </td>
      <td>${escapeHtml(item.category || '-')}</td>
      <td>${escapeHtml(item.year || '-')}</td>
      <td><span class="status-pill ${item.isActive ? 'entregue' : 'cancelado'}">${item.isActive ? 'Ativo' : 'Inativo'}</span></td>
      <td>
        <div class="actions">
          <button type="button" class="secondary" data-action="edit" data-id="${item.id}">Editar</button>
          <button type="button" class="danger" data-action="delete" data-id="${item.id}">Excluir</button>
        </div>
      </td>
    `;
    portfolioTable.appendChild(tr);
  });
};

const applyPortfolioFilter = () => {
  const term = String(portfolioSearch.value || '').trim().toLowerCase();
  state.filteredPortfolio = state.portfolio.filter((item) => {
    if (!term) return true;
    return [item.title, item.category, item.year, item.description].some((field) =>
      String(field || '').toLowerCase().includes(term)
    );
  });
  renderPortfolio();
};

const loadPortfolio = async () => {
  const portfolio = await apiRequest('/api/admin/portfolio');
  state.portfolio = Array.isArray(portfolio) ? portfolio : [];
  applyPortfolioFilter();
};

const uploadImageIfNeeded = async (fileInput) => {
  if (!fileInput.files || !fileInput.files.length) {
    return null;
  }

  const fd = new FormData();
  fd.append('image', fileInput.files[0]);
  const result = await apiRequest('/api/admin/upload', {
    method: 'POST',
    body: fd,
    headers: {},
  });

  return result.url;
};

const clearProductForm = () => {
  productId.value = '';
  productName.value = '';
  productSlug.value = '';
  productCategory.value = '';
  productPrice.value = '0';
  productStock.value = '0';
  productImage.value = '';
  productActive.checked = true;
  productShort.value = '';
  productDescription.value = '';
  productGallery.value = '';
  productFormTitle.textContent = 'Novo produto';
};

const fillProductForm = (product) => {
  productId.value = String(product.id);
  productName.value = product.name || '';
  productSlug.value = product.slug || '';
  productCategory.value = product.category || '';
  productPrice.value = String(Number(product.price || 0));
  productStock.value = String(Number(product.stock || 0));
  productImage.value = product.image || '';
  productActive.checked = Boolean(product.isActive);
  productShort.value = product.shortDescription || '';
  productDescription.value = product.description || '';
  productGallery.value = Array.isArray(product.gallery) ? product.gallery.join('\n') : '';
  productFormTitle.textContent = `Editando produto #${product.id}`;
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const renderProducts = () => {
  if (!state.filteredProducts.length) {
    renderEmptyRow(productsTable, 6, 'Nenhum produto encontrado.');
    return;
  }

  productsTable.innerHTML = '';
  state.filteredProducts.forEach((product) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${product.id}</td>
      <td>
        <strong>${escapeHtml(product.name || '')}</strong>
        <div><small>${escapeHtml(product.slug || '')}</small></div>
      </td>
      <td>${formatMoney(product.price || 0)}</td>
      <td>${Number(product.stock || 0)}</td>
      <td><span class="status-pill ${product.isActive ? 'entregue' : 'cancelado'}">${product.isActive ? 'Ativo' : 'Inativo'}</span></td>
      <td>
        <div class="actions">
          <button type="button" class="secondary" data-action="edit" data-id="${product.id}">Editar</button>
          <button type="button" class="danger" data-action="delete" data-id="${product.id}">Excluir</button>
        </div>
      </td>
    `;
    productsTable.appendChild(tr);
  });
};

const applyProductFilter = () => {
  const term = String(productSearch.value || '').trim().toLowerCase();
  state.filteredProducts = state.products.filter((product) => {
    if (!term) return true;
    return [product.name, product.slug, product.category].some((field) =>
      String(field || '').toLowerCase().includes(term)
    );
  });
  renderProducts();
};

const loadProducts = async () => {
  const products = await apiRequest('/api/admin/products');
  state.products = Array.isArray(products) ? products : [];
  applyProductFilter();
};

contentForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const payload = {
    key: contentKey.value.trim(),
    section: contentSection.value.trim(),
    title: contentTitle.value.trim(),
    type: contentType.value,
    value: contentValue.value,
    sortOrder: Number(contentSort.value || 0),
  };

  try {
    if (contentId.value) {
      await apiRequest(`/api/admin/site-content/${contentId.value}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      showToast('Conteudo atualizado.');
    } else {
      await apiRequest('/api/admin/site-content', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      showToast('Conteudo criado.');
    }

    clearContentForm();
    await Promise.all([loadContent(), loadDashboard()]);
  } catch (error) {
    showToast(error.message, 'error');
  }
});

contentResetBtn.addEventListener('click', clearContentForm);
contentSearch.addEventListener('input', applyContentFilter);

contentTable.addEventListener('click', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const action = target.dataset.action;
  const id = Number(target.dataset.id);
  if (!action || !Number.isFinite(id)) return;

  const item = state.content.find((row) => Number(row.id) === id);
  if (!item) return;

  if (action === 'edit') {
    fillContentForm(item);
    return;
  }

  if (action === 'delete') {
    const confirmed = window.confirm(`Excluir conteudo #${id}?`);
    if (!confirmed) return;

    try {
      await apiRequest(`/api/admin/site-content/${id}`, { method: 'DELETE' });
      showToast('Conteudo removido.');
      if (String(id) === contentId.value) clearContentForm();
      await Promise.all([loadContent(), loadDashboard()]);
    } catch (error) {
      showToast(error.message, 'error');
    }
  }
});

postForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!postTitle.value.trim() || !postContent.value.trim()) {
    showToast('Titulo e conteudo sao obrigatorios.', 'error');
    return;
  }

  try {
    const uploadedImageUrl = await uploadImageIfNeeded(postImageFile);
    const payload = {
      title: postTitle.value.trim(),
      excerpt: postExcerpt.value.trim(),
      content: postContent.value.trim(),
      date: postDate.value.trim() || todayPtBr(),
      image: uploadedImageUrl || postImage.value.trim(),
      likes: Number(postLikes.value || 0),
    };

    if (postId.value) {
      await apiRequest(`/api/admin/posts/${postId.value}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      showToast('Post atualizado.');
    } else {
      await apiRequest('/api/admin/posts', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      showToast('Post criado.');
    }

    clearPostForm();
    await Promise.all([loadPosts(), loadDashboard()]);
  } catch (error) {
    showToast(error.message, 'error');
  }
});

postResetBtn.addEventListener('click', clearPostForm);
postSearch.addEventListener('input', applyPostFilter);

postsTable.addEventListener('click', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const action = target.dataset.action;
  const id = Number(target.dataset.id);
  if (!action || !Number.isFinite(id)) return;

  const item = state.posts.find((post) => Number(post.id) === id);
  if (!item) return;

  if (action === 'edit') {
    fillPostForm(item);
    return;
  }

  if (action === 'delete') {
    const confirmed = window.confirm(`Excluir post #${id}?`);
    if (!confirmed) return;

    try {
      await apiRequest(`/api/admin/posts/${id}`, { method: 'DELETE' });
      showToast('Post removido.');
      if (String(id) === postId.value) clearPostForm();
      await Promise.all([loadPosts(), loadDashboard()]);
    } catch (error) {
      showToast(error.message, 'error');
    }
  }
});

portfolioForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!portfolioTitle.value.trim()) {
    showToast('Titulo do trabalho e obrigatorio.', 'error');
    return;
  }

  try {
    const uploadedImageUrl = await uploadImageIfNeeded(portfolioImageFile);
    const payload = {
      title: portfolioTitle.value.trim(),
      category: portfolioCategory.value.trim(),
      year: portfolioYear.value.trim(),
      sortOrder: Number(portfolioSort.value || 0),
      image: uploadedImageUrl || portfolioImage.value.trim(),
      description: portfolioDescription.value.trim(),
      isActive: portfolioActive.checked,
    };

    if (!payload.image) {
      showToast('Imagem do trabalho e obrigatoria.', 'error');
      return;
    }

    if (portfolioId.value) {
      await apiRequest(`/api/admin/portfolio/${portfolioId.value}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      showToast('Trabalho do acervo atualizado.');
    } else {
      await apiRequest('/api/admin/portfolio', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      showToast('Trabalho do acervo criado.');
    }

    clearPortfolioForm();
    await Promise.all([loadPortfolio(), loadDashboard()]);
  } catch (error) {
    showToast(error.message, 'error');
  }
});

portfolioResetBtn.addEventListener('click', clearPortfolioForm);
portfolioSearch.addEventListener('input', applyPortfolioFilter);

portfolioTable.addEventListener('click', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const action = target.dataset.action;
  const id = Number(target.dataset.id);
  if (!action || !Number.isFinite(id)) return;

  const item = state.portfolio.find((row) => Number(row.id) === id);
  if (!item) return;

  if (action === 'edit') {
    fillPortfolioForm(item);
    return;
  }

  if (action === 'delete') {
    const confirmed = window.confirm(`Excluir trabalho #${id} do acervo?`);
    if (!confirmed) return;

    try {
      await apiRequest(`/api/admin/portfolio/${id}`, { method: 'DELETE' });
      showToast('Trabalho removido do acervo.');
      if (String(id) === portfolioId.value) clearPortfolioForm();
      await Promise.all([loadPortfolio(), loadDashboard()]);
    } catch (error) {
      showToast(error.message, 'error');
    }
  }
});

productForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const payload = {
    name: productName.value.trim(),
    slug: productSlug.value.trim(),
    category: productCategory.value.trim(),
    price: Number(productPrice.value || 0),
    stock: Number(productStock.value || 0),
    image: productImage.value.trim(),
    isActive: productActive.checked,
    shortDescription: productShort.value.trim(),
    description: productDescription.value.trim(),
    gallery: productGallery.value
      .split(/\r?\n/g)
      .map((item) => item.trim())
      .filter(Boolean),
  };

  if (!payload.name) {
    showToast('Nome do produto e obrigatorio.', 'error');
    return;
  }

  try {
    if (productId.value) {
      await apiRequest(`/api/admin/products/${productId.value}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      showToast('Produto atualizado.');
    } else {
      await apiRequest('/api/admin/products', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      showToast('Produto criado.');
    }

    clearProductForm();
    await Promise.all([loadProducts(), loadDashboard()]);
  } catch (error) {
    showToast(error.message, 'error');
  }
});

productResetBtn.addEventListener('click', clearProductForm);
productSearch.addEventListener('input', applyProductFilter);

productsTable.addEventListener('click', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const action = target.dataset.action;
  const id = Number(target.dataset.id);
  if (!action || !Number.isFinite(id)) return;

  const item = state.products.find((product) => Number(product.id) === id);
  if (!item) return;

  if (action === 'edit') {
    fillProductForm(item);
    return;
  }

  if (action === 'delete') {
    const confirmed = window.confirm(`Excluir produto #${id}?`);
    if (!confirmed) return;

    try {
      await apiRequest(`/api/admin/products/${id}`, { method: 'DELETE' });
      showToast('Produto removido.');
      if (String(id) === productId.value) clearProductForm();
      await Promise.all([loadProducts(), loadDashboard()]);
    } catch (error) {
      showToast(error.message, 'error');
    }
  }
});
const setSelectedOrder = (order) => {
  if (!order) {
    state.selectedOrderId = null;
    orderSelected.textContent = 'Nenhum selecionado';
    orderDetails.textContent = 'Selecione um pedido para visualizar.';
    orderStatus.value = 'novo';
    orderNotes.value = '';
    return;
  }

  state.selectedOrderId = Number(order.id);
  orderSelected.textContent = `Pedido #${order.id}`;
  orderStatus.value = String(order.status || 'novo');
  orderNotes.value = order.notes || '';

  const lines = [];
  lines.push(`Cliente: ${order.customerName || '-'}`);
  lines.push(`Email: ${order.customerEmail || '-'}`);
  lines.push(`Telefone: ${order.customerPhone || '-'}`);
  lines.push(`Endereco: ${order.shippingAddress || '-'}`);
  lines.push(`Pagamento: ${order.paymentMethod || '-'}`);
  lines.push(`Status: ${statusLabel(order.status)}`);
  lines.push(`Total: ${formatMoney(order.totalAmount || 0)}`);
  lines.push(`Criado em: ${formatDateTime(order.createdAt)}`);

  if (Array.isArray(order.items) && order.items.length) {
    lines.push('');
    lines.push('Itens:');
    order.items.forEach((item, index) => {
      lines.push(
        `${index + 1}. ${item.name || 'Item'} x${Number(item.quantity || 0)} (${formatMoney(item.unitPrice || 0)})`
      );
    });
  }

  orderDetails.textContent = lines.join('\n');
};

const renderOrders = () => {
  if (!state.orders.length) {
    renderEmptyRow(ordersTable, 6, 'Nenhum pedido encontrado.');
    setSelectedOrder(null);
    return;
  }

  ordersTable.innerHTML = '';

  state.orders.forEach((order) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${order.id}</td>
      <td><strong>${escapeHtml(order.customerName || '-')}</strong><br /><small>${escapeHtml(order.customerEmail || '')}</small></td>
      <td>${formatMoney(order.totalAmount || 0)}</td>
      <td><span class="status-pill ${escapeHtml(order.status || '')}">${escapeHtml(statusLabel(order.status))}</span></td>
      <td>${escapeHtml(formatDateTime(order.createdAt))}</td>
      <td>
        <div class="actions">
          <button type="button" class="secondary" data-action="view" data-id="${order.id}">Ver</button>
        </div>
      </td>
    `;

    ordersTable.appendChild(tr);
  });

  if (state.selectedOrderId) {
    const selected = state.orders.find((order) => Number(order.id) === Number(state.selectedOrderId));
    setSelectedOrder(selected || null);
  }
};

const loadOrders = async () => {
  const status = String(ordersStatusFilter.value || '').trim();
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  const orders = await apiRequest(`/api/admin/orders${query}`);
  state.orders = Array.isArray(orders) ? orders : [];
  renderOrders();
};

const renderMedia = () => {
  mediaGrid.innerHTML = '';

  if (!state.media.length) {
    mediaGrid.innerHTML = '<p>Nenhum arquivo encontrado.</p>';
    return;
  }

  state.media.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'media-card';

    card.innerHTML = `
      <img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.filename)}" class="media-preview" />
      <div class="media-meta">
        <strong title="${escapeHtml(item.filename)}">${escapeHtml(String(item.filename || '').slice(0, 30))}</strong>
        <small>${escapeHtml(formatDateTime(item.updatedAt))}</small>
        <small>${escapeHtml(String(item.size || 0))} bytes</small>
        <button type="button" class="danger" data-action="delete" data-filename="${escapeHtml(item.filename)}">Excluir</button>
      </div>
    `;

    mediaGrid.appendChild(card);
  });
};

const loadMedia = async () => {
  const media = await apiRequest('/api/admin/media');
  state.media = Array.isArray(media) ? media : [];
  renderMedia();
};

const clearUserForm = () => {
  userId.value = '';
  userUsername.value = '';
  userPassword.value = '';
  userActive.checked = true;
  userFormTitle.textContent = 'Novo usuario admin';
};

const fillUserForm = (user) => {
  userId.value = String(user.id);
  userUsername.value = user.username || '';
  userPassword.value = '';
  userActive.checked = Boolean(user.isActive);
  userFormTitle.textContent = `Editando usuario #${user.id}`;
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const renderUsers = () => {
  if (!state.filteredUsers.length) {
    renderEmptyRow(usersTable, 5, 'Nenhum usuario encontrado.');
    return;
  }

  usersTable.innerHTML = '';
  state.filteredUsers.forEach((user) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${user.id}</td>
      <td>${escapeHtml(user.username || '')}</td>
      <td><span class="status-pill ${user.isActive ? 'entregue' : 'cancelado'}">${user.isActive ? 'Ativo' : 'Inativo'}</span></td>
      <td>${escapeHtml(formatDateTime(user.createdAt))}</td>
      <td>
        <div class="actions">
          <button type="button" class="secondary" data-action="edit" data-id="${user.id}">Editar</button>
          <button type="button" class="danger" data-action="disable" data-id="${user.id}">Desativar</button>
        </div>
      </td>
    `;
    usersTable.appendChild(tr);
  });
};

const applyUsersFilter = () => {
  const term = String(usersSearch.value || '').trim().toLowerCase();
  state.filteredUsers = state.users.filter((user) => {
    if (!term) return true;
    return String(user.username || '').toLowerCase().includes(term);
  });
  renderUsers();
};

const loadUsers = async () => {
  const users = await apiRequest('/api/admin/users');
  state.users = Array.isArray(users) ? users : [];
  applyUsersFilter();
};

if (hasAllDomBindings) {
ordersStatusFilter.addEventListener('change', async () => {
  try {
    await loadOrders();
  } catch (error) {
    showToast(error.message, 'error');
  }
});

ordersTable.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const action = target.dataset.action;
  const id = Number(target.dataset.id);
  if (action !== 'view' || !Number.isFinite(id)) return;

  const order = state.orders.find((item) => Number(item.id) === id);
  setSelectedOrder(order || null);
});

orderUpdateForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!state.selectedOrderId) {
    showToast('Selecione um pedido.', 'error');
    return;
  }

  try {
    await apiRequest(`/api/admin/orders/${state.selectedOrderId}`, {
      method: 'PUT',
      body: JSON.stringify({
        status: orderStatus.value,
        notes: orderNotes.value,
      }),
    });

    showToast('Pedido atualizado.');
    await Promise.all([loadOrders(), loadDashboard()]);
  } catch (error) {
    showToast(error.message, 'error');
  }
});

orderDeleteBtn.addEventListener('click', async () => {
  if (!state.selectedOrderId) {
    showToast('Selecione um pedido.', 'error');
    return;
  }

  const confirmed = window.confirm(`Excluir pedido #${state.selectedOrderId}?`);
  if (!confirmed) return;

  try {
    await apiRequest(`/api/admin/orders/${state.selectedOrderId}`, { method: 'DELETE' });
    showToast('Pedido removido.');
    setSelectedOrder(null);
    await Promise.all([loadOrders(), loadDashboard()]);
  } catch (error) {
    showToast(error.message, 'error');
  }
});

mediaUploadForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!mediaUploadFile.files || !mediaUploadFile.files.length) {
    showToast('Selecione um arquivo.', 'error');
    return;
  }

  try {
    const url = await uploadImageIfNeeded(mediaUploadFile);
    mediaUploadFile.value = '';
    await loadMedia();
    showToast(`Upload concluido: ${url}`);
  } catch (error) {
    showToast(error.message, 'error');
  }
});

mediaRefreshBtn.addEventListener('click', async () => {
  try {
    await loadMedia();
    showToast('Midia atualizada.');
  } catch (error) {
    showToast(error.message, 'error');
  }
});

mediaGrid.addEventListener('click', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const action = target.dataset.action;
  const filename = target.dataset.filename;
  if (action !== 'delete' || !filename) return;

  const confirmed = window.confirm(`Excluir arquivo ${filename}?`);
  if (!confirmed) return;

  try {
    await apiRequest(`/api/admin/media/${encodeURIComponent(filename)}`, { method: 'DELETE' });
    showToast('Arquivo removido.');
    await loadMedia();
  } catch (error) {
    showToast(error.message, 'error');
  }
});

userForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const payload = {
    username: userUsername.value.trim(),
    password: userPassword.value,
    isActive: userActive.checked,
  };

  if (!payload.username) {
    showToast('Usuario e obrigatorio.', 'error');
    return;
  }

  if (!userId.value && payload.password.length < 6) {
    showToast('Senha deve ter ao menos 6 caracteres.', 'error');
    return;
  }

  try {
    if (!payload.password) {
      delete payload.password;
    }

    if (userId.value) {
      await apiRequest(`/api/admin/users/${userId.value}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      showToast('Usuario atualizado.');
    } else {
      await apiRequest('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      showToast('Usuario criado.');
    }

    clearUserForm();
    await Promise.all([loadUsers(), loadDashboard()]);
  } catch (error) {
    showToast(error.message, 'error');
  }
});

userResetBtn.addEventListener('click', clearUserForm);
usersSearch.addEventListener('input', applyUsersFilter);

usersTable.addEventListener('click', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const action = target.dataset.action;
  const id = Number(target.dataset.id);
  if (!action || !Number.isFinite(id)) return;

  const user = state.users.find((item) => Number(item.id) === id);
  if (!user) return;

  if (action === 'edit') {
    fillUserForm(user);
    return;
  }

  if (action === 'disable') {
    const confirmed = window.confirm(`Desativar usuario #${id}?`);
    if (!confirmed) return;

    try {
      await apiRequest(`/api/admin/users/${id}`, { method: 'DELETE' });
      showToast('Usuario desativado.');
      if (String(id) === userId.value) clearUserForm();
      await Promise.all([loadUsers(), loadDashboard()]);
    } catch (error) {
      showToast(error.message, 'error');
    }
  }
});

tabsNav.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (!target.classList.contains('tab-btn')) return;

  const tab = target.dataset.tab;
  if (!tab) return;
  setActiveTab(tab);
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  try {
    const result = await apiRequest('/api/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: loginUsername.value.trim(),
        password: loginPassword.value,
      }),
    });

    state.user = result.user;
    userLabel.textContent = `Logado como ${state.user.username}`;
    loginPassword.value = '';

    setView(true);
    clearContentForm();
    clearPostForm();
    clearPortfolioForm();
    clearProductForm();
    clearUserForm();
    setSelectedOrder(null);

    await loadAllData();
    showToast('Login efetuado com sucesso.');
  } catch (error) {
    showToast(error.message, 'error');
  }
});

logoutBtn.addEventListener('click', async () => {
  try {
    await apiRequest('/api/admin/auth/logout', { method: 'POST' });
  } catch {
    // no-op
  }

  state.user = null;
  setView(false);
  showToast('Sessao encerrada.');
});

refreshAllBtn.addEventListener('click', async () => {
  try {
    await loadAllData();
    showToast('Dados atualizados.');
  } catch (error) {
    showToast(error.message, 'error');
  }
});

(async () => {
  postDate.value = todayPtBr();
  clearContentForm();
  clearPostForm();
  clearPortfolioForm();
  clearProductForm();
  clearUserForm();
  setSelectedOrder(null);
  setActiveTab('dashboard');
  await checkAuth();
})();
}
