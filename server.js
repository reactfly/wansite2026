import 'dotenv/config';
import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import { fileURLToPath } from 'url';
import { basename, dirname, join } from 'path';
import multer from 'multer';
import fs from 'fs';
import cors from 'cors';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 3000);

const DIST_DIR = join(__dirname, 'dist');
const DIST_INDEX = join(DIST_DIR, 'index.html');
const ROOT_INDEX = join(__dirname, 'index.html');
const ADMIN_DIR = join(__dirname, 'admin');
const HAS_DIST_BUILD = fs.existsSync(DIST_INDEX);
const POSTS_FILE = join(__dirname, 'posts.json');
const UPLOADS_DIR = join(__dirname, 'public', 'uploads');

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'wanbitha',
  port: Number(process.env.DB_PORT || 3306),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
  connectTimeout: 2000,
  acquireTimeout: 2000,
};

const AUTH_COOKIE_NAME = 'wb_admin_token';
const JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.ADMIN_JWT_EXPIRES_IN || '12h';
const ADMIN_DEFAULT_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_DEFAULT_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

const CONTENT_TYPES = new Set(['text', 'richtext', 'json']);
const ORDER_STATUSES = new Set(['novo', 'aguardando_pagamento', 'pago', 'em_preparo', 'enviado', 'entregue', 'cancelado']);

const DEFAULT_SITE_CONTENT = [
  { key: 'artist_name', section: 'hero', title: 'Nome da Artista', type: 'text', value: "Wan Bit'ha", sortOrder: 1 },
  { key: 'artist_role', section: 'hero', title: 'Subtitulo', type: 'text', value: 'Artista Brasileira', sortOrder: 2 },
  { key: 'hero_services', section: 'hero', title: 'Servicos principais', type: 'text', value: 'Pintura | Ilustracoes | Bordados | Acessorios.', sortOrder: 3 },
  { key: 'hero_line_1', section: 'hero', title: 'Frase principal 1', type: 'text', value: 'Artes que contam historias', sortOrder: 4 },
  { key: 'hero_line_2', section: 'hero', title: 'Frase principal 2', type: 'text', value: 'Vivencias da Alma Criadora', sortOrder: 5 },
  { key: 'hero_line_3', section: 'hero', title: 'Frase principal 3', type: 'text', value: 'Resgatando o fluxo de vida da Arte Ancestral', sortOrder: 6 },
];

let dbPool = null;

// Segurança e performance
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.tailwindcss.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://fonts.googleapis.com", "data:"],
      imgSrc: ["'self'", "data:", "blob:", "https:", "http:", "*"],
      connectSrc: ["'self'", "https:", "http:", "ws:", "wss:"],
      mediaSrc: ["'self'", "https:", "http:", "data:", "blob:"],
      frameSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());
app.use(morgan('combined'));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const ensureUploadsDir = () => {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
};

const safeJsonParse = (value, fallback) => {
  if (typeof value !== 'string') {
    return fallback;
  }
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'sim', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'nao', 'off'].includes(normalized)) return false;
  }
  return fallback;
};

const roundMoney = (value) => Math.round(toNumber(value, 0) * 100) / 100;

const slugify = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);

const normalizeContentKey = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 180);

const normalizeGalleryInput = (value) => {
  const source = Array.isArray(value)
    ? value
    : String(value || '')
        .split(/\r?\n|,/g)
        .map((item) => item.trim());

  const unique = new Set();
  for (const item of source) {
    const normalized = String(item || '').trim();
    if (normalized) unique.add(normalized);
  }
  return [...unique];
};

ensureUploadsDir();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: isDbConnected() ? 'connected' : 'disconnected'
  });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureUploadsDir();
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const safeName = String(file.originalname || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const upload = multer({ storage });

app.use('/public/uploads', express.static(UPLOADS_DIR));

app.use(
  '/assets',
  express.static(HAS_DIST_BUILD ? join(DIST_DIR, 'assets') : join(__dirname, 'assets'), {
    maxAge: '1y',
    immutable: true,
  })
);

app.use('/admin', express.static(ADMIN_DIR));
app.use('/imagens', express.static(join(__dirname, 'imagens')));
app.use('/gallery', express.static(join(__dirname, 'gallery')));

app.use(
  express.static(HAS_DIST_BUILD ? DIST_DIR : __dirname, {
    maxAge: '1h',
  })
);

const isDbConnected = () => dbPool !== null;

const requireDatabase = (req, res, next) => {
  if (!isDbConnected()) {
    if (req.method === 'GET') return next();
    return res.status(200).json({ 
      offline: true, 
      message: 'Modo Offline: No momento nao e possivel salvar alteracoes (Banco indisponivel).' 
    });
  }
  return next();
};

const getPostsFromFile = () => {
  if (!fs.existsSync(POSTS_FILE)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(POSTS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const savePostsToFile = (posts) => {
  fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2));
};

const normalizePost = (row) => ({
  id: Number(row.id),
  title: row.title ?? '',
  excerpt: row.excerpt ?? '',
  content: row.content ?? '',
  image: row.image ?? '',
  date: row.date ?? row.post_date ?? '',
  likes: Number(row.likes || 0),
});

const normalizeSiteContent = (row) => ({
  id: Number(row.id),
  key: row.content_key ?? '',
  section: row.section ?? 'geral',
  title: row.title ?? '',
  type: row.content_type ?? 'text',
  value: row.content_value ?? '',
  sortOrder: Number(row.sort_order || 0),
  updatedAt: row.updated_at || null,
});

const normalizeProduct = (row) => ({
  id: Number(row.id),
  slug: row.slug ?? '',
  name: row.name ?? '',
  shortDescription: row.short_description ?? '',
  description: row.description ?? '',
  image: row.image ?? '',
  gallery: Array.isArray(safeJsonParse(row.gallery_json, [])) ? safeJsonParse(row.gallery_json, []) : [],
  category: row.category ?? '',
  price: Number(row.price || 0),
  stock: Number(row.stock || 0),
  isActive: Number(row.is_active || 0) === 1,
  createdAt: row.created_at || null,
  updatedAt: row.updated_at || null,
});

const normalizePortfolioItem = (row) => ({
  id: Number(row.id),
  title: row.title ?? '',
  description: row.description ?? '',
  image: row.image ?? '',
  category: row.category ?? '',
  year: row.work_year ?? '',
  sortOrder: Number(row.sort_order || 0),
  isActive: Number(row.is_active || 0) === 1,
  createdAt: row.created_at || null,
  updatedAt: row.updated_at || null,
});

const normalizeOrder = (row) => ({
  id: Number(row.id),
  customerName: row.customer_name ?? '',
  customerEmail: row.customer_email ?? '',
  customerPhone: row.customer_phone ?? '',
  shippingAddress: row.shipping_address ?? '',
  paymentMethod: row.payment_method ?? '',
  status: row.status ?? 'novo',
  totalAmount: Number(row.total_amount || 0),
  items: Array.isArray(safeJsonParse(row.items_json, [])) ? safeJsonParse(row.items_json, []) : [],
  notes: row.notes ?? '',
  createdAt: row.created_at || null,
  updatedAt: row.updated_at || null,
});

const normalizeAdminUser = (row) => ({
  id: Number(row.id),
  username: row.username ?? '',
  isActive: Number(row.is_active || 0) === 1,
  createdAt: row.created_at || null,
});

const getAuthTokenFromRequest = (req) => {
  const cookieToken = req.cookies?.[AUTH_COOKIE_NAME];
  if (cookieToken) return cookieToken;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return null;
};

const signAdminToken = (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

const setAuthCookie = (res, token) => {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 12 * 60 * 60 * 1000,
  });
};

const clearAuthCookie = (res) => {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
};

const verifyAdminToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
};

const requireAdminAuth = async (req, res, next) => {
  const token = getAuthTokenFromRequest(req);
  if (!token) {
    return res.status(401).json({ error: 'Nao autenticado' });
  }

  const payload = verifyAdminToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Token invalido ou expirado' });
  }

  if (!isDbConnected()) {
    if (payload.username !== ADMIN_DEFAULT_USERNAME) {
      return res.status(401).json({ error: 'Usuario admin invalido' });
    }

    req.admin = { id: 0, username: ADMIN_DEFAULT_USERNAME };
    return next();
  }

  try {
    const [rows] = await dbPool.query(
      'SELECT id, username, is_active FROM admin_users WHERE id = ? LIMIT 1',
      [payload.sub]
    );

    if (!rows.length || Number(rows[0].is_active) !== 1) {
      return res.status(401).json({ error: 'Usuario admin nao encontrado' });
    }

    req.admin = { id: Number(rows[0].id), username: rows[0].username };
    return next();
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao validar autenticacao', details: error.message });
  }
};

const getAllPosts = async () => {
  if (!isDbConnected()) {
    return getPostsFromFile().sort((a, b) => Number(b.id) - Number(a.id));
  }

  const [rows] = await dbPool.query(
    'SELECT id, title, excerpt, content, image, post_date AS date, likes FROM posts ORDER BY id DESC'
  );

  return rows.map(normalizePost);
};

const getPostById = async (postId) => {
  if (!isDbConnected()) {
    const posts = getPostsFromFile();
    return posts.find((p) => Number(p.id) === Number(postId)) || null;
  }

  const [rows] = await dbPool.query(
    'SELECT id, title, excerpt, content, image, post_date AS date, likes FROM posts WHERE id = ? LIMIT 1',
    [postId]
  );

  return rows.length ? normalizePost(rows[0]) : null;
};

const createPost = async (payload) => {
  const nowId = Date.now();
  const newPost = {
    id: Number(payload.id) || nowId,
    title: payload.title ?? '',
    excerpt: payload.excerpt ?? '',
    content: payload.content ?? '',
    image: payload.image ?? '',
    date: payload.date || new Date().toLocaleDateString('pt-BR'),
    likes: Number(payload.likes || 0),
  };

  if (!isDbConnected()) {
    const posts = getPostsFromFile();
    posts.unshift(newPost);
    savePostsToFile(posts);
    return newPost;
  }

  await dbPool.query(
    `INSERT INTO posts (id, title, excerpt, content, image, post_date, likes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      newPost.id,
      newPost.title,
      newPost.excerpt,
      newPost.content,
      newPost.image,
      newPost.date,
      newPost.likes,
    ]
  );

  return newPost;
};

const updatePost = async (postId, payload) => {
  if (!isDbConnected()) {
    const posts = getPostsFromFile();
    const index = posts.findIndex((p) => Number(p.id) === Number(postId));
    if (index === -1) {
      return null;
    }

    posts[index] = {
      ...posts[index],
      ...payload,
      id: Number(postId),
      likes: Number(payload.likes ?? posts[index].likes ?? 0),
    };

    savePostsToFile(posts);
    return posts[index];
  }

  const current = await getPostById(postId);
  if (!current) {
    return null;
  }

  const merged = {
    ...current,
    ...payload,
    id: Number(postId),
    likes: Number(payload.likes ?? current.likes ?? 0),
  };

  await dbPool.query(
    `UPDATE posts
       SET title = ?, excerpt = ?, content = ?, image = ?, post_date = ?, likes = ?
     WHERE id = ?`,
    [
      merged.title ?? '',
      merged.excerpt ?? '',
      merged.content ?? '',
      merged.image ?? '',
      merged.date ?? '',
      merged.likes,
      Number(postId),
    ]
  );

  return merged;
};

const deletePost = async (postId) => {
  if (!isDbConnected()) {
    const posts = getPostsFromFile();
    const index = posts.findIndex((p) => Number(p.id) === Number(postId));
    if (index === -1) {
      return false;
    }

    posts.splice(index, 1);
    savePostsToFile(posts);
    return true;
  }

  const [result] = await dbPool.query('DELETE FROM posts WHERE id = ?', [Number(postId)]);
  return Number(result.affectedRows || 0) > 0;
};

const incrementPostLike = async (postId) => {
  if (!isDbConnected()) {
    const posts = getPostsFromFile();
    const index = posts.findIndex((p) => Number(p.id) === Number(postId));
    if (index === -1) {
      return null;
    }

    posts[index].likes = Number(posts[index].likes || 0) + 1;
    savePostsToFile(posts);
    return posts[index];
  }

  const [updateResult] = await dbPool.query('UPDATE posts SET likes = likes + 1 WHERE id = ?', [Number(postId)]);
  if (Number(updateResult.affectedRows || 0) === 0) {
    return null;
  }

  return getPostById(postId);
};

const seedDatabaseFromFileIfNeeded = async () => {
  const [countRows] = await dbPool.query('SELECT COUNT(*) AS total FROM posts');
  const total = Number(countRows?.[0]?.total || 0);
  if (total > 0) {
    return;
  }

  const posts = getPostsFromFile();
  if (!posts.length) {
    return;
  }

  for (const post of posts) {
    await dbPool.query(
      `INSERT INTO posts (id, title, excerpt, content, image, post_date, likes)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         title = VALUES(title),
         excerpt = VALUES(excerpt),
         content = VALUES(content),
         image = VALUES(image),
         post_date = VALUES(post_date),
         likes = VALUES(likes)`,
      [
        Number(post.id) || Date.now(),
        post.title ?? '',
        post.excerpt ?? '',
        post.content ?? '',
        post.image ?? '',
        post.date || new Date().toLocaleDateString('pt-BR'),
        Number(post.likes || 0),
      ]
    );
  }

  console.log(`[db] ${posts.length} posts importados de posts.json`);
};

const ensureAdminUser = async () => {
  if (!isDbConnected()) {
    return;
  }

  const [rows] = await dbPool.query('SELECT id FROM admin_users WHERE username = ? LIMIT 1', [ADMIN_DEFAULT_USERNAME]);
  if (rows.length) {
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN_DEFAULT_PASSWORD, 10);
  await dbPool.query(
    'INSERT INTO admin_users (username, password_hash, is_active) VALUES (?, ?, 1)',
    [ADMIN_DEFAULT_USERNAME, passwordHash]
  );

  if (!process.env.ADMIN_PASSWORD) {
    console.warn('[auth] Usuario admin criado com senha padrao. Defina ADMIN_PASSWORD em producao.');
  }
};
const seedSiteContentDefaults = async () => {
  if (!isDbConnected()) {
    return;
  }

  const [countRows] = await dbPool.query('SELECT COUNT(*) AS total FROM site_content');
  const total = Number(countRows?.[0]?.total || 0);
  if (total > 0) {
    return;
  }

  for (const item of DEFAULT_SITE_CONTENT) {
    await dbPool.query(
      `INSERT INTO site_content (content_key, section, title, content_type, content_value, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [item.key, item.section, item.title, item.type, item.value, item.sortOrder]
    );
  }

  console.log(`[db] ${DEFAULT_SITE_CONTENT.length} registros padrao criados em site_content`);
};

const buildUniqueProductSlug = async (baseSlug, excludeId = null) => {
  const fallback = `produto-${Date.now()}`;
  const base = slugify(baseSlug) || fallback;

  if (!isDbConnected()) {
    return base;
  }

  let candidate = base;
  let counter = 2;

  while (true) {
    let query = 'SELECT id FROM products WHERE slug = ?';
    const params = [candidate];
    if (excludeId !== null) {
      query += ' AND id <> ?';
      params.push(Number(excludeId));
    }
    query += ' LIMIT 1';

    const [rows] = await dbPool.query(query, params);
    if (!rows.length) {
      return candidate;
    }

    candidate = `${base}-${counter}`;
    counter += 1;
  }
};

const normalizeOrderItemsForCreate = async (items) => {
  const source = Array.isArray(items) ? items : [];
  const productIds = [...new Set(source.map((item) => Number(item?.productId)).filter((id) => Number.isFinite(id) && id > 0))];
  const productMap = new Map();

  if (productIds.length && isDbConnected()) {
    const placeholders = productIds.map(() => '?').join(', ');
    const [rows] = await dbPool.query(
      `SELECT id, name, image, price, is_active FROM products WHERE id IN (${placeholders})`,
      productIds
    );

    for (const row of rows) {
      productMap.set(Number(row.id), row);
    }
  }

  const normalized = [];
  for (const item of source) {
    const rawProductId = Number(item?.productId);
    const quantity = Math.max(1, Math.floor(toNumber(item?.quantity, 1)));
    const product = productMap.get(rawProductId);
    const unitPrice = roundMoney(product ? product.price : item?.unitPrice ?? item?.price ?? 0);
    const safeName = String(product?.name || item?.name || '').trim();

    if (!safeName) {
      continue;
    }

    normalized.push({
      productId: Number.isFinite(rawProductId) ? rawProductId : null,
      name: safeName,
      quantity,
      unitPrice,
      subtotal: roundMoney(quantity * unitPrice),
      image: String(product?.image || item?.image || '').trim(),
    });
  }

  return normalized;
};

const listUploadedMedia = () => {
  ensureUploadsDir();

  const files = fs.readdirSync(UPLOADS_DIR, { withFileTypes: true });
  const items = [];

  for (const file of files) {
    if (!file.isFile()) {
      continue;
    }

    const fullPath = join(UPLOADS_DIR, file.name);
    const stat = fs.statSync(fullPath);

    items.push({
      filename: file.name,
      url: `/public/uploads/${file.name}`,
      size: stat.size,
      updatedAt: stat.mtime.toISOString(),
    });
  }

  items.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return items;
};

const getDashboardStats = async () => {
  if (!isDbConnected()) {
    const posts = getPostsFromFile();
    return {
      posts: posts.length,
      likes: posts.reduce((sum, post) => sum + Number(post.likes || 0), 0),
      siteContent: 0,
      portfolio: 0,
      products: 0,
      activeProducts: 0,
      orders: 0,
      pendingOrders: 0,
      users: 1,
    };
  }

  const [
    [postsRows],
    [likesRows],
    [contentRows],
    [portfolioRows],
    [productsRows],
    [activeProductsRows],
    [ordersRows],
    [pendingOrdersRows],
    [usersRows],
  ] = await Promise.all([
    dbPool.query('SELECT COUNT(*) AS total FROM posts'),
    dbPool.query('SELECT COALESCE(SUM(likes), 0) AS total FROM posts'),
    dbPool.query('SELECT COUNT(*) AS total FROM site_content'),
    dbPool.query('SELECT COUNT(*) AS total FROM portfolio_items'),
    dbPool.query('SELECT COUNT(*) AS total FROM products'),
    dbPool.query('SELECT COUNT(*) AS total FROM products WHERE is_active = 1'),
    dbPool.query('SELECT COUNT(*) AS total FROM orders'),
    dbPool.query("SELECT COUNT(*) AS total FROM orders WHERE status IN ('novo', 'aguardando_pagamento', 'pago', 'em_preparo')"),
    dbPool.query('SELECT COUNT(*) AS total FROM admin_users WHERE is_active = 1'),
  ]);

  return {
    posts: Number(postsRows?.[0]?.total || 0),
    likes: Number(likesRows?.[0]?.total || 0),
    siteContent: Number(contentRows?.[0]?.total || 0),
    portfolio: Number(portfolioRows?.[0]?.total || 0),
    products: Number(productsRows?.[0]?.total || 0),
    activeProducts: Number(activeProductsRows?.[0]?.total || 0),
    orders: Number(ordersRows?.[0]?.total || 0),
    pendingOrders: Number(pendingOrdersRows?.[0]?.total || 0),
    users: Number(usersRows?.[0]?.total || 0),
  };
};

const initializeDatabase = async () => {
  try {
    dbPool = mysql.createPool(DB_CONFIG);
    await dbPool.query('SELECT 1');

    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS posts (
        id BIGINT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        excerpt TEXT NULL,
        content LONGTEXT NULL,
        image TEXT NULL,
        post_date VARCHAR(20) NOT NULL,
        likes INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(120) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS site_content (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        content_key VARCHAR(190) NOT NULL UNIQUE,
        section VARCHAR(120) NOT NULL DEFAULT 'geral',
        title VARCHAR(255) NOT NULL DEFAULT '',
        content_type ENUM('text', 'richtext', 'json') NOT NULL DEFAULT 'text',
        content_value LONGTEXT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        slug VARCHAR(190) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        short_description TEXT NULL,
        description LONGTEXT NULL,
        image TEXT NULL,
        gallery_json LONGTEXT NULL,
        category VARCHAR(120) NULL,
        price DECIMAL(10, 2) NOT NULL DEFAULT 0,
        stock INT NOT NULL DEFAULT 0,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS portfolio_items (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT NULL,
        image TEXT NOT NULL,
        category VARCHAR(120) NULL,
        work_year VARCHAR(20) NULL,
        sort_order INT NOT NULL DEFAULT 0,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        customer_name VARCHAR(180) NOT NULL,
        customer_email VARCHAR(190) NULL,
        customer_phone VARCHAR(80) NULL,
        shipping_address TEXT NULL,
        payment_method VARCHAR(100) NULL,
        status VARCHAR(60) NOT NULL DEFAULT 'novo',
        total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
        items_json LONGTEXT NULL,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const [postDateColumn] = await dbPool.query("SHOW COLUMNS FROM posts LIKE 'post_date'");
    if (!postDateColumn.length) {
      const [legacyDateColumn] = await dbPool.query("SHOW COLUMNS FROM posts LIKE 'date'");
      if (legacyDateColumn.length) {
        await dbPool.query('ALTER TABLE posts CHANGE COLUMN `date` post_date VARCHAR(20) NULL');
      } else {
        await dbPool.query('ALTER TABLE posts ADD COLUMN post_date VARCHAR(20) NULL');
      }
    }

    const [likesColumn] = await dbPool.query("SHOW COLUMNS FROM posts LIKE 'likes'");
    if (!likesColumn.length) {
      await dbPool.query('ALTER TABLE posts ADD COLUMN likes INT NOT NULL DEFAULT 0');
    }

    const [isActiveColumn] = await dbPool.query("SHOW COLUMNS FROM admin_users LIKE 'is_active'");
    if (!isActiveColumn.length) {
      await dbPool.query('ALTER TABLE admin_users ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1');
    }

    const [portfolioTitleColumn] = await dbPool.query("SHOW COLUMNS FROM portfolio_items LIKE 'title'");
    if (!portfolioTitleColumn.length) {
      await dbPool.query("ALTER TABLE portfolio_items ADD COLUMN title VARCHAR(255) NOT NULL DEFAULT ''");
    }

    const [portfolioDescriptionColumn] = await dbPool.query("SHOW COLUMNS FROM portfolio_items LIKE 'description'");
    if (!portfolioDescriptionColumn.length) {
      await dbPool.query('ALTER TABLE portfolio_items ADD COLUMN description TEXT NULL');
    }

    const [portfolioImageColumn] = await dbPool.query("SHOW COLUMNS FROM portfolio_items LIKE 'image'");
    if (!portfolioImageColumn.length) {
      await dbPool.query('ALTER TABLE portfolio_items ADD COLUMN image TEXT NULL');
    }

    const [portfolioCategoryColumn] = await dbPool.query("SHOW COLUMNS FROM portfolio_items LIKE 'category'");
    if (!portfolioCategoryColumn.length) {
      await dbPool.query('ALTER TABLE portfolio_items ADD COLUMN category VARCHAR(120) NULL');
    }

    const [portfolioYearColumn] = await dbPool.query("SHOW COLUMNS FROM portfolio_items LIKE 'work_year'");
    if (!portfolioYearColumn.length) {
      await dbPool.query('ALTER TABLE portfolio_items ADD COLUMN work_year VARCHAR(20) NULL');
    }

    const [portfolioSortColumn] = await dbPool.query("SHOW COLUMNS FROM portfolio_items LIKE 'sort_order'");
    if (!portfolioSortColumn.length) {
      await dbPool.query('ALTER TABLE portfolio_items ADD COLUMN sort_order INT NOT NULL DEFAULT 0');
    }

    const [portfolioActiveColumn] = await dbPool.query("SHOW COLUMNS FROM portfolio_items LIKE 'is_active'");
    if (!portfolioActiveColumn.length) {
      await dbPool.query('ALTER TABLE portfolio_items ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1');
    }

    const [portfolioCreatedColumn] = await dbPool.query("SHOW COLUMNS FROM portfolio_items LIKE 'created_at'");
    if (!portfolioCreatedColumn.length) {
      await dbPool.query('ALTER TABLE portfolio_items ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    }

    const [portfolioUpdatedColumn] = await dbPool.query("SHOW COLUMNS FROM portfolio_items LIKE 'updated_at'");
    if (!portfolioUpdatedColumn.length) {
      await dbPool.query('ALTER TABLE portfolio_items ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
    }

    await seedDatabaseFromFileIfNeeded();
    await ensureAdminUser();
    await seedSiteContentDefaults();
    console.log('[db] Conexao MySQL ativa');
  } catch (error) {
    dbPool = null;
    console.error(`[db] Falha ao conectar no MySQL. Fallback em arquivo ativo: ${error.message}`);
  }
};

// Auth routes
app.post('/api/admin/auth/login', async (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario e senha sao obrigatorios' });
  }

  try {
    if (!isDbConnected()) {
      if (username !== ADMIN_DEFAULT_USERNAME || password !== ADMIN_DEFAULT_PASSWORD) {
        return res.status(401).json({ error: 'Credenciais invalidas' });
      }

      const token = signAdminToken({ sub: 0, username });
      setAuthCookie(res, token);
      return res.json({ user: { id: 0, username } });
    }

    const [rows] = await dbPool.query(
      'SELECT id, username, password_hash, is_active FROM admin_users WHERE username = ? LIMIT 1',
      [username]
    );

    if (!rows.length || Number(rows[0].is_active) !== 1) {
      return res.status(401).json({ error: 'Credenciais invalidas' });
    }

    const user = rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Credenciais invalidas' });
    }

    const token = signAdminToken({ sub: Number(user.id), username: user.username });
    setAuthCookie(res, token);
    return res.json({ user: { id: Number(user.id), username: user.username } });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao autenticar', details: error.message });
  }
});

app.get('/api/admin/auth/me', async (req, res) => {
  const token = getAuthTokenFromRequest(req);
  if (!token) {
    return res.status(401).json({ error: 'Nao autenticado' });
  }

  const payload = verifyAdminToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Token invalido ou expirado' });
  }

  if (!isDbConnected()) {
    if (payload.username !== ADMIN_DEFAULT_USERNAME) {
      return res.status(401).json({ error: 'Nao autenticado' });
    }
    return res.json({ user: { id: 0, username: ADMIN_DEFAULT_USERNAME } });
  }

  try {
    const [rows] = await dbPool.query(
      'SELECT id, username, is_active FROM admin_users WHERE id = ? LIMIT 1',
      [payload.sub]
    );

    if (!rows.length || Number(rows[0].is_active) !== 1) {
      return res.status(401).json({ error: 'Nao autenticado' });
    }

    return res.json({ user: { id: Number(rows[0].id), username: rows[0].username } });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao validar sessao', details: error.message });
  }
});

app.post('/api/admin/auth/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});
// Public content and catalog API
app.get('/api/site-content', async (req, res) => {
  if (!isDbConnected()) {
    return res.json(DEFAULT_SITE_CONTENT.map((item, index) => ({ id: index + 1, ...item })));
  }

  try {
    const [rows] = await dbPool.query(
      'SELECT id, content_key, section, title, content_type, content_value, sort_order, updated_at FROM site_content ORDER BY section ASC, sort_order ASC, id ASC'
    );
    return res.json(rows.map(normalizeSiteContent));
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar conteudo do site', details: error.message });
  }
});

app.get('/api/site-content/:key', async (req, res) => {
  const key = normalizeContentKey(req.params.key);
  if (!key) {
    return res.status(400).json({ error: 'Chave invalida' });
  }

  if (!isDbConnected()) {
    const item = DEFAULT_SITE_CONTENT.find((content) => content.key === key);
    if (!item) {
      return res.status(404).json({ error: 'Conteudo nao encontrado' });
    }
    return res.json({ id: 0, ...item });
  }

  try {
    const [rows] = await dbPool.query(
      `SELECT id, content_key, section, title, content_type, content_value, sort_order, updated_at
       FROM site_content
       WHERE content_key = ?
       LIMIT 1`,
      [key]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Conteudo nao encontrado' });
    }

    return res.json(normalizeSiteContent(rows[0]));
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar conteudo', details: error.message });
  }
});

app.get('/api/products', async (req, res) => {
  if (!isDbConnected()) {
    return res.json([]);
  }

  const includeInactive = toBoolean(req.query?.includeInactive, false);

  try {
    const conditions = [];
    const params = [];

    if (!includeInactive) {
      conditions.push('is_active = 1');
    }

    const category = String(req.query?.category || '').trim();
    if (category) {
      conditions.push('category = ?');
      params.push(category);
    }

    let query = 'SELECT * FROM products';
    if (conditions.length) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    query += ' ORDER BY id DESC';

    const [rows] = await dbPool.query(query, params);
    return res.json(rows.map(normalizeProduct));
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar produtos', details: error.message });
  }
});

app.get('/api/products/:identifier', async (req, res) => {
  if (!isDbConnected()) {
    return res.status(404).json({ error: 'Produto nao encontrado' });
  }

  const identifier = String(req.params.identifier || '').trim();
  if (!identifier) {
    return res.status(400).json({ error: 'Identificador invalido' });
  }

  try {
    const numericId = Number(identifier);
    const [rows] = Number.isFinite(numericId)
      ? await dbPool.query('SELECT * FROM products WHERE id = ? LIMIT 1', [numericId])
      : await dbPool.query('SELECT * FROM products WHERE slug = ? LIMIT 1', [identifier]);

    if (!rows.length) {
      return res.status(404).json({ error: 'Produto nao encontrado' });
    }

    return res.json(normalizeProduct(rows[0]));
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar produto', details: error.message });
  }
});

app.get('/api/portfolio', async (req, res) => {
  if (!isDbConnected()) {
    return res.json([]);
  }

  const includeInactive = toBoolean(req.query?.includeInactive, false);

  try {
    let query = 'SELECT * FROM portfolio_items';
    const params = [];

    if (!includeInactive) {
      query += ' WHERE is_active = 1';
    }

    query += ' ORDER BY sort_order ASC, id DESC';

    const [rows] = await dbPool.query(query, params);
    return res.json(rows.map(normalizePortfolioItem));
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar acervo', details: error.message });
  }
});

app.get('/api/portfolio/:id', async (req, res) => {
  if (!isDbConnected()) {
    return res.status(404).json({ error: 'Item do acervo nao encontrado' });
  }

  const itemId = Number(req.params.id);
  if (!Number.isFinite(itemId)) {
    return res.status(400).json({ error: 'ID invalido' });
  }

  try {
    const [rows] = await dbPool.query('SELECT * FROM portfolio_items WHERE id = ? LIMIT 1', [itemId]);
    if (!rows.length) {
      return res.status(404).json({ error: 'Item do acervo nao encontrado' });
    }
    return res.json(normalizePortfolioItem(rows[0]));
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar item do acervo', details: error.message });
  }
});

app.post('/api/orders', requireDatabase, async (req, res) => {
  const customerName = String(req.body?.customerName || '').trim();
  const customerEmail = String(req.body?.customerEmail || '').trim();
  const customerPhone = String(req.body?.customerPhone || '').trim();
  const shippingAddress = String(req.body?.shippingAddress || '').trim();
  const paymentMethod = String(req.body?.paymentMethod || '').trim();
  const notes = String(req.body?.notes || '').trim();

  if (!customerName) {
    return res.status(400).json({ error: 'Nome do cliente e obrigatorio' });
  }

  try {
    const normalizedItems = await normalizeOrderItemsForCreate(req.body?.items);
    if (!normalizedItems.length) {
      return res.status(400).json({ error: 'Pedido precisa de ao menos 1 item valido' });
    }

    const totalAmount = roundMoney(normalizedItems.reduce((sum, item) => sum + Number(item.subtotal || 0), 0));

    const [result] = await dbPool.query(
      `INSERT INTO orders
       (customer_name, customer_email, customer_phone, shipping_address, payment_method, status, total_amount, items_json, notes)
       VALUES (?, ?, ?, ?, ?, 'novo', ?, ?, ?)`,
      [
        customerName,
        customerEmail || null,
        customerPhone || null,
        shippingAddress || null,
        paymentMethod || null,
        totalAmount,
        JSON.stringify(normalizedItems),
        notes || null,
      ]
    );

    return res.status(201).json({
      id: Number(result.insertId),
      status: 'novo',
      totalAmount,
      items: normalizedItems,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao criar pedido', details: error.message });
  }
});

// Public blog API
app.get('/api/posts', async (req, res) => {
  try {
    const posts = await getAllPosts();
    return res.json(posts);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar posts', details: error.message });
  }
});

app.get('/api/posts/:id', async (req, res) => {
  const postId = Number(req.params.id);
  if (!Number.isFinite(postId)) {
    return res.status(400).json({ error: 'ID invalido' });
  }

  try {
    const post = await getPostById(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post nao encontrado' });
    }
    return res.json(post);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar post', details: error.message });
  }
});

app.post('/api/posts/:id/like', async (req, res) => {
  const postId = Number(req.params.id);
  if (!Number.isFinite(postId)) {
    return res.status(400).json({ error: 'ID invalido' });
  }

  try {
    const updated = await incrementPostLike(postId);
    if (!updated) {
      return res.status(404).json({ error: 'Post nao encontrado' });
    }
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao curtir post', details: error.message });
  }
});

app.post('/api/posts', requireAdminAuth, async (req, res) => {
  try {
    const created = await createPost(req.body || {});
    return res.status(201).json(created);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao criar post', details: error.message });
  }
});

// Admin dashboard
app.get('/api/admin/dashboard', requireAdminAuth, async (req, res) => {
  try {
    const stats = await getDashboardStats();
    return res.json(stats);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar dashboard', details: error.message });
  }
});

// Admin posts
app.get('/api/admin/posts', requireAdminAuth, async (req, res) => {
  try {
    const posts = await getAllPosts();
    return res.json(posts);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar posts admin', details: error.message });
  }
});

app.post('/api/admin/posts', requireAdminAuth, async (req, res) => {
  const payload = req.body || {};
  if (!String(payload.title || '').trim()) {
    return res.status(400).json({ error: 'Titulo e obrigatorio' });
  }

  try {
    const created = await createPost(payload);
    return res.status(201).json(created);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao criar post admin', details: error.message });
  }
});

app.put('/api/admin/posts/:id', requireAdminAuth, async (req, res) => {
  const postId = Number(req.params.id);
  if (!Number.isFinite(postId)) {
    return res.status(400).json({ error: 'ID invalido' });
  }

  try {
    const updated = await updatePost(postId, req.body || {});
    if (!updated) {
      return res.status(404).json({ error: 'Post nao encontrado' });
    }
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao atualizar post', details: error.message });
  }
});

app.delete('/api/admin/posts/:id', requireAdminAuth, async (req, res) => {
  const postId = Number(req.params.id);
  if (!Number.isFinite(postId)) {
    return res.status(400).json({ error: 'ID invalido' });
  }

  try {
    const ok = await deletePost(postId);
    if (!ok) {
      return res.status(404).json({ error: 'Post nao encontrado' });
    }
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao excluir post', details: error.message });
  }
});

// Admin site content
app.get('/api/admin/site-content', requireAdminAuth, requireDatabase, async (req, res) => {
  try {
    const [rows] = await dbPool.query(
      `SELECT id, content_key, section, title, content_type, content_value, sort_order, updated_at
       FROM site_content
       ORDER BY section ASC, sort_order ASC, id ASC`
    );
    return res.json(rows.map(normalizeSiteContent));
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar conteudo', details: error.message });
  }
});

app.post('/api/admin/site-content', requireAdminAuth, requireDatabase, async (req, res) => {
  const key = normalizeContentKey(req.body?.key);
  const section = String(req.body?.section || 'geral').trim().slice(0, 120);
  const title = String(req.body?.title || '').trim().slice(0, 255);
  const type = CONTENT_TYPES.has(String(req.body?.type || '').trim()) ? String(req.body.type).trim() : 'text';
  const value = String(req.body?.value ?? '');
  const sortOrder = Math.floor(toNumber(req.body?.sortOrder, 0));

  if (!key) {
    return res.status(400).json({ error: 'Chave invalida' });
  }

  try {
    const [result] = await dbPool.query(
      `INSERT INTO site_content (content_key, section, title, content_type, content_value, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [key, section || 'geral', title, type, value, sortOrder]
    );

    const [rows] = await dbPool.query(
      `SELECT id, content_key, section, title, content_type, content_value, sort_order, updated_at
       FROM site_content WHERE id = ? LIMIT 1`,
      [Number(result.insertId)]
    );

    return res.status(201).json(normalizeSiteContent(rows[0]));
  } catch (error) {
    if (String(error?.code) === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ja existe conteudo com esta chave' });
    }
    return res.status(500).json({ error: 'Erro ao criar conteudo', details: error.message });
  }
});

app.put('/api/admin/site-content/:id', requireAdminAuth, requireDatabase, async (req, res) => {
  const contentId = Number(req.params.id);
  if (!Number.isFinite(contentId)) {
    return res.status(400).json({ error: 'ID invalido' });
  }

  try {
    const [existingRows] = await dbPool.query('SELECT * FROM site_content WHERE id = ? LIMIT 1', [contentId]);
    if (!existingRows.length) {
      return res.status(404).json({ error: 'Conteudo nao encontrado' });
    }

    const current = existingRows[0];
    const key = req.body?.key !== undefined ? normalizeContentKey(req.body?.key) : String(current.content_key || '');
    const section = req.body?.section !== undefined ? String(req.body.section || '').trim().slice(0, 120) : String(current.section || '');
    const title = req.body?.title !== undefined ? String(req.body.title || '').trim().slice(0, 255) : String(current.title || '');
    const type =
      req.body?.type !== undefined && CONTENT_TYPES.has(String(req.body.type || '').trim())
        ? String(req.body.type).trim()
        : String(current.content_type || 'text');
    const value = req.body?.value !== undefined ? String(req.body.value ?? '') : String(current.content_value ?? '');
    const sortOrder = req.body?.sortOrder !== undefined ? Math.floor(toNumber(req.body.sortOrder, 0)) : Number(current.sort_order || 0);

    if (!key) {
      return res.status(400).json({ error: 'Chave invalida' });
    }

    await dbPool.query(
      `UPDATE site_content
       SET content_key = ?, section = ?, title = ?, content_type = ?, content_value = ?, sort_order = ?
       WHERE id = ?`,
      [key, section || 'geral', title, type, value, sortOrder, contentId]
    );

    const [rows] = await dbPool.query(
      `SELECT id, content_key, section, title, content_type, content_value, sort_order, updated_at
       FROM site_content WHERE id = ? LIMIT 1`,
      [contentId]
    );

    return res.json(normalizeSiteContent(rows[0]));
  } catch (error) {
    if (String(error?.code) === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ja existe conteudo com esta chave' });
    }
    return res.status(500).json({ error: 'Erro ao atualizar conteudo', details: error.message });
  }
});

app.delete('/api/admin/site-content/:id', requireAdminAuth, requireDatabase, async (req, res) => {
  const contentId = Number(req.params.id);
  if (!Number.isFinite(contentId)) {
    return res.status(400).json({ error: 'ID invalido' });
  }

  try {
    const [result] = await dbPool.query('DELETE FROM site_content WHERE id = ?', [contentId]);
    if (Number(result.affectedRows || 0) === 0) {
      return res.status(404).json({ error: 'Conteudo nao encontrado' });
    }
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao excluir conteudo', details: error.message });
  }
});

// Admin portfolio
app.get('/api/admin/portfolio', requireAdminAuth, requireDatabase, async (req, res) => {
  try {
    const [rows] = await dbPool.query('SELECT * FROM portfolio_items ORDER BY sort_order ASC, id DESC');
    return res.json(rows.map(normalizePortfolioItem));
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar acervo admin', details: error.message });
  }
});

app.post('/api/admin/portfolio', requireAdminAuth, requireDatabase, async (req, res) => {
  const title = String(req.body?.title || '').trim();
  const description = String(req.body?.description || '').trim();
  const image = String(req.body?.image || '').trim();
  const category = String(req.body?.category || '').trim();
  const year = String(req.body?.year || '').trim().slice(0, 20);
  const sortOrder = Math.floor(toNumber(req.body?.sortOrder, 0));
  const isActive = toBoolean(req.body?.isActive, true) ? 1 : 0;

  if (!title) {
    return res.status(400).json({ error: 'Titulo do trabalho e obrigatorio' });
  }
  if (!image) {
    return res.status(400).json({ error: 'Imagem do trabalho e obrigatoria' });
  }

  try {
    const [result] = await dbPool.query(
      `INSERT INTO portfolio_items
       (title, description, image, category, work_year, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [title, description || null, image, category || null, year || null, sortOrder, isActive]
    );

    const [rows] = await dbPool.query('SELECT * FROM portfolio_items WHERE id = ? LIMIT 1', [Number(result.insertId)]);
    return res.status(201).json(normalizePortfolioItem(rows[0]));
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao criar item do acervo', details: error.message });
  }
});

app.put('/api/admin/portfolio/:id', requireAdminAuth, requireDatabase, async (req, res) => {
  const itemId = Number(req.params.id);
  if (!Number.isFinite(itemId)) {
    return res.status(400).json({ error: 'ID invalido' });
  }

  try {
    const [rows] = await dbPool.query('SELECT * FROM portfolio_items WHERE id = ? LIMIT 1', [itemId]);
    if (!rows.length) {
      return res.status(404).json({ error: 'Item do acervo nao encontrado' });
    }

    const current = rows[0];
    const title = req.body?.title !== undefined ? String(req.body.title || '').trim() : String(current.title || '');
    const description =
      req.body?.description !== undefined ? String(req.body.description || '').trim() : String(current.description || '');
    const image = req.body?.image !== undefined ? String(req.body.image || '').trim() : String(current.image || '');
    const category = req.body?.category !== undefined ? String(req.body.category || '').trim() : String(current.category || '');
    const year = req.body?.year !== undefined ? String(req.body.year || '').trim().slice(0, 20) : String(current.work_year || '');
    const sortOrder = req.body?.sortOrder !== undefined ? Math.floor(toNumber(req.body.sortOrder, 0)) : Number(current.sort_order || 0);
    const isActive = req.body?.isActive !== undefined ? (toBoolean(req.body.isActive, true) ? 1 : 0) : Number(current.is_active || 0);

    if (!title) {
      return res.status(400).json({ error: 'Titulo do trabalho e obrigatorio' });
    }
    if (!image) {
      return res.status(400).json({ error: 'Imagem do trabalho e obrigatoria' });
    }

    await dbPool.query(
      `UPDATE portfolio_items
       SET title = ?, description = ?, image = ?, category = ?, work_year = ?, sort_order = ?, is_active = ?
       WHERE id = ?`,
      [title, description || null, image, category || null, year || null, sortOrder, isActive, itemId]
    );

    const [updatedRows] = await dbPool.query('SELECT * FROM portfolio_items WHERE id = ? LIMIT 1', [itemId]);
    return res.json(normalizePortfolioItem(updatedRows[0]));
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao atualizar item do acervo', details: error.message });
  }
});

app.delete('/api/admin/portfolio/:id', requireAdminAuth, requireDatabase, async (req, res) => {
  const itemId = Number(req.params.id);
  if (!Number.isFinite(itemId)) {
    return res.status(400).json({ error: 'ID invalido' });
  }

  try {
    const [result] = await dbPool.query('DELETE FROM portfolio_items WHERE id = ?', [itemId]);
    if (Number(result.affectedRows || 0) === 0) {
      return res.status(404).json({ error: 'Item do acervo nao encontrado' });
    }
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao excluir item do acervo', details: error.message });
  }
});

// Admin products
app.get('/api/admin/products', requireAdminAuth, requireDatabase, async (req, res) => {
  try {
    const [rows] = await dbPool.query('SELECT * FROM products ORDER BY id DESC');
    return res.json(rows.map(normalizeProduct));
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar produtos admin', details: error.message });
  }
});

app.post('/api/admin/products', requireAdminAuth, requireDatabase, async (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) {
    return res.status(400).json({ error: 'Nome do produto e obrigatorio' });
  }

  try {
    const slug = await buildUniqueProductSlug(req.body?.slug || name, null);
    const shortDescription = String(req.body?.shortDescription || '').trim();
    const description = String(req.body?.description || '').trim();
    const image = String(req.body?.image || '').trim();
    const category = String(req.body?.category || '').trim();
    const gallery = normalizeGalleryInput(req.body?.gallery);
    const price = roundMoney(req.body?.price);
    const stock = Math.max(0, Math.floor(toNumber(req.body?.stock, 0)));
    const isActive = toBoolean(req.body?.isActive, true) ? 1 : 0;

    const [result] = await dbPool.query(
      `INSERT INTO products
       (slug, name, short_description, description, image, gallery_json, category, price, stock, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [slug, name, shortDescription || null, description || null, image || null, JSON.stringify(gallery), category || null, price, stock, isActive]
    );

    const [rows] = await dbPool.query('SELECT * FROM products WHERE id = ? LIMIT 1', [Number(result.insertId)]);
    return res.status(201).json(normalizeProduct(rows[0]));
  } catch (error) {
    if (String(error?.code) === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Slug de produto ja existe' });
    }
    return res.status(500).json({ error: 'Erro ao criar produto', details: error.message });
  }
});

app.put('/api/admin/products/:id', requireAdminAuth, requireDatabase, async (req, res) => {
  const productId = Number(req.params.id);
  if (!Number.isFinite(productId)) {
    return res.status(400).json({ error: 'ID invalido' });
  }

  try {
    const [currentRows] = await dbPool.query('SELECT * FROM products WHERE id = ? LIMIT 1', [productId]);
    if (!currentRows.length) {
      return res.status(404).json({ error: 'Produto nao encontrado' });
    }

    const current = currentRows[0];
    const name = req.body?.name !== undefined ? String(req.body.name || '').trim() : String(current.name || '');
    if (!name) {
      return res.status(400).json({ error: 'Nome do produto e obrigatorio' });
    }

    const slug = await buildUniqueProductSlug(req.body?.slug !== undefined ? req.body.slug : current.slug, productId);
    const shortDescription = req.body?.shortDescription !== undefined ? String(req.body.shortDescription || '').trim() : String(current.short_description || '');
    const description = req.body?.description !== undefined ? String(req.body.description || '').trim() : String(current.description || '');
    const image = req.body?.image !== undefined ? String(req.body.image || '').trim() : String(current.image || '');
    const category = req.body?.category !== undefined ? String(req.body.category || '').trim() : String(current.category || '');
    const gallery = req.body?.gallery !== undefined
      ? normalizeGalleryInput(req.body.gallery)
      : Array.isArray(safeJsonParse(current.gallery_json, []))
        ? safeJsonParse(current.gallery_json, [])
        : [];
    const price = req.body?.price !== undefined ? roundMoney(req.body.price) : roundMoney(current.price);
    const stock = req.body?.stock !== undefined ? Math.max(0, Math.floor(toNumber(req.body.stock, 0))) : Number(current.stock || 0);
    const isActive = req.body?.isActive !== undefined ? (toBoolean(req.body.isActive, true) ? 1 : 0) : Number(current.is_active || 0);

    await dbPool.query(
      `UPDATE products
       SET slug = ?, name = ?, short_description = ?, description = ?, image = ?, gallery_json = ?, category = ?, price = ?, stock = ?, is_active = ?
       WHERE id = ?`,
      [slug, name, shortDescription || null, description || null, image || null, JSON.stringify(gallery), category || null, price, stock, isActive, productId]
    );

    const [rows] = await dbPool.query('SELECT * FROM products WHERE id = ? LIMIT 1', [productId]);
    return res.json(normalizeProduct(rows[0]));
  } catch (error) {
    if (String(error?.code) === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Slug de produto ja existe' });
    }
    return res.status(500).json({ error: 'Erro ao atualizar produto', details: error.message });
  }
});

app.delete('/api/admin/products/:id', requireAdminAuth, requireDatabase, async (req, res) => {
  const productId = Number(req.params.id);
  if (!Number.isFinite(productId)) {
    return res.status(400).json({ error: 'ID invalido' });
  }

  try {
    const [result] = await dbPool.query('DELETE FROM products WHERE id = ?', [productId]);
    if (Number(result.affectedRows || 0) === 0) {
      return res.status(404).json({ error: 'Produto nao encontrado' });
    }
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao excluir produto', details: error.message });
  }
});
// Admin orders
app.get('/api/admin/orders', requireAdminAuth, requireDatabase, async (req, res) => {
  try {
    const requestedStatus = String(req.query?.status || '').trim();
    const params = [];
    let query = 'SELECT * FROM orders';

    if (requestedStatus) {
      query += ' WHERE status = ?';
      params.push(requestedStatus);
    }

    query += ' ORDER BY id DESC LIMIT 500';

    const [rows] = await dbPool.query(query, params);
    return res.json(rows.map(normalizeOrder));
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar pedidos', details: error.message });
  }
});

app.get('/api/admin/orders/:id', requireAdminAuth, requireDatabase, async (req, res) => {
  const orderId = Number(req.params.id);
  if (!Number.isFinite(orderId)) {
    return res.status(400).json({ error: 'ID invalido' });
  }

  try {
    const [rows] = await dbPool.query('SELECT * FROM orders WHERE id = ? LIMIT 1', [orderId]);
    if (!rows.length) {
      return res.status(404).json({ error: 'Pedido nao encontrado' });
    }
    return res.json(normalizeOrder(rows[0]));
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar pedido', details: error.message });
  }
});

app.put('/api/admin/orders/:id', requireAdminAuth, requireDatabase, async (req, res) => {
  const orderId = Number(req.params.id);
  if (!Number.isFinite(orderId)) {
    return res.status(400).json({ error: 'ID invalido' });
  }

  try {
    const [rows] = await dbPool.query('SELECT * FROM orders WHERE id = ? LIMIT 1', [orderId]);
    if (!rows.length) {
      return res.status(404).json({ error: 'Pedido nao encontrado' });
    }

    const current = rows[0];
    const requestedStatus = String(req.body?.status || current.status || 'novo').trim();
    const status = ORDER_STATUSES.has(requestedStatus) ? requestedStatus : String(current.status || 'novo');
    const notes = req.body?.notes !== undefined ? String(req.body.notes || '').trim() : String(current.notes || '');

    await dbPool.query('UPDATE orders SET status = ?, notes = ? WHERE id = ?', [status, notes || null, orderId]);

    const [updatedRows] = await dbPool.query('SELECT * FROM orders WHERE id = ? LIMIT 1', [orderId]);
    return res.json(normalizeOrder(updatedRows[0]));
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao atualizar pedido', details: error.message });
  }
});

app.delete('/api/admin/orders/:id', requireAdminAuth, requireDatabase, async (req, res) => {
  const orderId = Number(req.params.id);
  if (!Number.isFinite(orderId)) {
    return res.status(400).json({ error: 'ID invalido' });
  }

  try {
    const [result] = await dbPool.query('DELETE FROM orders WHERE id = ?', [orderId]);
    if (Number(result.affectedRows || 0) === 0) {
      return res.status(404).json({ error: 'Pedido nao encontrado' });
    }
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao excluir pedido', details: error.message });
  }
});

// Admin users
app.get('/api/admin/users', requireAdminAuth, requireDatabase, async (req, res) => {
  try {
    const [rows] = await dbPool.query(
      'SELECT id, username, is_active, created_at FROM admin_users ORDER BY id ASC'
    );
    return res.json(rows.map(normalizeAdminUser));
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar usuarios admin', details: error.message });
  }
});

app.post('/api/admin/users', requireAdminAuth, requireDatabase, async (req, res) => {
  const username = String(req.body?.username || '').trim().slice(0, 120);
  const password = String(req.body?.password || '');
  const isActive = toBoolean(req.body?.isActive, true) ? 1 : 0;

  if (!username) {
    return res.status(400).json({ error: 'Usuario e obrigatorio' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Senha deve ter ao menos 6 caracteres' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await dbPool.query(
      'INSERT INTO admin_users (username, password_hash, is_active) VALUES (?, ?, ?)',
      [username, passwordHash, isActive]
    );

    const [rows] = await dbPool.query(
      'SELECT id, username, is_active, created_at FROM admin_users WHERE id = ? LIMIT 1',
      [Number(result.insertId)]
    );

    return res.status(201).json(normalizeAdminUser(rows[0]));
  } catch (error) {
    if (String(error?.code) === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Usuario ja existe' });
    }
    return res.status(500).json({ error: 'Erro ao criar usuario', details: error.message });
  }
});

app.put('/api/admin/users/:id', requireAdminAuth, requireDatabase, async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isFinite(userId)) {
    return res.status(400).json({ error: 'ID invalido' });
  }

  try {
    const [currentRows] = await dbPool.query(
      'SELECT id, username, is_active FROM admin_users WHERE id = ? LIMIT 1',
      [userId]
    );
    if (!currentRows.length) {
      return res.status(404).json({ error: 'Usuario nao encontrado' });
    }

    const current = currentRows[0];
    const username =
      req.body?.username !== undefined ? String(req.body.username || '').trim().slice(0, 120) : String(current.username || '');
    const isActive =
      req.body?.isActive !== undefined ? (toBoolean(req.body.isActive, true) ? 1 : 0) : Number(current.is_active || 0);
    const password = String(req.body?.password || '');

    if (!username) {
      return res.status(400).json({ error: 'Usuario e obrigatorio' });
    }
    if (req.admin?.id === userId && isActive !== 1) {
      return res.status(400).json({ error: 'Nao e permitido desativar o proprio usuario logado' });
    }

    if (password.length >= 1 && password.length < 6) {
      return res.status(400).json({ error: 'Senha deve ter ao menos 6 caracteres' });
    }

    if (password.length >= 6) {
      const passwordHash = await bcrypt.hash(password, 10);
      await dbPool.query(
        'UPDATE admin_users SET username = ?, is_active = ?, password_hash = ? WHERE id = ?',
        [username, isActive, passwordHash, userId]
      );
    } else {
      await dbPool.query('UPDATE admin_users SET username = ?, is_active = ? WHERE id = ?', [username, isActive, userId]);
    }

    const [rows] = await dbPool.query(
      'SELECT id, username, is_active, created_at FROM admin_users WHERE id = ? LIMIT 1',
      [userId]
    );
    return res.json(normalizeAdminUser(rows[0]));
  } catch (error) {
    if (String(error?.code) === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Usuario ja existe' });
    }
    return res.status(500).json({ error: 'Erro ao atualizar usuario', details: error.message });
  }
});

app.delete('/api/admin/users/:id', requireAdminAuth, requireDatabase, async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isFinite(userId)) {
    return res.status(400).json({ error: 'ID invalido' });
  }
  if (req.admin?.id === userId) {
    return res.status(400).json({ error: 'Nao e permitido desativar o proprio usuario logado' });
  }

  try {
    const [result] = await dbPool.query('UPDATE admin_users SET is_active = 0 WHERE id = ?', [userId]);
    if (Number(result.affectedRows || 0) === 0) {
      return res.status(404).json({ error: 'Usuario nao encontrado' });
    }
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao desativar usuario', details: error.message });
  }
});

// Admin media
app.get('/api/admin/media', requireAdminAuth, (req, res) => {
  try {
    return res.json(listUploadedMedia());
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao listar midia', details: error.message });
  }
});

app.delete('/api/admin/media/:filename', requireAdminAuth, (req, res) => {
  const filename = basename(String(req.params.filename || ''));
  if (!filename) {
    return res.status(400).json({ error: 'Arquivo invalido' });
  }

  const filePath = join(UPLOADS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Arquivo nao encontrado' });
  }

  try {
    fs.unlinkSync(filePath);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao remover arquivo', details: error.message });
  }
});

app.post('/api/admin/upload', requireAdminAuth, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  }
  return res.json({ url: `/public/uploads/${req.file.filename}` });
});

app.post('/api/upload', requireAdminAuth, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  }
  return res.json({ url: `/public/uploads/${req.file.filename}` });
});

app.get('/admin', (req, res) => {
  res.sendFile(join(ADMIN_DIR, 'index.html'));
});

app.use((req, res) => {
  res.sendFile(HAS_DIST_BUILD ? DIST_INDEX : ROOT_INDEX);
});

const startServer = () => {
  // Inicia o servidor HTTP IMEDIATAMENTE para evitar 503 do proxy/infra
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor ativo na porta ${PORT}`);
    console.log(`Painel admin: /admin`);

    // Inicia a conexão com o banco em segundo plano
    initializeDatabase().then(() => {
      console.log('[startup] Banco de dados inicializado com sucesso ou em modo fallback.');
    }).catch(err => {
      console.error('[startup] Erro critico na inicializacao do banco:', err);
    });
  });
};

startServer();
