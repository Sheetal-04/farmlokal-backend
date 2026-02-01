import mysql from 'mysql2/promise';
import { env } from './env';

export const mysqlPool = mysql.createPool({
  host: env.mysql.host,
  user: env.mysql.user,
  password: env.mysql.password,
  database: env.mysql.database,
  waitForConnections: true,
  connectionLimit: 10,
});
