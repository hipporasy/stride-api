import { migrate as drizzleMigrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from '@/db/index';

export async function migrate(): Promise<void> {
  await drizzleMigrate(db, { migrationsFolder: 'drizzle' });
}
