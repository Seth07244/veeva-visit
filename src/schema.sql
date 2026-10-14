-- 学术拜访。医院保存基准坐标，签到/签退用它计算偏离距离。
-- 合规在签退时结算：时长不足 5 分钟，或任一位置偏离医院 500 米以上，记为异常。
-- 边界：正好 5 分钟、正好 500 米仍为合规。

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  indication TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reps (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  employee_no TEXT UNIQUE NOT NULL,
  region TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hospitals (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL
);

CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  hospital_id INTEGER NOT NULL REFERENCES hospitals (id),
  name TEXT NOT NULL,
  UNIQUE (hospital_id, name)
);

CREATE TABLE IF NOT EXISTS hcps (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  hospital_id INTEGER NOT NULL REFERENCES hospitals (id),
  department_id INTEGER NOT NULL REFERENCES departments (id)
);

CREATE TABLE IF NOT EXISTS visits (
  id SERIAL PRIMARY KEY,
  rep_id INTEGER NOT NULL REFERENCES reps (id),
  hcp_id INTEGER NOT NULL REFERENCES hcps (id),
  hospital_id INTEGER NOT NULL REFERENCES hospitals (id),
  department_id INTEGER NOT NULL REFERENCES departments (id),
  product_id INTEGER NOT NULL REFERENCES products (id),
  planned_at TIMESTAMPTZ NOT NULL,
  objective TEXT,
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'checked_in', 'checked_out', 'reported')),
  check_in_at TIMESTAMPTZ,
  check_in_lat DOUBLE PRECISION,
  check_in_lng DOUBLE PRECISION,
  check_in_distance_m DOUBLE PRECISION,
  check_out_at TIMESTAMPTZ,
  check_out_lat DOUBLE PRECISION,
  check_out_lng DOUBLE PRECISION,
  check_out_distance_m DOUBLE PRECISION,
  duration_seconds INTEGER,
  compliance_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (compliance_status IN ('pending', 'normal', 'abnormal')),
  compliance_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS call_reports (
  id SERIAL PRIMARY KEY,
  visit_id INTEGER UNIQUE NOT NULL REFERENCES visits (id),
  academic_points TEXT NOT NULL,
  talking_points TEXT NOT NULL,
  hcp_feedback TEXT NOT NULL,
  materials_distributed BOOLEAN NOT NULL,
  material_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (materials_distributed AND material_name IS NOT NULL AND btrim(material_name) <> '')
    OR NOT materials_distributed
  )
);

CREATE INDEX IF NOT EXISTS visits_planned_at_idx ON visits (planned_at);
CREATE INDEX IF NOT EXISTS visits_product_planned_idx ON visits (product_id, planned_at);
CREATE INDEX IF NOT EXISTS visits_status_idx ON visits (status);
