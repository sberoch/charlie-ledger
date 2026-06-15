import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const db = drizzle(pool, { schema });

export type Db = typeof db;
/** The `tx` handle inside db.transaction() — what cross-aggregate services accept. */
export type DbTransaction = Parameters<Parameters<Db['transaction']>[0]>[0];
