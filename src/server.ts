import app from './app';
import { env } from './config/env';
import { connectRedis } from './config/redis';

async function start() {
  await connectRedis();
  app.listen(env.port, () => {
    console.log(`Server running on port ${env.port}`);
  });
}

start();
