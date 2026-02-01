import dotenv from 'dotenv';

dotenv.config();

export const env = {
    port: process.env.PORT || 4000,
    mysql: {
        host: process.env.MYSQL_HOST!,
        user: process.env.MYSQL_USER!,
        password: process.env.MYSQL_PASSWORD!,
        database: process.env.MYSQL_DATABASE!,
        port: process.env.MYSQL_PORT || '3306',
        ssl: process.env.MYSQL_SSL === 'true',
    },
    redisUrl: process.env.REDIS_URL!,
};
