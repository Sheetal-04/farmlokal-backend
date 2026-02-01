import axios from 'axios';
import { getAccessToken } from '../auth/auth.service';

const EXTERNAL_API_URL = 'https://jsonplaceholder.typicode.com/posts/1';

const client = axios.create({
  timeout: 3000 
});

// Retry wrapper (simple + clean)
async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 500
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 0) {
      throw err;
    }
    await new Promise((res) => setTimeout(res, delayMs));
    return withRetry(fn, retries - 1, delayMs * 2); // exponential backoff
  }
}

// Call external API A
export async function fetchExternalData() {
  return withRetry(async () => {
    const token = await getAccessToken();

    const response = await client.get(EXTERNAL_API_URL, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    return response.data;
  });
}
