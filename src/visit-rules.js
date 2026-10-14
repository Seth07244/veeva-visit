export class VisitRuleError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'VisitRuleError';
    this.status = status;
  }
}

const EXPECTED_STATUS = {
  'check-in': 'planned',
  'check-out': 'checked_in',
  report: 'checked_out',
};

const ACTION_LABEL = {
  'check-in': '签到',
  'check-out': '签退',
  report: '提交拜访记录',
};

export function assertVisitAction(status, action) {
  if (status !== EXPECTED_STATUS[action]) {
    throw new VisitRuleError(`当前状态不可${ACTION_LABEL[action]}`, 409);
  }
}

export function requiredId(value, label) {
  if (typeof value !== 'number' && typeof value !== 'string') {
    throw new VisitRuleError(`${label}无效`);
  }
  const id = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new VisitRuleError(`${label}无效`);
  return id;
}

export function requiredText(value, label, max) {
  if (typeof value !== 'string') throw new VisitRuleError(`请填写${label}`);
  const text = value.trim();
  if (!text) throw new VisitRuleError(`请填写${label}`);
  if (text.length > max) throw new VisitRuleError(`${label}不能超过 ${max} 字`);
  return text;
}

export function optionalText(value, label, max) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') throw new VisitRuleError(`${label}无效`);
  const text = value.trim();
  if (!text) return null;
  if (text.length > max) throw new VisitRuleError(`${label}不能超过 ${max} 字`);
  return text;
}

export function assertCoordinate(latitude, longitude) {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new VisitRuleError('纬度无效');
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new VisitRuleError('经度无效');
  }
}

export function parseCoordinate(latitude, longitude) {
  if (latitude == null || latitude === '') throw new VisitRuleError('请填写纬度');
  if (longitude == null || longitude === '') throw new VisitRuleError('请填写经度');
  const lat = Number(latitude);
  const lng = Number(longitude);
  assertCoordinate(lat, lng);
  return { latitude: lat, longitude: lng };
}

export function parseRequiredTimestamp(value, label) {
  if (value == null || value === '') throw new VisitRuleError(`请填写${label}`);
  const time = new Date(value);
  if (Number.isNaN(time.getTime())) throw new VisitRuleError(`${label}无效`);
  return time;
}

export function parseTimestamp(value, label, now = () => new Date()) {
  if (value == null || value === '') return now();
  const time = new Date(value);
  if (Number.isNaN(time.getTime())) throw new VisitRuleError(`${label}无效`);
  return time;
}

export function assertReport(body) {
  const academicPoints = requiredText(body?.academicPoints, '学术沟通要点', 2000);
  const talkingPoints = requiredText(body?.talkingPoints, '谈话要点', 2000);
  const hcpFeedback = requiredText(body?.hcpFeedback, '医生反馈', 2000);
  if (typeof body?.materialsDistributed !== 'boolean') {
    throw new VisitRuleError('请标明是否派发学术资料');
  }
  const materialName = body.materialsDistributed
    ? requiredText(body.materialName, '学术资料名称', 200)
    : null;
  return {
    academicPoints,
    talkingPoints,
    hcpFeedback,
    materialsDistributed: body.materialsDistributed,
    materialName,
  };
}
