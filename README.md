# FarmLokal – Backend Take-Home Assignment

This repository contains the backend implementation for the **FarmLokal Full-Stack / Backend Developer assessment**.
The solution focuses on **scalability, performance, correctness, and clean backend architecture**.

---

## Tech Stack

- **Node.js + TypeScript** (strict mode enabled)
- **Express.js v5**
- **MySQL** – primary relational database
- **Redis** – caching, token storage, idempotency, rate limiting
- **Axios** – external API communication
- **ts-node-dev** – development tooling

---

## High-Level Architecture

```
Client
  |
  v
Rate Limiter (Redis)
  |
  v
Express API (routes -> controllers -> services)
  |
  v
+--------------------------------------+
|  Product Service  (MySQL + Redis)    |
|  Auth Service     (OAuth2 + Redis)   |
|  External API Integrations           |
|  Webhook Handler  (Idempotency)      |
+--------------------------------------+
```

**Design principles:**

- Separation of concerns (routes, controllers, services)
- Performance-critical paths optimized first
- Stateless APIs with Redis for shared state
- Scalable patterns suitable for large datasets

---

## Features Implemented

### 1. Product Listing API (Performance-Critical)

**Endpoint:** `GET /products`

**Capabilities:**

- Cursor-based pagination (no OFFSET)
- Filtering (category, price range)
- Sorting (created_at, price, name)
- Full-text search (name, description)
- Redis caching (query + cursor based)

**Why cursor-based pagination?**

- Avoids slow OFFSET scans on large tables
- Ensures stable ordering with tie-breaker on `id`
- Scales efficiently to millions of records

**Indexes:**

| Index | Columns | Purpose |
|-------|---------|---------|
| `idx_products_created_at` | `(created_at, id)` | Pagination & default sorting |
| `idx_products_price` | `(price, id)` | Price sorting |
| `idx_products_name` | `(name, id)` | Name sorting |
| `idx_products_category` | `(category)` | Category filtering |
| `idx_products_search` | FULLTEXT `(name, description)` | Search |

---

### 2. Redis Caching Strategy

- Product listing responses cached for **60 seconds** (TTL-based expiry)
- Cache key derived from the full set of query parameters + cursor
- Significantly reduces MySQL load for repeated queries

**Cache Invalidation Strategy:**

This implementation uses a **TTL-based (time-to-live) invalidation** approach:

- Every cached response expires automatically after 60 seconds
- This is appropriate for a product listing where slight staleness is acceptable
- For write-heavy paths (product create/update/delete), cache keys matching the affected data can be explicitly deleted via `redisClient.del()` or pattern-based invalidation with `SCAN`
- The trade-off is simplicity vs real-time accuracy — a 60s window of staleness is acceptable for a listing page, and the TTL keeps the implementation simple without requiring pub/sub or cache-busting on every write

**Other Redis usage:**

- OAuth token caching (with TTL matching token expiry)
- Webhook idempotency (1-hour TTL per event_id)
- Rate limiting (per-IP sliding window)

---

### 3. Authentication (OAuth2 – Client Credentials)

- OAuth2 Client Credentials flow (mock provider)
- Access token cached in Redis with TTL (30s buffer before expiry)
- Automatic token refresh on expiry
- **Concurrency-safe token fetching** — multiple concurrent requests share a single in-flight fetch via a shared Promise, preventing redundant OAuth calls

---

### 4. External API Integration – API A (Synchronous)

- Secure API calls using OAuth access token
- Configured request timeout (3s)
- Retry with exponential backoff (3 retries, 500ms initial delay)
- Clear separation between controller and service layer

---

### 5. External API Integration – API B (Webhook)

**Endpoint:** `POST /api/webhook`

- Handles asynchronous webhook events
- Redis-based idempotency using `event_id` (1-hour TTL)
- Duplicate events safely ignored
- Always responds with HTTP 200 to avoid sender retries
- Designed for fast acknowledgment — heavy processing would be deferred to a background queue in production

---

### 6. Reliability & Performance

| Pattern | Implementation |
|---------|---------------|
| **Redis caching** | Product listings cached with 60s TTL |
| **Rate limiting** | Redis-based per-IP limiter (100 req/min), returns 429 with `X-RateLimit-*` headers |
| **Connection pooling** | MySQL pool with 10 connections, `waitForConnections: true` |
| **Request deduplication** | Webhook idempotency prevents duplicate event processing |

---

## Database Setup

Run the schema file in MySQL before starting the server:

```bash
mysql -u root -p < scripts/schema.sql
```

This creates the `farmlokal` database, the `products` table, and all required indexes.

---

## Database Seeding

Seeds **1,000,000 products** to simulate production-scale data:

- Batch inserts (5,000 records per batch)
- Randomized categories, prices, and descriptions

```bash
npm run seed:products
```

---

## Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Copy the example and fill in your values:

```bash
cp .env.example .env
```

### 3. Set up database

```bash
mysql -u root -p < scripts/schema.sql
npm run seed:products
```

### 4. Start Redis

```bash
redis-server
```

### 5. Start the server

```bash
npm run dev
```

Server runs at `http://localhost:4000`

---

## Example API Calls

**Product listing:**

```
GET /products
GET /products?limit=20
GET /products?category=vegetables&minPrice=50
GET /products?sortBy=price&sortOrder=asc
GET /products?sortBy=name&sortOrder=asc
GET /products?q=tomato
```

**External API A:**

```
GET /api/external-a
```

**Webhook:**

```http
POST /api/webhook
Content-Type: application/json

{
  "event_id": "evt_123",
  "type": "ORDER_CREATED",
  "data": {
    "orderId": 456
  }
}
```

**Health check:**

```
GET /health
```

---

## Performance Optimizations

- **Cursor-based pagination** — O(1) page fetches regardless of dataset size, unlike OFFSET which degrades linearly
- **Composite indexes** — every sort/filter path is backed by an index that covers both the sort column and `id` tie-breaker
- **Select specific columns** — avoids transferring unnecessary data from MySQL
- **Redis caching** — eliminates repeated DB queries for identical requests within the TTL window
- **Connection pooling** — reuses MySQL connections across requests
- **Rate limiting** — protects the server from excessive load

---

## Assumptions & Trade-offs

- OAuth provider is mocked — in production, this would be replaced with a real provider (Auth0, Okta, etc.)
- TTL-based cache invalidation chosen over event-driven invalidation for simplicity; acceptable staleness window for a listing page
- Rate limiter uses a simple counter with TTL rather than a sliding-window log, which is sufficient for moderate traffic
- Webhook processing is synchronous — in production, events would be pushed to a message queue for background processing
- FULLTEXT search is MySQL-native; for production scale, Elasticsearch would be more appropriate

---

## Project Structure

```
src/
  config/          env, mysql, redis configuration
  middlewares/     error handler, rate limiter
  modules/
    auth/          OAuth2 token service
    external/      External API A integration (routes, controller, service)
    products/      Product listing (routes, controller, service)
    webhook/       Webhook handler (routes, controller)
  app.ts           Express app setup & middleware
  server.ts        Entry point
scripts/
  schema.sql       Database schema & indexes
  seed-products.ts Seeder for 1M products
```

---

## Verification & Testing

All features have been manually tested and verified against the assessment requirements.

### Product Listing API

```bash
# Basic fetch (default 20 products)
curl http://localhost:4000/products

# Custom limit
curl "http://localhost:4000/products?limit=5"

# Category + price range filter
curl "http://localhost:4000/products?category=vegetables&minPrice=100&maxPrice=200&limit=5"

# Sort by price
curl "http://localhost:4000/products?sortBy=price&sortOrder=asc&limit=5"

# Sort by name
curl "http://localhost:4000/products?sortBy=name&sortOrder=asc&limit=5"

# Full-text search
curl "http://localhost:4000/products?q=Product%20500&limit=5"
```

### Cursor-Based Pagination

```bash
# Page 1
curl "http://localhost:4000/products?limit=3"
# Copy nextCursor from response, then:
curl "http://localhost:4000/products?limit=3&cursor=<PASTE_NEXT_CURSOR>"
# Page 2 returns the next 3 products with no overlap
```

### Redis Caching

```bash
# Run the same request twice
curl "http://localhost:4000/products?limit=3"
curl "http://localhost:4000/products?limit=3"
# Server logs: 1st call -> [CACHE MISS] Querying MySQL
#              2nd call -> [CACHE HIT] Serving from Redis
```

### Webhook Idempotency

```bash
# First call — processes event
curl -X POST http://localhost:4000/api/webhook \
  -H "Content-Type: application/json" \
  -d '{"event_id":"evt_001","type":"ORDER_CREATED","data":{"orderId":123}}'
# Response: {"message":"Webhook received"}

# Duplicate call — safely ignored
curl -X POST http://localhost:4000/api/webhook \
  -H "Content-Type: application/json" \
  -d '{"event_id":"evt_001","type":"ORDER_CREATED","data":{"orderId":123}}'
# Response: {"message":"Duplicate event ignored"}

# Missing event_id — returns 400
curl -X POST http://localhost:4000/api/webhook \
  -H "Content-Type: application/json" \
  -d '{"type":"ORDER_CREATED"}'
# Response: {"message":"Missing event_id"}
```

### Authentication (OAuth2 — Token Lifecycle)

```bash
# Flush Redis to start clean
redis-cli FLUSHALL

# 1. First call — fetches a new token from the mock OAuth provider
curl http://localhost:4000/api/external-a
# Server log: [AUTH] Fetching new token from OAuth provider

# 2. Second call — token served from Redis cache (no new fetch)
curl http://localhost:4000/api/external-a
# Server log: [AUTH] Token served from Redis cache

# 3. Concurrency test — flush Redis, then fire 5 simultaneous requests
redis-cli FLUSHALL
# PowerShell:
1..5 | ForEach-Object { Start-Job { curl.exe -s http://localhost:4000/api/external-a } } | Wait-Job | Receive-Job
# Server log: only 1x "Fetching new token", remaining show
#   "Waiting on existing token fetch" or "Token served from Redis cache"
# Proves concurrent requests share a single token fetch
```

### External API A (Synchronous)

```bash
curl http://localhost:4000/api/external-a
# Returns data from external API with timeout (3s) + retry with exponential backoff
```

### Rate Limiting

```bash
# Send 105 rapid requests — first 100 return 200, then 429
# PowerShell:
1..105 | ForEach-Object { & curl.exe -s -o NUL -w "%{http_code} " http://localhost:4000/health }
```

### Health Check

```bash
curl http://localhost:4000/health
# Response: {"status":"OK"}
```

---

## Where I Focused Most and Why

My primary focus was on **performance optimization** and **Redis usage** — the two highest-weighted areas in the evaluation criteria.

- **Cursor-based pagination** was the foundation. With 1M+ products, traditional OFFSET pagination degrades linearly. Cursor pagination ensures constant-time lookups regardless of page depth, backed by composite indexes on every sort path (`created_at + id`, `price + id`, `name + id`).
- **Redis caching** was layered across all critical paths — product listings (60s TTL), OAuth tokens (TTL with expiry buffer), and webhook idempotency (1-hour TTL). The goal was to minimize MySQL load and keep P95 response times low.
- **Concurrency-safe token management** ensures that even under high traffic, only one token fetch occurs while all other requests wait on the same promise — avoiding redundant network calls.
- **Rate limiting** was added as a second reliability pattern (Redis-based, per-IP) to protect the API under load.

The trade-off was keeping the OAuth provider as a mock rather than integrating a real provider like Auth0, in order to spend more time on the performance-critical product listing and caching layers — which carry the most weight in the evaluation.

---

## Author

**Sheetal** – Backend / Full-Stack Developer
