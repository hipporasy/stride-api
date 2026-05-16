import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, types } from 'pg';

types.setTypeParser(20, val => parseInt(val, 10));

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const db = drizzle(pool);
