import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { z, ZodError } from 'zod';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, createPublicToken, createTrackingCode } from './db.js';

const app = express();
const secret = process.env.JWT_SECRET || '';
if (secret.length < 32) throw new Error('Configura JWT_SECRET con al menos 32 caracteres.');
const port = Number(process.env.PORT || 4000);
const origin = process.env.WEB_ORIGIN || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5173';
const webDist = resolve(dirname(fileURLToPath(import.meta.url)), '../../web/dist');
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(cors({ origin, credentials: true }));
app.use(express.json({ limit: '16kb' }));
app.use(cookieParser());

const asyncRoute = (handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => { Promise.resolve(handler(req, res, next)).catch(next); };
const badRequest = (message: string, status = 400) => Object.assign(new Error(message), { status });
const validUUID = z.string().uuid();
const roles = z.enum(['ADMIN', 'TECHNICIAN']);
const statuses = z.enum(['RECEIVED', 'UNDER_REVIEW', 'IN_REPAIR', 'RESOLVED']);
const categories = z.enum(['HARDWARE', 'SOFTWARE', 'CONNECTIVITY', 'FURNITURE', 'OTHER']);
const priorities = z.enum(['LOW', 'MEDIUM', 'HIGH']);
const operating = z.enum(['OPERATIVE', 'OUT_OF_SERVICE', 'MAINTENANCE']);
const trackingCode = z.string().regex(/^RL-[0-9A-F]{18}$/);
const qrToken = z.string().regex(/^[0-9a-f]{40}$/);
const noteSchema = z.object({ note: z.string().trim().min(3).max(1000) });
const equipmentSchema = z.object({
  code: z.string().trim().min(3).max(40).regex(/^[a-zA-Z0-9_-]+$/),
  name: z.string().trim().min(3).max(150),
  type: z.string().trim().min(2).max(80),
  location: z.string().trim().min(3).max(180),
  operationalStatus: operating,
}).strict();

type Session = { id: string; email: string; role: z.infer<typeof roles> };
function sessionFromCookie(req: Request): Session | null {
  try {
    const raw: unknown = req.cookies?.rl_session;
    if (typeof raw !== 'string') return null;
    const value = jwt.verify(raw, secret, { algorithms: ['HS256'] });
    if (typeof value !== 'object' || !value) return null;
    return { id: validUUID.parse(value.sub), email: z.string().email().parse(value.email), role: roles.parse(value.role) };
  } catch { return null; }
}
function requireStaff(req: Request, res: Response, next: NextFunction) {
  const session = sessionFromCookie(req);
  if (!session) { res.status(401).json({ message: 'Tu sesión ha expirado. Inicia sesión nuevamente.' }); return; }
  res.locals.session = session;
  next();
}
function requireAdmin(_req: Request, res: Response, next: NextFunction) {
  if ((res.locals.session as Session).role !== 'ADMIN') { res.status(403).json({ message: 'Esta acción requiere permiso de administrador.' }); return; }
  next();
}
function cookieOptions() {
  return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: 8 * 60 * 60 * 1000 };
}
const publicLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, message: { message: 'Demasiados intentos. Inténtalo más tarde.' } });
const trackingLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 40, standardHeaders: 'draft-7', legacyHeaders: false, message: { message: 'Demasiadas consultas. Inténtalo más tarde.' } });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, message: { message: 'Demasiados intentos de acceso. Inténtalo más tarde.' } });

app.get('/api/health', asyncRoute(async (_req, res) => {
  await pool.query('SELECT 1'); res.json({ ok: true, service: 'ReportaLab API' });
}));

app.get('/api/public/equipment/:token', asyncRoute(async (req, res) => {
  const token = qrToken.parse(req.params.token);
  const { rows } = await pool.query(
    'SELECT code,name,type,location,operational_status AS "operationalStatus" FROM equipment WHERE public_token=$1', [token]
  );
  if (!rows.length) throw badRequest('Equipo no encontrado.', 404);
  res.json(rows[0]);
}));

app.post('/api/public/incidents', publicLimiter, asyncRoute(async (req, res) => {
  const body = z.object({
    equipmentToken: qrToken,
    category: categories,
    description: z.string().trim().min(12).max(1500),
    priority: priorities,
  }).strict().parse(req.body);
  const { rows: equipment } = await pool.query<{ id: string }>('SELECT id FROM equipment WHERE public_token=$1', [body.equipmentToken]);
  if (!equipment.length) throw badRequest('El código del equipo no es válido.', 404);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<{ id: string; trackingCode: string; createdAt: string }>(
      `INSERT INTO incidents (equipment_id,category,description,priority,tracking_code)
       VALUES ($1,$2,$3,$4,$5) RETURNING id,tracking_code AS "trackingCode",created_at AS "createdAt"`,
      [equipment[0].id, body.category, body.description, body.priority, createTrackingCode()],
    );
    await client.query(
      "INSERT INTO incident_events (incident_id,event_type,next_status) VALUES ($1,'CREATED','RECEIVED')", [rows[0].id],
    );
    await client.query('COMMIT');
    res.status(201).json({ trackingCode: rows[0].trackingCode, status: 'RECEIVED', createdAt: rows[0].createdAt });
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}));

app.get('/api/public/incidents/:trackingCode', trackingLimiter, asyncRoute(async (req, res) => {
  const code = trackingCode.parse(req.params.trackingCode.toUpperCase());
  const { rows } = await pool.query(
    `SELECT i.tracking_code AS "trackingCode", i.category, i.priority, i.status,
            i.created_at AS "createdAt", i.updated_at AS "updatedAt", i.resolved_at AS "resolvedAt",
            e.name AS "equipmentName", e.code AS "equipmentCode", e.location
     FROM incidents i JOIN equipment e ON e.id=i.equipment_id WHERE i.tracking_code=$1`, [code],
  );
  if (!rows.length) throw badRequest('No encontramos un reporte con ese código.', 404);
  res.json(rows[0]);
}));

app.post('/api/auth/login', loginLimiter, asyncRoute(async (req, res) => {
  const body = z.object({ email: z.string().email().max(180), password: z.string().min(1).max(128) }).strict().parse(req.body);
  const { rows } = await pool.query<{ id: string; email: string; role: 'ADMIN' | 'TECHNICIAN'; password_hash: string }>(
    'SELECT id,email,role,password_hash FROM users WHERE lower(email)=lower($1)', [body.email],
  );
  if (!rows.length || !(await bcrypt.compare(body.password, rows[0].password_hash))) {
    throw badRequest('Correo o contraseña incorrectos.', 401);
  }
  const { id, email, role } = rows[0];
  const token = jwt.sign({ email, role }, secret, { algorithm: 'HS256', subject: id, expiresIn: '8h' });
  res.cookie('rl_session', token, cookieOptions());
  res.json({ id, email, role });
}));
app.post('/api/auth/logout', (_req, res) => { res.clearCookie('rl_session', cookieOptions()); res.json({ ok: true }); });
app.get('/api/auth/me', requireStaff, (_req, res) => res.json(res.locals.session));

app.get('/api/dashboard/stats', requireStaff, asyncRoute(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT (SELECT COUNT(*) FROM equipment)::int AS equipment,
            (SELECT COUNT(*) FROM incidents)::int AS total,
            (SELECT COUNT(*) FROM incidents WHERE status='RECEIVED')::int AS received,
            (SELECT COUNT(*) FROM incidents WHERE status='UNDER_REVIEW')::int AS review,
            (SELECT COUNT(*) FROM incidents WHERE status='IN_REPAIR')::int AS repair,
            (SELECT COUNT(*) FROM incidents WHERE status='RESOLVED')::int AS resolved`,
  );
  res.json(rows[0]);
}));

app.get('/api/incidents', requireStaff, asyncRoute(async (req, res) => {
  const query = z.object({
    status: statuses.optional(), category: categories.optional(), equipmentId: validUUID.optional(),
    search: z.string().trim().max(100).optional(),
  }).parse(req.query);
  const filters: string[] = [];
  const values: string[] = [];
  const add = (sql: string, value: string) => { values.push(value); filters.push(sql.replace('?', `$${values.length}`)); };
  if (query.status) add('i.status=?', query.status);
  if (query.category) add('i.category=?', query.category);
  if (query.equipmentId) add('i.equipment_id=?', query.equipmentId);
  if (query.search) {
    values.push(`%${query.search}%`);
    const placeholder = `$${values.length}`;
    filters.push(`(i.tracking_code ILIKE ${placeholder} OR e.name ILIKE ${placeholder} OR e.code ILIKE ${placeholder})`);
  }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT i.id,i.category,i.description,i.priority,i.status,i.tracking_code AS "trackingCode",
            i.created_at AS "createdAt",i.updated_at AS "updatedAt",e.name AS "equipmentName",e.code AS "equipmentCode",e.location
     FROM incidents i JOIN equipment e ON e.id=i.equipment_id ${where}
     ORDER BY i.created_at DESC LIMIT 100`, values,
  );
  res.json(rows);
}));

app.get('/api/incidents/:id', requireStaff, asyncRoute(async (req, res) => {
  const id = validUUID.parse(req.params.id);
  const { rows } = await pool.query(
    `SELECT i.*,e.name AS "equipmentName",e.code AS "equipmentCode",e.location,
            e.public_token AS "equipmentToken" FROM incidents i
     JOIN equipment e ON e.id=i.equipment_id WHERE i.id=$1`, [id],
  );
  if (!rows.length) throw badRequest('Reporte no encontrado.', 404);
  const events = await pool.query(
    `SELECT v.id,v.event_type AS "eventType",v.previous_status AS "previousStatus",
            v.next_status AS "nextStatus",v.note,v.created_at AS "createdAt",u.email AS "actorEmail"
     FROM incident_events v LEFT JOIN users u ON u.id=v.actor_id
     WHERE v.incident_id=$1 ORDER BY v.created_at ASC, v.id ASC`, [id],
  );
  res.json({ ...rows[0], events: events.rows });
}));

app.patch('/api/incidents/:id/status', requireStaff, asyncRoute(async (req, res) => {
  const id = validUUID.parse(req.params.id);
  const { status } = z.object({ status: statuses }).strict().parse(req.body);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<{ status: string }>('SELECT status FROM incidents WHERE id=$1 FOR UPDATE', [id]);
    if (!rows.length) throw badRequest('Reporte no encontrado.', 404);
    if (rows[0].status === status) throw badRequest('El reporte ya tiene ese estado.');
    await client.query(
      `UPDATE incidents SET status=$2,updated_at=NOW(),resolved_at=CASE WHEN $2::varchar(25)='RESOLVED' THEN NOW() ELSE NULL END WHERE id=$1`, [id, status]
    );
    await client.query(
      `INSERT INTO incident_events (incident_id,actor_id,event_type,previous_status,next_status)
       VALUES ($1,$2,'STATUS_CHANGED',$3,$4)`, [id, (res.locals.session as Session).id, rows[0].status, status],
    );
    await client.query('COMMIT');
    res.json({ status });
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}));

app.post('/api/incidents/:id/notes', requireStaff, asyncRoute(async (req, res) => {
  const id = validUUID.parse(req.params.id);
  const { note } = noteSchema.parse(req.body);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const exists = await client.query('SELECT 1 FROM incidents WHERE id=$1 FOR UPDATE', [id]);
    if (!exists.rowCount) throw badRequest('Reporte no encontrado.', 404);
    await client.query(
      `INSERT INTO incident_events (incident_id,actor_id,event_type,note)
       VALUES ($1,$2,'INTERNAL_NOTE',$3)`, [id, (res.locals.session as Session).id, note]
    );
    await client.query('UPDATE incidents SET updated_at=NOW() WHERE id=$1', [id]);
    await client.query('COMMIT');
    res.status(201).json({ ok: true });
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}));

app.get('/api/equipment', requireStaff, asyncRoute(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT id,code,name,type,location,operational_status AS "operationalStatus",public_token AS "publicToken",
            created_at AS "createdAt",
            (SELECT COUNT(*)::int FROM incidents i WHERE i.equipment_id=equipment.id) AS "incidentCount"
       FROM equipment ORDER BY code ASC LIMIT 500`,
  );
  res.json(rows);
}));
app.post('/api/equipment', requireStaff, requireAdmin, asyncRoute(async (req, res) => {
  const body = equipmentSchema.parse(req.body);
  const { rows } = await pool.query(
    `INSERT INTO equipment (code,name,type,location,operational_status,public_token)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,public_token AS "publicToken"`,
    [body.code.toUpperCase(), body.name, body.type, body.location, body.operationalStatus, createPublicToken()],
  );
  res.status(201).json(rows[0]);
}));
app.patch('/api/equipment/:id', requireStaff, requireAdmin, asyncRoute(async (req, res) => {
  const id = validUUID.parse(req.params.id);
  const body = equipmentSchema.parse(req.body);
  const { rowCount } = await pool.query(
    `UPDATE equipment SET code=$2,name=$3,type=$4,location=$5,operational_status=$6,updated_at=NOW() WHERE id=$1`,
    [id, body.code.toUpperCase(), body.name, body.type, body.location, body.operationalStatus],
  );
  if (!rowCount) throw badRequest('Equipo no encontrado.', 404);
  res.json({ ok: true });
}));
app.delete('/api/equipment/:id', requireStaff, requireAdmin, asyncRoute(async (req, res) => {
  const id = validUUID.parse(req.params.id);
  const { deleteHistory = false } = z.object({ deleteHistory: z.boolean().optional() }).strict().parse(req.body ?? {});
  const client = await pool.connect();
  let deletedIncidents = 0;
  try {
    await client.query('BEGIN');
    const equipment = await client.query('SELECT id FROM equipment WHERE id=$1 FOR UPDATE', [id]);
    if (!equipment.rowCount) throw badRequest('Equipo no encontrado.', 404);
    if (deleteHistory) {
      const deleted = await client.query('DELETE FROM incidents WHERE equipment_id=$1', [id]);
      deletedIncidents = deleted.rowCount ?? 0;
    }
    await client.query('DELETE FROM equipment WHERE id=$1', [id]);
    await client.query('COMMIT');
    res.json({ ok: true, deletedIncidents });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    if (typeof error === 'object' && error && 'code' in error && error.code === '23503') {
      throw badRequest('No se puede eliminar porque este equipo tiene incidencias asociadas. El historial se conserva.', 409);
    }
    throw error;
  } finally { client.release(); }
}));

app.use(express.static(webDist));
app.get('*', (req, res, next) => {
  if (req.path === '/api' || req.path.startsWith('/api/')) {
    res.status(404).json({ message: 'Ruta no encontrada.' });
    return;
  }
  res.sendFile(resolve(webDist, 'index.html'), error => { if (error) next(error); });
});
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof ZodError) { res.status(400).json({ message: 'Revisa los datos ingresados.', errors: error.flatten() }); return; }
  if (typeof error === 'object' && error && 'code' in error && error.code === '23505') {
    res.status(409).json({ message: 'Ya existe un registro con ese código.' }); return;
  }
  const status = typeof error === 'object' && error && 'status' in error && typeof error.status === 'number' ? error.status : 500;
  if (status >= 500) console.error(error);
  res.status(status).json({ message: status >= 500 ? 'Ocurrió un error inesperado.' : (error as Error).message });
});

app.listen(port, () => console.log(`ReportaLab API → http://localhost:${port}`));
