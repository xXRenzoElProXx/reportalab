import 'dotenv/config';
import pg from 'pg';

if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL en apps/api/.env');
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10 });

export function createPublicToken() {
  return crypto.randomBytes(20).toString('hex');
}

export function createTrackingCode() {
  return `RL-${crypto.randomBytes(9).toString('hex').toUpperCase()}`;
}

import crypto from 'node:crypto';
