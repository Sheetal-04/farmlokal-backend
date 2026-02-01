import { mysqlPool } from '../../config/mysql';
import { redisClient } from '../../config/redis';
import { RowDataPacket } from 'mysql2';

/* ---------- Types ---------- */

interface ProductRow extends RowDataPacket {
  id: number;
  name: string;
  description: string | null;
  category: string;
  price: number;
  created_at: Date;
  updated_at: Date;
}

interface CursorPayload {
  id: number;
  created_at?: string;
  price?: number;
  name?: string;
}

export interface ProductQueryParams {
  limit?: string | undefined;
  cursor?: string | undefined;
  sortBy?: string | undefined;
  sortOrder?: string | undefined;
  category?: string | undefined;
  minPrice?: string | undefined;
  maxPrice?: string | undefined;
  q?: string | undefined;
}

export interface ProductListResponse {
  data: ProductRow[];
  nextCursor: string | null;
  hasMore: boolean;
}

/* ---------- Constants ---------- */

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const CACHE_TTL = 60; // seconds

const VALID_SORT_FIELDS = ['created_at', 'price', 'name'] as const;
type SortField = (typeof VALID_SORT_FIELDS)[number];

/* ---------- Helpers ---------- */

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

function decodeCursor(cursor: string): CursorPayload {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64').toString());
  } catch {
    throw new Error('Invalid cursor format');
  }
}

function toMySQLTimestamp(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.getFullYear()
    + '-' + String(d.getMonth() + 1).padStart(2, '0')
    + '-' + String(d.getDate()).padStart(2, '0')
    + ' ' + String(d.getHours()).padStart(2, '0')
    + ':' + String(d.getMinutes()).padStart(2, '0')
    + ':' + String(d.getSeconds()).padStart(2, '0');
}

function buildCacheKey(params: ProductQueryParams): string {
  return `products:${JSON.stringify(params)}`;
}

function isValidSortField(value: string): value is SortField {
  return (VALID_SORT_FIELDS as readonly string[]).includes(value);
}

/* ---------- Service ---------- */

export async function listProducts(params: ProductQueryParams): Promise<ProductListResponse> {
  const cacheKey = buildCacheKey(params);

  // Check Redis cache
  const cached = await redisClient.get(cacheKey);
  if (cached) {
    console.log('[CACHE HIT] Serving from Redis');
    return JSON.parse(cached) as ProductListResponse;
  }

  console.log('[CACHE MISS] Querying MySQL');

  // Normalize params
  const limit = Math.min(Number(params.limit) || DEFAULT_LIMIT, MAX_LIMIT);
  const sortBy: SortField = params.sortBy && isValidSortField(params.sortBy) ? params.sortBy : 'created_at';
  const sortOrder = params.sortOrder === 'asc' ? 'ASC' : 'DESC';

  // Build WHERE clauses
  const whereClauses: string[] = [];
  const values: (string | number)[] = [];

  if (params.category) {
    whereClauses.push('category = ?');
    values.push(params.category);
  }

  if (params.minPrice) {
    const min = Number(params.minPrice);
    if (!Number.isNaN(min)) {
      whereClauses.push('price >= ?');
      values.push(min);
    }
  }

  if (params.maxPrice) {
    const max = Number(params.maxPrice);
    if (!Number.isNaN(max)) {
      whereClauses.push('price <= ?');
      values.push(max);
    }
  }

  if (params.q) {
    whereClauses.push('MATCH(name, description) AGAINST (? IN NATURAL LANGUAGE MODE)');
    values.push(params.q);
  }

  // Cursor pagination
  if (params.cursor) {
    const decoded = decodeCursor(params.cursor);

    if (sortBy === 'created_at' && decoded.created_at !== undefined) {
      if (sortOrder === 'DESC') {
        whereClauses.push('(created_at < ? OR (created_at = ? AND id < ?))');
      } else {
        whereClauses.push('(created_at > ? OR (created_at = ? AND id > ?))');
      }
      values.push(decoded.created_at, decoded.created_at, decoded.id);
    }

    if (sortBy === 'price' && decoded.price !== undefined) {
      if (sortOrder === 'DESC') {
        whereClauses.push('(price < ? OR (price = ? AND id < ?))');
      } else {
        whereClauses.push('(price > ? OR (price = ? AND id > ?))');
      }
      values.push(decoded.price, decoded.price, decoded.id);
    }

    if (sortBy === 'name' && decoded.name !== undefined) {
      if (sortOrder === 'DESC') {
        whereClauses.push('(name < ? OR (name = ? AND id < ?))');
      } else {
        whereClauses.push('(name > ? OR (name = ? AND id > ?))');
      }
      values.push(decoded.name, decoded.name, decoded.id);
    }
  }

  const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const orderSQL = `ORDER BY ${sortBy} ${sortOrder}, id ${sortOrder}`;

  const sql = `
    SELECT id, name, description, category, price, created_at, updated_at
    FROM products
    ${whereSQL}
    ${orderSQL}
    LIMIT ?
  `;

  values.push(limit + 1);

  const [rows] = await mysqlPool.query<ProductRow[]>(sql, values);

  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;

  let nextCursor: string | null = null;

  if (hasMore && data.length > 0) {
    const last = data[data.length - 1]!;

    if (sortBy === 'created_at') {
      nextCursor = encodeCursor({ id: last.id, created_at: toMySQLTimestamp(last.created_at) });
    } else if (sortBy === 'price') {
      nextCursor = encodeCursor({ id: last.id, price: last.price });
    } else if (sortBy === 'name') {
      nextCursor = encodeCursor({ id: last.id, name: last.name });
    }
  }

  const response: ProductListResponse = { data, nextCursor, hasMore };

  // Cache result
  await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(response));

  return response;
}
