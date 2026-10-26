
import bcrypt from 'bcryptjs';
import { createPublicToken, createTrackingCode, pool } from './db.js';

const demoEquipment = [
  { code: 'LAB-A-001', name: 'PC de desarrollo 01', type: 'Computadora', location: 'Laboratorio A · Puesto 01', operational: 'OPERATIVE' },
  { code: 'LAB-A-008', name: 'Monitor Dell 24”', type: 'Monitor', location: 'Laboratorio A · Puesto 08', operational: 'MAINTENANCE' },
  { code: 'LAB-B-012', name: 'Proyector Epson', type: 'Proyector', location: 'Laboratorio B · Techo central', operational: 'OPERATIVE' },
  { code: 'LAB-C-003', name: 'Router de prácticas', type: 'Redes', location: 'Laboratorio C · Rack 01', operational: 'OUT_OF_SERVICE' },
  { code: 'AULA-204-01', name: 'PC de docente', type: 'Computadora', location: 'Aula 204 · Escritorio', operational: 'OPERATIVE' },
];

async function seed() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('La carga de credenciales y datos de demo está deshabilitada en producción.');
  }

  for (const user of [
    { email: 'admin@reportalab.demo', pass: 'DemoAdmin2026!', role: 'ADMIN' },
    { email: 'tecnico@reportalab.demo', pass: 'DemoTecnico2026!', role: 'TECHNICIAN' },
  ]) {
    const hash = await bcrypt.hash(user.pass, 12);
    await pool.query(
      `INSERT INTO users (email, password_hash, role) VALUES ($1,$2,$3)
       ON CONFLICT (email) DO NOTHING`,
      [user.email, hash, user.role],
    );
  }

  for (const equipment of demoEquipment) {
    await pool.query(
      `INSERT INTO equipment (code,name,type,location,operational_status,public_token)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (code) DO NOTHING`,
      [
        equipment.code,
        equipment.name,
        equipment.type,
        equipment.location,
        equipment.operational,
        createPublicToken(),
      ],
    );
  }

  const { rows } = await pool.query<{ id: string; code: string }>(
    'SELECT id, code FROM equipment WHERE code = ANY($1::text[])',
    [demoEquipment.map(e => e.code)]
  );

  const equipmentIds = new Map(rows.map((row) => [row.code, row.id]));

  const existing = await pool.query<{ total: string }>(
    'SELECT COUNT(*)::text AS total FROM incidents'
  );

  if (Number(existing.rows[0].total) === 0) {
    const samples = [
      ['LAB-A-008', 'HARDWARE', 'La pantalla pierde señal después de unos minutos de uso, incluso después de revisar la conexión.', 'HIGH', 'IN_REPAIR'],
      ['LAB-C-003', 'CONNECTIVITY', 'La red del puesto no tiene conexión y varias prácticas de redes están detenidas.', 'HIGH', 'UNDER_REVIEW'],
      ['LAB-B-012', 'HARDWARE', 'El proyector parpadea al mostrar presentaciones y la imagen pierde nitidez.', 'MEDIUM', 'RECEIVED'],
      ['AULA-204-01', 'SOFTWARE', 'El navegador muestra un error al iniciar la aplicación usada en clase.', 'LOW', 'RESOLVED'],
      ['LAB-A-001', 'SOFTWARE', 'La aplicación de desarrollo demora mucho en abrir los proyectos nuevos.', 'MEDIUM', 'RECEIVED'],
    ];

    for (const [code, category, description, priority, status] of samples) {
      const incident = await pool.query<{
        id: string;
        tracking_code: string;
      }>(
        `INSERT INTO incidents (
          equipment_id,
          category,
          description,
          priority,
          status,
          tracking_code,
          resolved_at
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,
          CASE
            WHEN $5::varchar(25) = 'RESOLVED'
            THEN NOW()
            ELSE NULL
          END
        )
        RETURNING id, tracking_code`,
        [
          equipmentIds.get(code),
          category,
          description,
          priority,
          status,
          createTrackingCode(),
        ],
      );

      await pool.query(
        `INSERT INTO incident_events (
          incident_id,
          event_type,
          next_status
        )
        VALUES ($1,'CREATED','RECEIVED')`,
        [incident.rows[0].id],
      );

      if (status !== 'RECEIVED') {
        await pool.query(
          `INSERT INTO incident_events (
            incident_id,
            event_type,
            previous_status,
            next_status
          )
          VALUES ($1,'STATUS_CHANGED','RECEIVED',$2)`,
          [incident.rows[0].id, status],
        );
      }

      console.log(`${code}: ${incident.rows[0].tracking_code}`);
    }
  }

  console.log('Datos demo disponibles. Credenciales en README.md.');
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
