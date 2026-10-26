import { readFile } from 'node:fs/promises';
import { pool } from './db.js';

async function migrate() {
  const sql = await readFile(new URL('../migrations/001_initial.sql', import.meta.url), 'utf8');
  await pool.query(sql);
  console.log('Esquema de ReportaLab aplicado correctamente.');
}

migrate().catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => pool.end());
