import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';

// Rate limiter: 100 req/60s per IP — keep VUs low to stay under the limit
export const options = {
  stages: [
    { duration: '10s', target: 5 },    // ramp up to 5 users
    { duration: '30s', target: 5 },    // hold at 5 users
    { duration: '10s', target: 10 },   // spike to 10 users
    { duration: '20s', target: 10 },   // hold at 10 users
    { duration: '10s', target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],   // 95% of requests under 500ms
    http_req_failed: ['rate<0.05'],     // less than 5% failures (allows some 429s)
  },
};

// --- Scenarios ---

function healthCheck() {
  const res = http.get(`${BASE_URL}/health`);
  check(res, {
    'health: status 200': (r) => r.status === 200,
  });
}

function listProducts() {
  const res = http.get(`${BASE_URL}/products?limit=20`);
  check(res, {
    'products: status 200': (r) => r.status === 200,
    'products: has data': (r) => {
      if (r.status !== 200) return false;
      const body = JSON.parse(r.body);
      return body.data && body.data.length > 0;
    },
  });
}

function paginateProducts() {
  // First page
  const page1 = http.get(`${BASE_URL}/products?limit=10&sortBy=price&sortOrder=asc`);
  check(page1, { 'page1: status 200': (r) => r.status === 200 });

  if (page1.status !== 200) return;

  const body = JSON.parse(page1.body);
  if (body.nextCursor) {
    // Second page using cursor
    const page2 = http.get(`${BASE_URL}/products?limit=10&sortBy=price&sortOrder=asc&cursor=${body.nextCursor}`);
    check(page2, { 'page2: status 200': (r) => r.status === 200 });
  }
}

function filterByCategory() {
  const res = http.get(`${BASE_URL}/products?category=vegetables&limit=10`);
  check(res, {
    'category filter: status 200': (r) => r.status === 200,
  });
}

function priceRangeFilter() {
  const res = http.get(`${BASE_URL}/products?minPrice=50&maxPrice=200&limit=10`);
  check(res, {
    'price range: status 200': (r) => r.status === 200,
  });
}

function searchProducts() {
  const res = http.get(`${BASE_URL}/products?q=Product&limit=10`);
  check(res, {
    'search: status 200': (r) => r.status === 200,
  });
}

// --- Main ---

export default function () {
  const scenario = Math.random();

  if (scenario < 0.05) {
    healthCheck();
  } else if (scenario < 0.35) {
    listProducts();
  } else if (scenario < 0.55) {
    paginateProducts();
  } else if (scenario < 0.70) {
    filterByCategory();
  } else if (scenario < 0.85) {
    priceRangeFilter();
  } else {
    searchProducts();
  }

  sleep(1);
}
