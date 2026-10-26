-- ReportaLab: esquema de trabajo único, sin multi-tenancy.
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(180) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(16) NOT NULL CHECK (role IN ('ADMIN', 'TECHNICIAN')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  type VARCHAR(80) NOT NULL,
  location VARCHAR(180) NOT NULL,
  operational_status VARCHAR(25) NOT NULL DEFAULT 'OPERATIVE'
    CHECK (operational_status IN ('OPERATIVE', 'OUT_OF_SERVICE', 'MAINTENANCE')),
  public_token VARCHAR(64) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE RESTRICT,
  category VARCHAR(40) NOT NULL CHECK (category IN ('HARDWARE', 'SOFTWARE', 'CONNECTIVITY', 'FURNITURE', 'OTHER')),
  description TEXT NOT NULL CHECK (char_length(description) BETWEEN 12 AND 1500),
  priority VARCHAR(15) NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH')),
  status VARCHAR(25) NOT NULL DEFAULT 'RECEIVED'
    CHECK (status IN ('RECEIVED', 'UNDER_REVIEW', 'IN_REPAIR', 'RESOLVED')),
  tracking_code VARCHAR(40) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS incident_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('CREATED', 'STATUS_CHANGED', 'INTERNAL_NOTE')),
  previous_status VARCHAR(25),
  next_status VARCHAR(25),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS incidents_created_idx ON incidents(created_at DESC);
CREATE INDEX IF NOT EXISTS incidents_status_idx ON incidents(status, created_at DESC);
CREATE INDEX IF NOT EXISTS incidents_equipment_idx ON incidents(equipment_id);
CREATE INDEX IF NOT EXISTS incident_events_incident_idx ON incident_events(incident_id, created_at ASC);
