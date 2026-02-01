import express from 'express';
import { errorHandler } from './middlewares/error.middleware';
import { rateLimiter } from './middlewares/rate-limit.middleware';
import productRoutes from './modules/products/product.routes';
import externalRoutes from './modules/external/external.routes';
import webhookRoutes from './modules/webhook/webhook.routes';

const app = express();
app.use(express.json());
app.use(rateLimiter);

app.get('/health', (_req, res) => {
  res.json({ status: 'OK' });
});

app.use('/products', productRoutes);
app.use('/api', webhookRoutes);
app.use('/api', externalRoutes);

app.use(errorHandler);

export default app;
