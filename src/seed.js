import { evaluateCheckIn, evaluateCompliance } from './compliance.js';

const HOSPITALS = [
  ['复旦大学附属中山医院', '上海市徐汇区枫林路180号', 31.2047, 121.4556],
  ['浙江大学医学院附属第一医院', '杭州市上城区庆春路79号', 30.2618, 120.1812],
  ['北京协和医院', '北京市东城区帅府园1号', 39.9133, 116.417],
  ['四川大学华西医院', '成都市武侯区国学巷37号', 30.6413, 104.0635],
];

const REPS = [
  ['陈晓舟', 'MR-10021', '华东'],
  ['林可', 'MR-10058', '华北'],
  ['周衡', 'MR-10103', '西南'],
];

const PRODUCTS = [
  ['VTN', '维妥宁', '原发性高血压'],
  ['STD', '舒糖达', '2 型糖尿病'],
  ['QFA', '清肺安', '慢性阻塞性肺疾病'],
  ['AYL', '安愈瘤', '非小细胞肺癌'],
];

const DEPARTMENTS = [
  ['复旦大学附属中山医院', '心内科'],
  ['复旦大学附属中山医院', '内分泌科'],
  ['浙江大学医学院附属第一医院', '呼吸与危重症医学科'],
  ['浙江大学医学院附属第一医院', '心内科'],
  ['北京协和医院', '内分泌科'],
  ['北京协和医院', '肿瘤内科'],
  ['四川大学华西医院', '呼吸与危重症医学科'],
  ['四川大学华西医院', '心内科'],
];

const HCPS = [
  ['赵明远', '主任医师', '复旦大学附属中山医院', '心内科'],
  ['苏晚晴', '副主任医师', '复旦大学附属中山医院', '内分泌科'],
  ['吴启年', '主任医师', '浙江大学医学院附属第一医院', '呼吸与危重症医学科'],
  ['沈知夏', '主治医师', '浙江大学医学院附属第一医院', '心内科'],
  ['韩淑君', '主任医师', '北京协和医院', '内分泌科'],
  ['梁知行', '副主任医师', '北京协和医院', '肿瘤内科'],
  ['何清和', '主任医师', '四川大学华西医院', '呼吸与危重症医学科'],
  ['邓小满', '主治医师', '四川大学华西医院', '心内科'],
];

const VISITS = [
  {
    rep: '陈晓舟',
    hcp: '赵明远',
    product: '维妥宁',
    plannedAt: '2026-10-02T09:00:00+08:00',
    objective: '沟通血压达标路径的最新证据',
    scenario: 'reported',
    minutes: 28,
    report: {
      academicPoints: '展示维妥宁降压达标路径，重点是联合治疗 12 周的诊室血压变化。',
      talkingPoints: '医生关注老年患者的低血压风险，约定下次带亚组数据。',
      hcpFeedback: '认可证据方向，希望看到肾功能不全人群的数据。',
      materialsDistributed: true,
      materialName: '《维妥宁降压达标路径临床综述》复印件',
    },
  },
  {
    rep: '陈晓舟',
    hcp: '苏晚晴',
    product: '舒糖达',
    plannedAt: '2026-10-03T10:00:00+08:00',
    objective: '介绍糖化血红蛋白变化和低血糖发生率',
    scenario: 'reported',
    minutes: 25,
    report: {
      academicPoints: '介绍舒糖达对糖化血红蛋白的影响，以及低血糖发生率。',
      talkingPoints: '医生询问与二甲双胍联用的起始剂量。',
      hcpFeedback: '愿意在新诊断患者中小范围试用。',
      materialsDistributed: true,
      materialName: '《舒糖达 III 期血糖控制数据摘要》复印件',
    },
  },
  {
    rep: '陈晓舟',
    hcp: '吴启年',
    product: '清肺安',
    plannedAt: '2026-10-06T14:00:00+08:00',
    objective: '讨论急性加重频率的临床数据',
    scenario: 'reported',
    minutes: 30,
    report: {
      academicPoints: '讲解清肺安对急性加重频率的影响。',
      talkingPoints: '科室目前急性加重患者较多，关注吸入装置教学。',
      hcpFeedback: '认为需要药剂科一起评估入院路径。',
      materialsDistributed: false,
    },
  },
  {
    rep: '林可',
    hcp: '韩淑君',
    product: '舒糖达',
    plannedAt: '2026-10-07T09:10:00+08:00',
    objective: '回顾心血管结局终点，而不是只看降糖幅度',
    scenario: 'reported',
    minutes: 30,
    report: {
      academicPoints: '回顾心血管结局终点，强调不是只看降糖幅度。',
      talkingPoints: '医生对比了现有 SGLT2 方案。',
      hcpFeedback: '对心衰合并糖尿病患者更感兴趣。',
      materialsDistributed: true,
      materialName: '《舒糖达心血管结局研究摘录》复印件',
    },
  },
  {
    rep: '林可',
    hcp: '梁知行',
    product: '安愈瘤',
    plannedAt: '2026-10-08T11:00:00+08:00',
    objective: '讲解一线治疗的无进展生存数据',
    scenario: 'reported',
    minutes: 35,
    report: {
      academicPoints: '展示安愈瘤一线治疗的无进展生存曲线。',
      talkingPoints: '讨论生物标志物检测周转时间。',
      hcpFeedback: '建议先和病理科打通检测流程。',
      materialsDistributed: false,
    },
  },
  {
    rep: '周衡',
    hcp: '何清和',
    product: '清肺安',
    plannedAt: '2026-10-09T15:00:00+08:00',
    objective: '说明急性加重住院率的获益人群',
    scenario: 'reported',
    minutes: 26,
    report: {
      academicPoints: '用急性加重住院率的图说明获益人群。',
      talkingPoints: '医生希望得到吸入技术的患教材料，而不是促销页。',
      hcpFeedback: '认可患教价值，要求材料带参考文献。',
      materialsDistributed: true,
      materialName: '《清肺安急性加重研究文献复印件》',
    },
  },
  {
    rep: '周衡',
    hcp: '邓小满',
    product: '维妥宁',
    plannedAt: '2026-10-10T08:40:00+08:00',
    objective: '聚焦清晨血压峰值的监测数据',
    scenario: 'reported',
    minutes: 25,
    report: {
      academicPoints: '聚焦清晨血压峰值的监测数据。',
      talkingPoints: '青年医生询问家庭血压计的推荐口径。',
      hcpFeedback: '可以在门诊随访表里加上清晨血压。',
      materialsDistributed: false,
    },
  },
  {
    rep: '陈晓舟',
    hcp: '沈知夏',
    product: '维妥宁',
    plannedAt: '2026-10-11T13:20:00+08:00',
    objective: '对照指南更新说明启动时机',
    scenario: 'reported',
    minutes: 30,
    report: {
      academicPoints: '对照指南更新，说明启动时机。',
      talkingPoints: '医生提到药占比，双方确认这次只做学术沟通。',
      hcpFeedback: '接受学术信息，进药需走药事会。',
      materialsDistributed: true,
      materialName: '《成人高血压诊疗相关指南摘录》复印件',
    },
  },
  {
    rep: '陈晓舟',
    hcp: '赵明远',
    product: '维妥宁',
    plannedAt: '2026-10-04T09:00:00+08:00',
    objective: '补充老年患者安全性数据',
    scenario: 'reported',
    minutes: 3,
    report: {
      academicPoints: '只来得及说明议程，医生被叫去抢救，沟通未展开。',
      talkingPoints: '未能完成既定学术内容。',
      hcpFeedback: '医生表示改期，本次没有形成药品评价。',
      materialsDistributed: false,
    },
  },
  {
    rep: '林可',
    hcp: '韩淑君',
    product: '舒糖达',
    plannedAt: '2026-10-05T10:00:00+08:00',
    objective: '讲解院外不便签到时的补救是不允许的，本次用于演示位置异常',
    scenario: 'reported',
    minutes: 20,
    checkInOffsite: true,
    report: {
      academicPoints: '幻灯讲完了降糖数据，但签到坐标不在医院范围内。',
      talkingPoints: '代表签到时未进入医院。',
      hcpFeedback: '医生听完数据，但本次到场位置不合规。',
      materialsDistributed: false,
    },
  },
  {
    rep: '周衡',
    hcp: '何清和',
    product: '清肺安',
    plannedAt: '2026-10-12T16:00:00+08:00',
    objective: '原计划讲急性加重数据，实际未在医院完成',
    scenario: 'reported',
    minutes: 2,
    checkInOffsite: true,
    checkOutOffsite: true,
    report: {
      academicPoints: '只过了一页摘要，签到和签退都不在医院范围。',
      talkingPoints: '停留很短，学术内容没有展开。',
      hcpFeedback: '医生未给出用药意见。',
      materialsDistributed: false,
    },
  },
  {
    rep: '陈晓舟',
    hcp: '苏晚晴',
    product: '舒糖达',
    plannedAt: '2026-10-13T09:30:00+08:00',
    objective: '随访上次关于联用剂量的问题',
    scenario: 'checked_out',
    minutes: 25,
  },
  {
    rep: '林可',
    hcp: '梁知行',
    product: '安愈瘤',
    plannedAt: '2026-10-14T09:00:00+08:00',
    objective: '对齐生物标志物检测流程',
    scenario: 'checked_in',
  },
  {
    rep: '陈晓舟',
    hcp: '赵明远',
    product: '维妥宁',
    plannedAt: '2026-10-16T09:30:00+08:00',
    objective: '补讲肾功能不全亚组数据',
    scenario: 'planned',
  },
  {
    rep: '周衡',
    hcp: '邓小满',
    product: '维妥宁',
    plannedAt: '2026-10-20T14:00:00+08:00',
    objective: '确认清晨血压随访表是否已启用',
    scenario: 'planned',
  },
];

function northOf(hospital, meters) {
  return {
    latitude: hospital.latitude + meters / 111_320,
    longitude: hospital.longitude,
  };
}

function buildTiming(hospital, item) {
  if (item.scenario === 'planned') {
    return {
      status: 'planned',
      checkInAt: null,
      checkInLat: null,
      checkInLng: null,
      checkInDistance: null,
      checkOutAt: null,
      checkOutLat: null,
      checkOutLng: null,
      checkOutDistance: null,
      durationSeconds: null,
      complianceStatus: 'pending',
      reasons: [],
    };
  }

  const checkIn = item.checkInOffsite ? northOf(hospital, 800) : hospital;
  const checkInAt = new Date(item.plannedAt);
  if (item.scenario === 'checked_in') {
    const result = evaluateCheckIn({
      hospitalLat: hospital.latitude,
      hospitalLng: hospital.longitude,
      checkInLat: checkIn.latitude,
      checkInLng: checkIn.longitude,
    });
    return {
      status: 'checked_in',
      checkInAt,
      checkInLat: checkIn.latitude,
      checkInLng: checkIn.longitude,
      checkInDistance: result.checkInDistanceMeters,
      checkOutAt: null,
      checkOutLat: null,
      checkOutLng: null,
      checkOutDistance: null,
      durationSeconds: null,
      complianceStatus: result.complianceStatus,
      reasons: result.reasons,
    };
  }

  const checkOut = item.checkOutOffsite ? northOf(hospital, 800) : hospital;
  const checkOutAt = new Date(checkInAt.getTime() + item.minutes * 60 * 1000);
  const result = evaluateCompliance({
    hospitalLat: hospital.latitude,
    hospitalLng: hospital.longitude,
    checkInLat: checkIn.latitude,
    checkInLng: checkIn.longitude,
    checkOutLat: checkOut.latitude,
    checkOutLng: checkOut.longitude,
    checkInAt,
    checkOutAt,
  });
  return {
    status: item.scenario === 'checked_out' ? 'checked_out' : 'reported',
    checkInAt,
    checkInLat: checkIn.latitude,
    checkInLng: checkIn.longitude,
    checkInDistance: result.checkInDistanceMeters,
    checkOutAt,
    checkOutLat: checkOut.latitude,
    checkOutLng: checkOut.longitude,
    checkOutDistance: result.checkOutDistanceMeters,
    durationSeconds: result.durationSeconds,
    complianceStatus: result.complianceStatus,
    reasons: result.reasons,
  };
}

export async function seed(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query('SELECT COUNT(*)::int AS n FROM products');
    if (existing.rows[0].n > 0) {
      await client.query('COMMIT');
      console.log('演示数据已存在，跳过初始化');
      return;
    }

    const hospitals = new Map();
    for (const [name, address, latitude, longitude] of HOSPITALS) {
      const { rows } = await client.query(
        `INSERT INTO hospitals (name, address, latitude, longitude)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, latitude, longitude`,
        [name, address, latitude, longitude],
      );
      hospitals.set(name, rows[0]);
    }

    const reps = new Map();
    for (const [name, employeeNo, region] of REPS) {
      const { rows } = await client.query(
        `INSERT INTO reps (name, employee_no, region) VALUES ($1, $2, $3) RETURNING id, name`,
        [name, employeeNo, region],
      );
      reps.set(name, rows[0]);
    }

    const products = new Map();
    for (const [code, name, indication] of PRODUCTS) {
      const { rows } = await client.query(
        `INSERT INTO products (code, name, indication) VALUES ($1, $2, $3) RETURNING id, name`,
        [code, name, indication],
      );
      products.set(name, rows[0]);
    }

    const departments = new Map();
    for (const [hospitalName, name] of DEPARTMENTS) {
      const hospital = hospitals.get(hospitalName);
      const { rows } = await client.query(
        `INSERT INTO departments (hospital_id, name) VALUES ($1, $2) RETURNING id`,
        [hospital.id, name],
      );
      departments.set(`${hospitalName}:${name}`, rows[0]);
    }

    const hcps = new Map();
    for (const [name, title, hospitalName, departmentName] of HCPS) {
      const hospital = hospitals.get(hospitalName);
      const department = departments.get(`${hospitalName}:${departmentName}`);
      const { rows } = await client.query(
        `INSERT INTO hcps (name, title, hospital_id, department_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name`,
        [name, title, hospital.id, department.id],
      );
      hcps.set(name, { ...rows[0], hospital, departmentId: department.id });
    }

    for (const item of VISITS) {
      const hcp = hcps.get(item.hcp);
      const timing = buildTiming(hcp.hospital, item);
      const inserted = await client.query(
        `INSERT INTO visits (
           rep_id, hcp_id, hospital_id, department_id, product_id,
           planned_at, objective, status,
           check_in_at, check_in_lat, check_in_lng, check_in_distance_m,
           check_out_at, check_out_lat, check_out_lng, check_out_distance_m,
           duration_seconds, compliance_status, compliance_reasons
         ) VALUES (
           $1,$2,$3,$4,$5,
           $6,$7,$8,
           $9,$10,$11,$12,
           $13,$14,$15,$16,
           $17,$18,$19::jsonb
         ) RETURNING id`,
        [
          reps.get(item.rep).id,
          hcp.id,
          hcp.hospital.id,
          hcp.departmentId,
          products.get(item.product).id,
          new Date(item.plannedAt),
          item.objective,
          timing.status,
          timing.checkInAt,
          timing.checkInLat,
          timing.checkInLng,
          timing.checkInDistance,
          timing.checkOutAt,
          timing.checkOutLat,
          timing.checkOutLng,
          timing.checkOutDistance,
          timing.durationSeconds,
          timing.complianceStatus,
          JSON.stringify(timing.reasons),
        ],
      );
      if (item.report) {
        await client.query(
          `INSERT INTO call_reports (
             visit_id, academic_points, talking_points, hcp_feedback,
             materials_distributed, material_name
           ) VALUES ($1,$2,$3,$4,$5,$6)`,
          [
            inserted.rows[0].id,
            item.report.academicPoints,
            item.report.talkingPoints,
            item.report.hcpFeedback,
            item.report.materialsDistributed,
            item.report.materialName || null,
          ],
        );
      }
    }

    await client.query('COMMIT');
    console.log(`已写入 ${VISITS.length} 条演示拜访`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
