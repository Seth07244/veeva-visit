import assert from 'node:assert/strict';
import test from 'node:test';
import { currentMonth, monthRange } from './month.js';

test('月份区间按东八区取左闭右开', () => {
  assert.deepEqual(monthRange('2026-10'), {
    month: '2026-10',
    start: '2026-10-01T00:00:00+08:00',
    end: '2026-11-01T00:00:00+08:00',
  });
  assert.equal(monthRange('2026-12').end, '2027-01-01T00:00:00+08:00');
  assert.throws(() => monthRange('2026-13'), /YYYY-MM/);
  assert.throws(() => monthRange('2026-1'), /YYYY-MM/);
});

test('当前月份按上海时区而不是 UTC', () => {
  assert.equal(currentMonth(new Date('2026-10-31T15:59:00Z')), '2026-10');
  assert.equal(currentMonth(new Date('2026-10-31T16:00:00Z')), '2026-11');
});
