import { describeReasons } from './compliance.js';

const STATUS_LABELS = {
  planned: '待签到',
  checked_in: '拜访中',
  checked_out: '待记录',
  reported: '已完成',
};

const COMPLIANCE_LABELS = {
  pending: '待核算',
  normal: '合规',
  abnormal: '异常',
};

function iso(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function reasonCodes(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return JSON.parse(value);
  return [];
}

export function presentVisit(row) {
  return {
    id: row.id,
    status: row.status,
    statusLabel: STATUS_LABELS[row.status] || row.status,
    plannedAt: iso(row.planned_at),
    objective: row.objective,
    rep: {
      id: row.rep_id,
      name: row.rep_name,
      employeeNo: row.rep_employee_no,
      region: row.rep_region,
    },
    hcp: {
      id: row.hcp_id,
      name: row.hcp_name,
      title: row.hcp_title,
    },
    hospital: {
      id: row.hospital_id,
      name: row.hospital_name,
      address: row.hospital_address,
      latitude: row.hospital_lat,
      longitude: row.hospital_lng,
    },
    department: {
      id: row.department_id,
      name: row.department_name,
    },
    product: {
      id: row.product_id,
      name: row.product_name,
      code: row.product_code,
      indication: row.product_indication,
    },
    checkIn: row.check_in_at
      ? {
        at: iso(row.check_in_at),
        latitude: row.check_in_lat,
        longitude: row.check_in_lng,
        distanceMeters: row.check_in_distance_m,
      }
      : null,
    checkOut: row.check_out_at
      ? {
        at: iso(row.check_out_at),
        latitude: row.check_out_lat,
        longitude: row.check_out_lng,
        distanceMeters: row.check_out_distance_m,
      }
      : null,
    durationSeconds: row.duration_seconds,
    compliance: {
      status: row.compliance_status,
      label: COMPLIANCE_LABELS[row.compliance_status] || row.compliance_status,
      reasons: describeReasons(reasonCodes(row.compliance_reasons)),
    },
    report: row.report_created_at
      ? {
        academicPoints: row.academic_points,
        talkingPoints: row.talking_points,
        hcpFeedback: row.hcp_feedback,
        materialsDistributed: row.materials_distributed,
        materialName: row.material_name,
        createdAt: iso(row.report_created_at),
      }
      : null,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}
