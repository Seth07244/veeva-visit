/** 合规阈值。时长用秒比较，距离用米比较。 */
export const MIN_DURATION_SECONDS = 5 * 60;
export const MAX_DISTANCE_METERS = 500;
const EARTH_RADIUS_M = 6_371_000;

export const COMPLIANCE_REASONS = {
  DURATION_TOO_SHORT: `拜访时长不足 ${MIN_DURATION_SECONDS / 60} 分钟`,
  CHECK_IN_OFFSITE: `签到位置偏离医院超过 ${MAX_DISTANCE_METERS} 米`,
  CHECK_OUT_OFFSITE: `签退位置偏离医院超过 ${MAX_DISTANCE_METERS} 米`,
};

export function describeReasons(codes) {
  return codes.map((code) => ({
    code,
    message: COMPLIANCE_REASONS[code] || code,
  }));
}

/** 两点球面距离（米）。 */
export function distanceMeters(lat1, lng1, lat2, lng2) {
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lng2 - lng1);
  const a = Math.sin(Δφ / 2) ** 2
    + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

export function durationSeconds(checkInAt, checkOutAt) {
  const milliseconds = new Date(checkOutAt).getTime() - new Date(checkInAt).getTime();
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
    throw new Error('签退时间必须晚于签到时间');
  }
  return Math.floor(milliseconds / 1000);
}

/**
 * 异常条件取严格不等：不足 5 分钟，或距离大于 500 米。
 * 正好 300 秒、正好 500 米为合规。
 */
export function classify({
  durationSeconds: seconds,
  checkInDistanceMeters,
  checkOutDistanceMeters,
}) {
  if (!Number.isFinite(seconds) || seconds < 0) throw new Error('拜访时长无效');
  if (!Number.isFinite(checkInDistanceMeters) || checkInDistanceMeters < 0) {
    throw new Error('签到距离无效');
  }
  if (!Number.isFinite(checkOutDistanceMeters) || checkOutDistanceMeters < 0) {
    throw new Error('签退距离无效');
  }

  const reasons = [];
  if (seconds < MIN_DURATION_SECONDS) reasons.push('DURATION_TOO_SHORT');
  if (checkInDistanceMeters > MAX_DISTANCE_METERS) reasons.push('CHECK_IN_OFFSITE');
  if (checkOutDistanceMeters > MAX_DISTANCE_METERS) reasons.push('CHECK_OUT_OFFSITE');
  return {
    complianceStatus: reasons.length > 0 ? 'abnormal' : 'normal',
    reasons,
  };
}

/** 签到只能先判断位置。人还没离开，不能把合规提前写成“正常”。 */
export function evaluateCheckIn({ hospitalLat, hospitalLng, checkInLat, checkInLng }) {
  const checkInDistanceMeters = distanceMeters(hospitalLat, hospitalLng, checkInLat, checkInLng);
  const offsite = checkInDistanceMeters > MAX_DISTANCE_METERS;
  return {
    checkInDistanceMeters,
    complianceStatus: offsite ? 'abnormal' : 'pending',
    reasons: offsite ? ['CHECK_IN_OFFSITE'] : [],
  };
}

export function evaluateCompliance({
  hospitalLat,
  hospitalLng,
  checkInLat,
  checkInLng,
  checkOutLat,
  checkOutLng,
  checkInAt,
  checkOutAt,
}) {
  const seconds = durationSeconds(checkInAt, checkOutAt);
  const checkInDistanceMeters = distanceMeters(hospitalLat, hospitalLng, checkInLat, checkInLng);
  const checkOutDistanceMeters = distanceMeters(hospitalLat, hospitalLng, checkOutLat, checkOutLng);
  const outcome = classify({
    durationSeconds: seconds,
    checkInDistanceMeters,
    checkOutDistanceMeters,
  });
  return {
    durationSeconds: seconds,
    checkInDistanceMeters,
    checkOutDistanceMeters,
    ...outcome,
  };
}
