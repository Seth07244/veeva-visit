import assert from 'node:assert/strict';
import test from 'node:test';
import {
  VisitRuleError,
  assertCoordinate,
  assertReport,
  assertVisitAction,
  optionalText,
  parseCoordinate,
  parseRequiredTimestamp,
  parseTimestamp,
  requiredId,
  requiredText,
} from './visit-rules.js';

test('拜访只能按计划、签到、签退、记录的顺序推进', () => {
  assert.doesNotThrow(() => assertVisitAction('planned', 'check-in'));
  assert.doesNotThrow(() => assertVisitAction('checked_in', 'check-out'));
  assert.doesNotThrow(() => assertVisitAction('checked_out', 'report'));

  assert.throws(() => assertVisitAction('planned', 'check-out'), (error) => {
    assert.ok(error instanceof VisitRuleError);
    assert.equal(error.status, 409);
    assert.match(error.message, /签退/);
    return true;
  });
  assert.throws(() => assertVisitAction('reported', 'report'), (error) => {
    assert.equal(error.status, 409);
    return true;
  });
});

test('主键、文本和坐标做基本校验', () => {
  assert.equal(requiredId(3, '医生'), 3);
  assert.equal(requiredId('12', '产品'), 12);
  assert.throws(() => requiredId(0, '医药代表'), /医药代表无效/);
  assert.throws(() => requiredId(1.5, '医药代表'), /医药代表无效/);
  assert.throws(() => requiredId(true, '医药代表'), /医药代表无效/);

  assert.equal(requiredText('  临床数据  ', '学术沟通要点', 20), '临床数据');
  assert.throws(() => requiredText('   ', '谈话要点', 20), /请填写谈话要点/);
  assert.throws(() => requiredText('一二三四五', '医生反馈', 4), /不能超过 4 字/);
  assert.equal(optionalText('  ', '拜访目的', 10), null);
  assert.equal(optionalText('沟通指南更新', '拜访目的', 20), '沟通指南更新');

  assert.doesNotThrow(() => assertCoordinate(90, 180));
  assert.doesNotThrow(() => assertCoordinate(-90, -180));
  assert.throws(() => assertCoordinate(90.1, 0), /纬度无效/);
  assert.throws(() => assertCoordinate(0, 180.1), /经度无效/);
  assert.deepEqual(parseCoordinate('31.2', '121.4'), { latitude: 31.2, longitude: 121.4 });
  assert.throws(() => parseCoordinate('', '121'), /请填写纬度/);
  assert.throws(() => parseCoordinate('31', ''), /请填写经度/);
});

test('时间解析：计划时间必填，签到时间可以缺省为当前时间', () => {
  const parsed = parseRequiredTimestamp('2026-10-16T09:30:00+08:00', '计划时间');
  assert.equal(parsed.toISOString(), '2026-10-16T01:30:00.000Z');
  assert.throws(() => parseRequiredTimestamp('', '计划时间'), /请填写计划时间/);
  assert.throws(() => parseRequiredTimestamp('明天', '计划时间'), /计划时间无效/);

  const now = new Date('2026-10-14T01:00:00.000Z');
  assert.equal(parseTimestamp('', '签到时间', () => now), now);
  assert.throws(() => parseTimestamp('not-a-date', '签退时间'), /签退时间无效/);
});

test('拜访记录：派发资料时名称必填，未派发时不保存名称', () => {
  const saved = assertReport({
    academicPoints: ' 展示降压达标数据 ',
    talkingPoints: '医生询问老年患者安全性',
    hcpFeedback: '希望补充肾功能不全亚组',
    materialsDistributed: true,
    materialName: ' 文献复印件 ',
  });
  assert.equal(saved.academicPoints, '展示降压达标数据');
  assert.equal(saved.materialName, '文献复印件');

  const none = assertReport({
    academicPoints: '讲解急性加重数据',
    talkingPoints: '未进入剂量讨论',
    hcpFeedback: '本次不评价',
    materialsDistributed: false,
    materialName: '不应该被保存',
  });
  assert.equal(none.materialName, null);

  assert.throws(() => assertReport({
    academicPoints: '要点',
    talkingPoints: '谈话',
    hcpFeedback: '反馈',
    materialsDistributed: true,
    materialName: '  ',
  }), /学术资料名称/);
  assert.throws(() => assertReport({
    academicPoints: '要点',
    talkingPoints: '谈话',
    hcpFeedback: '反馈',
  }), /是否派发学术资料/);
});
