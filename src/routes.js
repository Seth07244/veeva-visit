import { MAX_DISTANCE_METERS, MIN_DURATION_SECONDS, evaluateCheckIn, evaluateCompliance } from './compliance.js';
import { currentMonth, monthRange } from './month.js';
import { presentVisit } from './present.js';
import {
  VisitRuleError,
  assertReport,
  assertVisitAction,
  optionalText,
  parseCoordinate,
  parseRequiredTimestamp,
  parseTimestamp,
  requiredId,
} from './visit-rules.js';

const VISIT_FROM = `
  SELECT
    v.id, v.status, v.planned_at, v.objective,
    v.check_in_at, v.check_in_lat, v.check_in_lng, v.check_in_distance_m,
    v.check_out_at, v.check_out_lat, v.check_out_lng, v.check_out_distance_m,
    v.duration_seconds, v.compliance_status, v.compliance_reasons,
    v.created_at, v.updated_at,
    r.id AS rep_id, r.name AS rep_name, r.employee_no AS rep_employee_no, r.region AS rep_region,
    h.id AS hcp_id, h.name AS hcp_name, h.title AS hcp_title,
    hp.id AS hospital_id, hp.name AS hospital_name, hp.address AS hospital_address,
    hp.latitude AS hospital_lat, hp.longitude AS hospital_lng,
    d.id AS department_id, d.name AS department_name,
    p.id AS product_id, p.name AS product_name, p.code AS product_code, p.indication AS product_indication,
    cr.academic_points, cr.talking_points, cr.hcp_feedback,
    cr.materials_distributed, cr.material_name, cr.created_at AS report_created_at
  FROM visits v
  JOIN reps r ON r.id = v.rep_id
  JOIN hcps h ON h.id = v.hcp_id
  JOIN hospitals hp ON hp.id = v.hospital_id
  JOIN departments d ON d.id = v.department_id
  JOIN products p ON p.id = v.product_id
  LEFT JOIN call_reports cr ON cr.visit_id = v.id
`;

function wrap(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

async function loadVisit(db, id) {
  const { rows } = await db.query(`${VISIT_FROM} WHERE v.id = $1`, [id]);
  return rows[0] || null;
}

function parseVisitId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new VisitRuleError('拜访不存在', 404);
  return id;
}

export function registerRoutes(app, pool) {
  app.get('/api/health', wrap(async (_req, res) => {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  }));

  app.get('/api/meta', wrap(async (_req, res) => {
    const [reps, hospitals, departments, hcps, products] = await Promise.all([
      pool.query('SELECT id, name, employee_no, region FROM reps ORDER BY id'),
      pool.query('SELECT id, name, address, latitude, longitude FROM hospitals ORDER BY id'),
      pool.query('SELECT id, hospital_id, name FROM departments ORDER BY id'),
      pool.query('SELECT id, name, title, hospital_id, department_id FROM hcps ORDER BY id'),
      pool.query('SELECT id, code, name, indication FROM products ORDER BY id'),
    ]);
    res.json({
      rules: {
        minDurationSeconds: MIN_DURATION_SECONDS,
        maxDistanceMeters: MAX_DISTANCE_METERS,
      },
      reps: reps.rows.map((row) => ({
        id: row.id,
        name: row.name,
        employeeNo: row.employee_no,
        region: row.region,
      })),
      hospitals: hospitals.rows,
      departments: departments.rows.map((row) => ({
        id: row.id,
        hospitalId: row.hospital_id,
        name: row.name,
      })),
      hcps: hcps.rows.map((row) => ({
        id: row.id,
        name: row.name,
        title: row.title,
        hospitalId: row.hospital_id,
        departmentId: row.department_id,
      })),
      products: products.rows,
    });
  }));

  app.get('/api/visits', wrap(async (req, res) => {
    let start = null;
    let end = null;
    if (req.query.month) {
      try {
        const range = monthRange(String(req.query.month));
        start = range.start;
        end = range.end;
      } catch (error) {
        throw new VisitRuleError(error.message);
      }
    }
    const status = req.query.status ? String(req.query.status) : null;
    const compliance = req.query.compliance ? String(req.query.compliance) : null;
    if (status && !['planned', 'checked_in', 'checked_out', 'reported'].includes(status)) {
      throw new VisitRuleError('状态无效');
    }
    if (compliance && !['pending', 'normal', 'abnormal'].includes(compliance)) {
      throw new VisitRuleError('合规状态无效');
    }
    const productId = req.query.productId ? requiredId(req.query.productId, '产品') : null;
    const { rows } = await pool.query(
      `${VISIT_FROM}
       WHERE ($1::timestamptz IS NULL OR (v.planned_at >= $1 AND v.planned_at < $2))
         AND ($3::text IS NULL OR v.status = $3)
         AND ($4::text IS NULL OR v.compliance_status = $4)
         AND ($5::int IS NULL OR v.product_id = $5)
       ORDER BY v.planned_at DESC, v.id DESC`,
      [start, end, status, compliance, productId],
    );
    res.json({ visits: rows.map(presentVisit) });
  }));

  app.post('/api/visits', wrap(async (req, res) => {
    const repId = requiredId(req.body?.repId, '医药代表');
    const hcpId = requiredId(req.body?.hcpId, '医生');
    const productId = requiredId(req.body?.productId, '产品');
    const plannedAt = parseRequiredTimestamp(req.body?.plannedAt, '计划时间');
    const objective = optionalText(req.body?.objective, '拜访目的', 500);

    const rep = await pool.query('SELECT id FROM reps WHERE id = $1', [repId]);
    if (rep.rowCount === 0) throw new VisitRuleError('医药代表不存在');
    const product = await pool.query('SELECT id FROM products WHERE id = $1', [productId]);
    if (product.rowCount === 0) throw new VisitRuleError('产品不存在');
    const hcp = await pool.query(
      `SELECT h.id, h.hospital_id, h.department_id
       FROM hcps h
       JOIN departments d ON d.id = h.department_id AND d.hospital_id = h.hospital_id
       WHERE h.id = $1`,
      [hcpId],
    );
    if (hcp.rowCount === 0) throw new VisitRuleError('医生不存在');

    const inserted = await pool.query(
      `INSERT INTO visits (
         rep_id, hcp_id, hospital_id, department_id, product_id, planned_at, objective
       ) VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id`,
      [repId, hcpId, hcp.rows[0].hospital_id, hcp.rows[0].department_id, productId, plannedAt, objective],
    );
    const visit = await loadVisit(pool, inserted.rows[0].id);
    res.status(201).json(presentVisit(visit));
  }));

  app.get('/api/visits/:id', wrap(async (req, res) => {
    const visit = await loadVisit(pool, parseVisitId(req.params.id));
    if (!visit) throw new VisitRuleError('拜访不存在', 404);
    res.json(presentVisit(visit));
  }));

  app.post('/api/visits/:id/check-in', wrap(async (req, res) => {
    const id = parseVisitId(req.params.id);
    const row = await loadVisit(pool, id);
    if (!row) throw new VisitRuleError('拜访不存在', 404);
    assertVisitAction(row.status, 'check-in');
    const point = parseCoordinate(req.body?.latitude, req.body?.longitude);
    const checkedInAt = parseTimestamp(req.body?.checkedInAt, '签到时间');
    const check = evaluateCheckIn({
      hospitalLat: row.hospital_lat,
      hospitalLng: row.hospital_lng,
      checkInLat: point.latitude,
      checkInLng: point.longitude,
    });
    const updated = await pool.query(
      `UPDATE visits SET
         status = 'checked_in',
         check_in_at = $2,
         check_in_lat = $3,
         check_in_lng = $4,
         check_in_distance_m = $5,
         compliance_status = $6,
         compliance_reasons = $7::jsonb,
         updated_at = now()
       WHERE id = $1 AND status = 'planned'`,
      [
        id,
        checkedInAt,
        point.latitude,
        point.longitude,
        check.checkInDistanceMeters,
        check.complianceStatus,
        JSON.stringify(check.reasons),
      ],
    );
    if (updated.rowCount === 0) throw new VisitRuleError('当前状态不可签到', 409);
    res.json(presentVisit(await loadVisit(pool, id)));
  }));

  app.post('/api/visits/:id/check-out', wrap(async (req, res) => {
    const id = parseVisitId(req.params.id);
    const row = await loadVisit(pool, id);
    if (!row) throw new VisitRuleError('拜访不存在', 404);
    assertVisitAction(row.status, 'check-out');
    const point = parseCoordinate(req.body?.latitude, req.body?.longitude);
    const checkedOutAt = parseTimestamp(req.body?.checkedOutAt, '签退时间');
    let result;
    try {
      result = evaluateCompliance({
        hospitalLat: row.hospital_lat,
        hospitalLng: row.hospital_lng,
        checkInLat: row.check_in_lat,
        checkInLng: row.check_in_lng,
        checkOutLat: point.latitude,
        checkOutLng: point.longitude,
        checkInAt: row.check_in_at,
        checkOutAt: checkedOutAt,
      });
    } catch (error) {
      throw new VisitRuleError(error.message);
    }
    const updated = await pool.query(
      `UPDATE visits SET
         status = 'checked_out',
         check_out_at = $2,
         check_out_lat = $3,
         check_out_lng = $4,
         check_out_distance_m = $5,
         duration_seconds = $6,
         compliance_status = $7,
         compliance_reasons = $8::jsonb,
         updated_at = now()
       WHERE id = $1 AND status = 'checked_in'`,
      [
        id,
        checkedOutAt,
        point.latitude,
        point.longitude,
        result.checkOutDistanceMeters,
        result.durationSeconds,
        result.complianceStatus,
        JSON.stringify(result.reasons),
      ],
    );
    if (updated.rowCount === 0) throw new VisitRuleError('当前状态不可签退', 409);
    res.json(presentVisit(await loadVisit(pool, id)));
  }));

  app.post('/api/visits/:id/report', wrap(async (req, res) => {
    const id = parseVisitId(req.params.id);
    const report = assertReport(req.body);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const row = await loadVisit(client, id);
      if (!row) throw new VisitRuleError('拜访不存在', 404);
      assertVisitAction(row.status, 'report');
      const updated = await client.query(
        `UPDATE visits SET status = 'reported', updated_at = now()
         WHERE id = $1 AND status = 'checked_out'`,
        [id],
      );
      if (updated.rowCount === 0) throw new VisitRuleError('当前状态不可提交拜访记录', 409);
      await client.query(
        `INSERT INTO call_reports (
           visit_id, academic_points, talking_points, hcp_feedback,
           materials_distributed, material_name
         ) VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          id,
          report.academicPoints,
          report.talkingPoints,
          report.hcpFeedback,
          report.materialsDistributed,
          report.materialName,
        ],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    res.json(presentVisit(await loadVisit(pool, id)));
  }));

  app.get('/api/dashboard', wrap(async (req, res) => {
    const month = req.query.month ? String(req.query.month) : currentMonth();
    let range;
    try {
      range = monthRange(month);
    } catch (error) {
      throw new VisitRuleError(error.message);
    }
    const { rows } = await pool.query(
      `SELECT
         p.id, p.code, p.name, p.indication,
         COUNT(v.id)::int AS total,
         COUNT(v.id) FILTER (WHERE v.status IN ('checked_out', 'reported'))::int AS completed,
         COUNT(v.id) FILTER (WHERE v.status = 'planned')::int AS planned,
         COUNT(v.id) FILTER (WHERE v.status = 'checked_in')::int AS in_progress,
         COUNT(v.id) FILTER (WHERE v.compliance_status = 'abnormal')::int AS abnormal,
         COUNT(v.id) FILTER (WHERE v.compliance_status = 'normal')::int AS normal
       FROM products p
       LEFT JOIN visits v
         ON v.product_id = p.id
        AND v.planned_at >= $1
        AND v.planned_at < $2
       GROUP BY p.id
       ORDER BY completed DESC, total DESC, p.id ASC`,
      [range.start, range.end],
    );
    const products = rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      indication: row.indication,
      total: Number(row.total),
      completed: Number(row.completed),
      planned: Number(row.planned),
      inProgress: Number(row.in_progress),
      abnormal: Number(row.abnormal),
      normal: Number(row.normal),
    }));
    const totals = products.reduce((sum, item) => ({
      total: sum.total + item.total,
      completed: sum.completed + item.completed,
      planned: sum.planned + item.planned,
      inProgress: sum.inProgress + item.inProgress,
      abnormal: sum.abnormal + item.abnormal,
      normal: sum.normal + item.normal,
    }), { total: 0, completed: 0, planned: 0, inProgress: 0, abnormal: 0, normal: 0 });
    res.json({ month: range.month, from: range.start, to: range.end, totals, products });
  }));
}
