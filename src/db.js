import fs from 'node:fs';
import pg from 'pg';
import { seed } from './seed.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL
    || 'postgres://veeva:veeva@127.0.0.1:54329/veeva_visit',
});

export async function initDb() {
  let lastError;
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      await pool.query('SELECT 1');
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      console.log(`等待数据库连接 (${attempt}/30)`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  if (lastError) throw lastError;

  const schema = fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
  await pool.query(schema);
  await seed(pool);
}
