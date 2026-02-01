import mysql from 'mysql2/promise';
import { env } from './env';

export const mysqlPool = mysql.createPool({
  host: env.mysql.host,
  user: env.mysql.user,
  password: env.mysql.password,
  database: env.mysql.database,
  port: Number(env.mysql.port) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  ...(env.mysql.ssl ? { ssl: { rejectUnauthorized: false } } : {}),
});
