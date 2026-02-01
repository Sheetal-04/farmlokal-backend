import { Request, Response, NextFunction } from 'express';
import { redisClient } from '../config/redis';

const WINDOW_SECONDS = 60;
const MAX_REQUESTS = 100;


//  Redis-based sliding-window rate limiter.Limits each IP to MAX_REQUESTS per WINDOW_SECONDS.
export async function rateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip ?? 'unknown';
  const key = `rate_limit:${ip}`;

  try {
    const current = await redisClient.incr(key);

    if (current === 1) {
      await redisClient.expire(key, WINDOW_SECONDS);
    }

    res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, MAX_REQUESTS - current));

    if (current > MAX_REQUESTS) {
      return res.status(429).json({ message: 'Too many requests. Try again later.' });
    }

    next();
  } catch {
    // If Redis is down, allow the request through (fail-open)
    next();
  }
}
