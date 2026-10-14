import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_DISTANCE_METERS,
  MIN_DURATION_SECONDS,
  classify,
  describeReasons,
  distanceMeters,
  durationSeconds,
  evaluateCheckIn,
  evaluateCompliance,
} from './compliance.js';

const HOSPITAL = { lat: 31.2047, lng: 121.4556 };

test('球面距离：同一点为 0，赤道上跨 1 度经度接近理论值', () => {
  assert.equal(distanceMeters(HOSPITAL.lat, HOSPITAL.lng, HOSPITAL.lat, HOSPITAL.lng), 0);
  const equator = distanceMeters(0, 0, 0, 1);
  const expected = (2 * Math.PI * 6_371_000) / 360;
  assert.ok(Math.abs(equator - expected) < 0.01);
  const forward = distanceMeters(31, 121, 32, 122);
  const backward = distanceMeters(32, 122, 31, 121);
  assert.ok(Math.abs(forward - backward) < 1e-6);
});

test('时长按整秒向下取，签退不晚于签到时拒绝', () => {
  const start = '2026-10-02T09:00:00+08:00';
  assert.equal(durationSeconds(start, '2026-10-02T09:05:00.900+08:00'), 300);
  assert.equal(durationSeconds(start, '2026-10-02T09:04:59+08:00'), 299);
  assert.throws(() => durationSeconds(start, start), /签退时间必须晚于签到时间/);
  assert.throws(() => durationSeconds(start, '2026-10-02T08:59:00+08:00'), /签退时间必须晚于签到时间/);
});

test('合规边界：5 分钟和 500 米仍然合规，再少一点或再远一点为异常', () => {
  assert.equal(MIN_DURATION_SECONDS, 300);
  assert.equal(MAX_DISTANCE_METERS, 500);

  const normal = classify({
    durationSeconds: 300,
    checkInDistanceMeters: 500,
    checkOutDistanceMeters: 500,
  });
  assert.equal(normal.complianceStatus, 'normal');
  assert.deepEqual(normal.reasons, []);

  const short = classify({
    durationSeconds: 299,
    checkInDistanceMeters: 500,
    checkOutDistanceMeters: 500,
  });
  assert.deepEqual(short.reasons, ['DURATION_TOO_SHORT']);

  const checkInFar = classify({
    durationSeconds: 300,
    checkInDistanceMeters: 500.01,
    checkOutDistanceMeters: 500,
  });
  assert.deepEqual(checkInFar.reasons, ['CHECK_IN_OFFSITE']);

  const checkOutFar = classify({
    durationSeconds: 300,
    checkInDistanceMeters: 0,
    checkOutDistanceMeters: 500.01,
  });
  assert.deepEqual(checkOutFar.reasons, ['CHECK_OUT_OFFSITE']);

  const both = classify({
    durationSeconds: 120,
    checkInDistanceMeters: 800,
    checkOutDistanceMeters: 900,
  });
  assert.equal(both.complianceStatus, 'abnormal');
  assert.deepEqual(both.reasons, ['DURATION_TOO_SHORT', 'CHECK_IN_OFFSITE', 'CHECK_OUT_OFFSITE']);
});

test('签到只结算位置：在院内保持待核算，偏离则立即异常', () => {
  const onsite = evaluateCheckIn({
    hospitalLat: HOSPITAL.lat,
    hospitalLng: HOSPITAL.lng,
    checkInLat: HOSPITAL.lat,
    checkInLng: HOSPITAL.lng,
  });
  assert.equal(onsite.complianceStatus, 'pending');
  assert.deepEqual(onsite.reasons, []);
  assert.equal(onsite.checkInDistanceMeters, 0);

  const offsite = evaluateCheckIn({
    hospitalLat: HOSPITAL.lat,
    hospitalLng: HOSPITAL.lng,
    checkInLat: HOSPITAL.lat + 800 / 111_320,
    checkInLng: HOSPITAL.lng,
  });
  assert.equal(offsite.complianceStatus, 'abnormal');
  assert.deepEqual(offsite.reasons, ['CHECK_IN_OFFSITE']);
  assert.ok(offsite.checkInDistanceMeters > 500);
});

test('签退同时核算时长和两处位置', () => {
  const start = '2026-10-04T09:00:00+08:00';
  const farLat = HOSPITAL.lat + 800 / 111_320;
  const abnormal = evaluateCompliance({
    hospitalLat: HOSPITAL.lat,
    hospitalLng: HOSPITAL.lng,
    checkInLat: farLat,
    checkInLng: HOSPITAL.lng,
    checkOutLat: farLat,
    checkOutLng: HOSPITAL.lng,
    checkInAt: start,
    checkOutAt: '2026-10-04T09:03:00+08:00',
  });
  assert.equal(abnormal.durationSeconds, 180);
  assert.ok(abnormal.checkInDistanceMeters > 500);
  assert.ok(abnormal.checkOutDistanceMeters > 500);
  assert.deepEqual(abnormal.reasons, ['DURATION_TOO_SHORT', 'CHECK_IN_OFFSITE', 'CHECK_OUT_OFFSITE']);

  const normal = evaluateCompliance({
    hospitalLat: HOSPITAL.lat,
    hospitalLng: HOSPITAL.lng,
    checkInLat: HOSPITAL.lat,
    checkInLng: HOSPITAL.lng,
    checkOutLat: HOSPITAL.lat,
    checkOutLng: HOSPITAL.lng,
    checkInAt: start,
    checkOutAt: '2026-10-04T09:20:00+08:00',
  });
  assert.equal(normal.complianceStatus, 'normal');
  assert.equal(normal.durationSeconds, 1200);
});

test('原因码会转成可读说明，未知码原样返回', () => {
  const reasons = describeReasons(['DURATION_TOO_SHORT', 'UNKNOWN']);
  assert.equal(reasons[0].message, '拜访时长不足 5 分钟');
  assert.equal(reasons[1].message, 'UNKNOWN');
});
