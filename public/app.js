const state = {
  view: 'list',
  meta: null,
  visits: [],
  visitsLoaded: false,
  visit: null,
  dashboard: null,
  month: '',
  statusFilter: 'all',
  complianceFilter: 'all',
  error: '',
};

let requestToken = 0;

function nextToken() {
  requestToken += 1;
  return requestToken;
}

function isCurrent(token) {
  return token === requestToken;
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function distanceMeters(lat1, lng1, lat2, lng2) {
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lng2 - lng1);
  const a = Math.sin(Δφ / 2) ** 2
    + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function toDatetimeLocal(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function plusMinutes(iso, minutes) {
  return toDatetimeLocal(new Date(new Date(iso).getTime() + minutes * 60 * 1000));
}

function tomorrowMorning() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 30, 0, 0);
  return toDatetimeLocal(date);
}

function formatWhen(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

function formatFull(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

function formatDuration(seconds) {
  if (seconds == null) return '—';
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  if (remain === 0) return `${minutes} 分钟`;
  return `${minutes} 分 ${remain} 秒`;
}

function formatMeters(meters) {
  if (meters == null || Number.isNaN(Number(meters))) return '—';
  return `${Number(meters).toFixed(1)} 米`;
}

function coordText(latitude, longitude) {
  return `${Number(latitude).toFixed(6)}，${Number(longitude).toFixed(6)}`;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || '请求失败');
  return data;
}

function ruleSentence(rules) {
  const minutes = rules.minDurationSeconds / 60;
  return `时长不足 ${minutes} 分钟，或签到、签退偏离医院超过 ${rules.maxDistanceMeters} 米，记为异常。`;
}

function syncNav() {
  const onDashboard = state.view === 'dashboard';
  document.querySelector('[data-action="go-list"]')?.classList.toggle('active', !onDashboard);
  document.querySelector('[data-action="go-dashboard"]')?.classList.toggle('active', onDashboard);
}

function render() {
  const main = document.querySelector('#main');
  if (state.view === 'create') main.innerHTML = renderCreate();
  else if (state.view === 'detail') main.innerHTML = renderDetail();
  else if (state.view === 'dashboard') main.innerHTML = renderDashboard();
  else main.innerHTML = renderList();
  syncNav();
}

function pageHead(title, subtitle, actions) {
  return `<header class="page-head">
    <div><h1>${title}</h1><p class="sub">${subtitle}</p></div>
    <div class="actions">${actions}</div>
  </header>${state.error ? `<p class="form-error">${esc(state.error)}</p>` : ''}`;
}

function filteredVisits() {
  return state.visits.filter((visit) => {
    if (state.statusFilter !== 'all' && visit.status !== state.statusFilter) return false;
    if (state.complianceFilter !== 'all' && visit.compliance.status !== state.complianceFilter) return false;
    return true;
  });
}

function renderList() {
  const head = pageHead(
    '拜访',
    '计划、签到、签退和学术记录。演示数据里已经放了合规与异常样本。',
    '<button type="button" class="primary" data-action="go-create">新建拜访</button>',
  );
  if (!state.visitsLoaded) return `${head}<p class="hint">正在加载拜访…</p>`;
  const visits = filteredVisits();
  const rows = visits.length
    ? visits.map((visit) => `<tr data-action="open" data-id="${visit.id}">
        <td class="nowrap num">${esc(formatWhen(visit.plannedAt))}</td>
        <td>${esc(visit.rep.name)}</td>
        <td>${esc(visit.hcp.name)}<div class="muted">${esc(visit.hcp.title)}</div></td>
        <td>${esc(visit.hospital.name)}<div class="muted">${esc(visit.department.name)}</div></td>
        <td>${esc(visit.product.name)}<div class="muted">${esc(visit.product.code)}</div></td>
        <td><span class="pill ${esc(visit.status)}">${esc(visit.statusLabel)}</span></td>
        <td><span class="pill ${esc(visit.compliance.status)}" title="${esc(visit.compliance.reasons.map((item) => item.message).join('；'))}">${esc(visit.compliance.label)}</span></td>
        <td><button type="button" data-action="open" data-id="${visit.id}">处理</button></td>
      </tr>`).join('')
    : '<tr><td colspan="8" class="empty">没有符合筛选条件的拜访。</td></tr>';
  return `${head}
    <div class="toolbar">
      <select id="status-filter">
        ${option('all', '全部状态', state.statusFilter)}
        ${option('planned', '待签到', state.statusFilter)}
        ${option('checked_in', '拜访中', state.statusFilter)}
        ${option('checked_out', '待记录', state.statusFilter)}
        ${option('reported', '已完成', state.statusFilter)}
      </select>
      <select id="compliance-filter">
        ${option('all', '全部合规结果', state.complianceFilter)}
        ${option('pending', '待核算', state.complianceFilter)}
        ${option('normal', '合规', state.complianceFilter)}
        ${option('abnormal', '异常', state.complianceFilter)}
      </select>
      <span class="muted">共 ${visits.length} 条</span>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>计划时间</th><th>代表</th><th>医生</th><th>医院 / 科室</th><th>产品</th><th>状态</th><th>合规</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
}

function option(value, label, current) {
  return `<option value="${esc(value)}"${value === current ? ' selected' : ''}>${esc(label)}</option>`;
}

function renderCreate() {
  const hospitals = state.meta.hospitals;
  const hospital = hospitals[0];
  const departments = state.meta.departments.filter((item) => item.hospitalId === hospital.id);
  const doctors = state.meta.hcps.filter((item) => item.departmentId === departments[0]?.id);
  return `${pageHead('新建拜访', '选择代表、医生和本次要沟通的产品。医院与科室随医生确定。', '<button type="button" data-action="go-list">返回列表</button>')}
    <section class="card">
      <form data-form="create">
        <p class="form-error" hidden></p>
        <div class="form-grid">
          <label>医药代表<select name="repId">${state.meta.reps.map((item) => `<option value="${item.id}">${esc(item.name)} · ${esc(item.region)}</option>`).join('')}</select></label>
          <label>产品<select name="productId">${state.meta.products.map((item) => `<option value="${item.id}">${esc(item.name)} · ${esc(item.indication)}</option>`).join('')}</select></label>
          <label>医院<select id="hospital">${hospitals.map((item) => `<option value="${item.id}">${esc(item.name)}</option>`).join('')}</select></label>
          <label>科室<select id="department">${departments.map((item) => `<option value="${item.id}">${esc(item.name)}</option>`).join('')}</select></label>
          <label>医生<select id="hcp" name="hcpId">${doctors.map((item) => `<option value="${item.id}">${esc(item.name)} · ${esc(item.title)}</option>`).join('') || '<option value="">该科室暂无医生</option>'}</select></label>
          <label>计划时间<input type="datetime-local" name="plannedAt" value="${tomorrowMorning()}" required></label>
          <label class="wide">拜访目的<textarea name="objective" maxlength="500" placeholder="例如：沟通最新临床数据，不涉及进药承诺"></textarea></label>
        </div>
        <div class="actions"><button type="submit" class="primary">创建计划</button></div>
      </form>
    </section>`;
}

function renderDetail() {
  const head = pageHead('拜访详情', '正在读取这条拜访。', '<button type="button" data-action="go-list">返回列表</button>');
  if (!state.visit) return `${head}<p class="hint">正在加载拜访…</p>`;
  const visit = state.visit;
  return `${pageHead(
    `拜访 #${visit.id}`,
    `${esc(visit.hcp.name)} · ${esc(visit.department.name)} · ${esc(visit.hospital.name)}`,
    '<button type="button" data-action="go-list">返回列表</button>',
  )}
    ${banner(visit)}
    ${planCard(visit)}
    ${checkInCard(visit)}
    ${checkOutCard(visit)}
    ${reportCard(visit)}`;
}

function banner(visit) {
  const reasons = visit.compliance.reasons.map((item) => `<li>${esc(item.message)}</li>`).join('');
  let extra = '签退完成后结算时长，并复核签到、签退两处位置。';
  if (visit.compliance.status === 'normal') extra = '时长和两处位置都在规则内。';
  if (visit.compliance.status === 'abnormal') extra = '下面几项触发了异常。';
  return `<section class="banner ${esc(visit.compliance.status)}">
    <strong>${esc(visit.compliance.label)} · ${esc(visit.statusLabel)}</strong>
    <span>${extra}</span>
    ${reasons ? `<ul>${reasons}</ul>` : ''}
  </section>`;
}

function planCard(visit) {
  return `<section class="card">
    <h2><span class="step-no">1</span>拜访计划</h2>
    <dl>
      <dt>计划时间</dt><dd class="num">${esc(formatFull(visit.plannedAt))}</dd>
      <dt>代表</dt><dd>${esc(visit.rep.name)} · ${esc(visit.rep.employeeNo)} · ${esc(visit.rep.region)}</dd>
      <dt>医生</dt><dd>${esc(visit.hcp.name)} · ${esc(visit.hcp.title)}</dd>
      <dt>地点</dt><dd>${esc(visit.hospital.name)} ${esc(visit.department.name)}<div class="muted">${esc(visit.hospital.address)}</div></dd>
      <dt>产品</dt><dd>${esc(visit.product.name)} · ${esc(visit.product.indication)}</dd>
      <dt>目的</dt><dd>${esc(visit.objective || '未填写')}</dd>
    </dl>
  </section>`;
}

function coordFields(defaultTime) {
  return `<p class="form-error" hidden></p>
    <div class="form-grid">
      <label>纬度<input name="latitude" type="number" step="any" data-preview></label>
      <label>经度<input name="longitude" type="number" step="any" data-preview></label>
      <label class="wide">时间<input type="datetime-local" name="checkedAt" value="${esc(defaultTime)}" required></label>
    </div>
    <p class="distance-preview">输入坐标后可预览与医院的距离，最终以服务端核算为准。</p>`;
}

function checkInCard(visit) {
  if (visit.checkIn) {
    return `<section class="card">
      <h2><span class="step-no">2</span>现场签到</h2>
      <dl>
        <dt>时间</dt><dd class="num">${esc(formatFull(visit.checkIn.at))}</dd>
        <dt>坐标</dt><dd class="num">${esc(coordText(visit.checkIn.latitude, visit.checkIn.longitude))}</dd>
        <dt>距医院</dt><dd class="num">${esc(formatMeters(visit.checkIn.distanceMeters))}</dd>
      </dl>
    </section>`;
  }
  return `<section class="card">
    <h2><span class="step-no">2</span>现场签到</h2>
    <p class="hint">医院基准坐标 ${esc(coordText(visit.hospital.latitude, visit.hospital.longitude))}。桌面演练请手工输入，用来模拟手机定位。</p>
    <form id="check-form" data-form="check-in">
      ${coordFields(toDatetimeLocal(new Date()))}
      <div class="actions">
        <button type="button" data-action="use-hospital">填入医院坐标</button>
        <button type="button" data-action="offset-hospital">向北偏移约 800 米</button>
        <button type="submit" class="primary">签到</button>
      </div>
    </form>
  </section>`;
}

function checkOutCard(visit) {
  if (visit.checkOut) {
    return `<section class="card">
      <h2><span class="step-no">3</span>拜访签退</h2>
      <dl>
        <dt>时间</dt><dd class="num">${esc(formatFull(visit.checkOut.at))}</dd>
        <dt>坐标</dt><dd class="num">${esc(coordText(visit.checkOut.latitude, visit.checkOut.longitude))}</dd>
        <dt>距医院</dt><dd class="num">${esc(formatMeters(visit.checkOut.distanceMeters))}</dd>
        <dt>停留</dt><dd class="num">${esc(formatDuration(visit.durationSeconds))}</dd>
      </dl>
    </section>`;
  }
  if (visit.status !== 'checked_in') {
    return `<section class="card"><h2><span class="step-no">3</span>拜访签退</h2><p class="hint">签到之后才能签退。签退时结算停留时长。</p></section>`;
  }
  return `<section class="card">
    <h2><span class="step-no">3</span>拜访签退</h2>
    <p class="hint">时间默认是签到后 20 分钟。坐标请手工填写，或用下面的按钮填入医院坐标、向北偏移约 800 米。</p>
    <form id="check-form" data-form="check-out">
      ${coordFields(plusMinutes(visit.checkIn.at, 20))}
      <div class="actions">
        <button type="button" data-action="use-hospital">填入医院坐标</button>
        <button type="button" data-action="offset-hospital">向北偏移约 800 米</button>
        <button type="button" data-action="duration-normal">签到后 20 分钟</button>
        <button type="button" data-action="duration-short">签到后 3 分钟</button>
        <button type="submit" class="primary">签退</button>
      </div>
    </form>
  </section>`;
}

function reportCard(visit) {
  if (visit.report) {
    const material = visit.report.materialsDistributed
      ? `已派发：${visit.report.materialName}`
      : '未派发学术资料';
    return `<section class="card">
      <h2><span class="step-no">4</span>学术沟通与记录</h2>
      <dl>
        <dt>学术内容</dt><dd>${esc(visit.report.academicPoints)}</dd>
        <dt>谈话要点</dt><dd>${esc(visit.report.talkingPoints)}</dd>
        <dt>医生反馈</dt><dd>${esc(visit.report.hcpFeedback)}</dd>
        <dt>资料</dt><dd>${esc(material)}</dd>
      </dl>
    </section>`;
  }
  if (visit.status !== 'checked_out') {
    return `<section class="card"><h2><span class="step-no">4</span>学术沟通与记录</h2><p class="hint">签退完成后，补充本次展示的学术内容、医生反馈，以及是否留下文献复印件。</p></section>`;
  }
  return `<section class="card">
    <h2><span class="step-no">4</span>学术沟通与记录</h2>
    <form data-form="report">
      <p class="form-error" hidden></p>
      <div class="form-grid">
        <label class="wide">学术沟通要点<textarea name="academicPoints" required placeholder="展示了哪份 PPT 或临床数据"></textarea></label>
        <label class="wide">谈话要点<textarea name="talkingPoints" required></textarea></label>
        <label class="wide">医生反馈<textarea name="hcpFeedback" required></textarea></label>
        <label>是否派发学术资料<select name="materialsDistributed"><option value="">请选择</option><option value="yes">已派发</option><option value="no">未派发</option></select></label>
        <label>资料名称<input name="materialName" placeholder="例如：III 期文献复印件"></label>
      </div>
      <div class="actions"><button type="submit" class="primary">提交记录</button></div>
    </form>
  </section>`;
}

function renderDashboard() {
  const monthValue = state.month || state.dashboard?.month || '';
  const head = pageHead(
    '月度看板',
    '按产品统计。一次拜访计入计划时间所在月份；已完成指已签退或已提交记录。',
    `<input id="month" type="month" value="${esc(monthValue)}">`,
  );
  if (!state.dashboard) return `${head}<p class="hint">正在统计…</p>`;
  const { totals, products } = state.dashboard;
  const max = Math.max(1, ...products.map((item) => item.total));
  const rows = products.map((item) => {
    const rest = Math.max(0, item.total - item.normal - item.abnormal);
    return `<tr>
      <td>${esc(item.name)}<div class="muted">${esc(item.code)} · ${esc(item.indication)}</div></td>
      <td class="num">${item.total}</td>
      <td class="num">${item.inProgress}</td>
      <td class="num">${item.completed}</td>
      <td class="num">${item.normal}</td>
      <td class="num">${item.abnormal}</td>
      <td><div class="bar" title="合规 ${item.normal}，异常 ${item.abnormal}，其余 ${rest}">
        <span class="normal" style="width:${(item.normal / max) * 100}%"></span>
        <span class="abnormal" style="width:${(item.abnormal / max) * 100}%"></span>
        <span class="rest" style="width:${(rest / max) * 100}%"></span>
      </div></td>
    </tr>`;
  }).join('');
  const empty = totals.total === 0 ? '<p class="hint">这个月还没有拜访。</p>' : '';
  return `${head}
    <div class="metrics">
      <div class="metric"><b>${totals.total}</b><span>本月拜访</span></div>
      <div class="metric"><b>${totals.completed}</b><span>已完成</span></div>
      <div class="metric"><b>${totals.normal}</b><span>合规</span></div>
      <div class="metric"><b>${totals.abnormal}</b><span>异常</span></div>
    </div>
    ${empty}
    <p class="legend"><span><i class="swatch normal"></i>合规</span><span><i class="swatch abnormal"></i>异常</span><span><i class="swatch rest"></i>未结算或其他</span></p>
    <div class="table-wrap"><table>
      <thead><tr><th>产品</th><th>次数</th><th>拜访中</th><th>已完成</th><th>合规</th><th>异常</th><th>分布</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
}

function onHospitalChange(select) {
  const hospitalId = Number(select.value);
  const departments = state.meta.departments.filter((item) => item.hospitalId === hospitalId);
  const department = document.querySelector('#department');
  department.innerHTML = departments.length
    ? departments.map((item) => `<option value="${item.id}">${esc(item.name)}</option>`).join('')
    : '<option value="">暂无科室</option>';
  onDepartmentChange(department);
}

function onDepartmentChange(select) {
  const departmentId = Number(select.value);
  const doctors = state.meta.hcps.filter((item) => item.departmentId === departmentId);
  document.querySelector('#hcp').innerHTML = doctors.length
    ? doctors.map((item) => `<option value="${item.id}">${esc(item.name)} · ${esc(item.title)}</option>`).join('')
    : '<option value="">该科室暂无医生</option>';
}

function showInlineError(message) {
  const el = document.querySelector('.form-error');
  if (!el) {
    state.error = message;
    render();
    return;
  }
  el.hidden = false;
  el.textContent = message;
}

function clearInlineError() {
  const el = document.querySelector('.form-error');
  if (!el) return;
  el.hidden = true;
  el.textContent = '';
}

function updatePreview() {
  const form = document.querySelector('#check-form');
  const preview = document.querySelector('.distance-preview');
  if (!form || !preview || !state.visit) return;
  const latitude = form.latitude.value.trim();
  const longitude = form.longitude.value.trim();
  if (latitude === '' || longitude === '') {
    preview.textContent = '输入坐标后可预览与医院的距离，最终以服务端核算为准。';
    return;
  }
  const meters = distanceMeters(
    state.visit.hospital.latitude,
    state.visit.hospital.longitude,
    Number(latitude),
    Number(longitude),
  );
  const limit = state.meta.rules.maxDistanceMeters;
  const flag = meters > limit ? `超过 ${limit} 米` : `未超过 ${limit} 米`;
  preview.textContent = `预览距离 ${meters.toFixed(1)} 米，${flag}。最终以服务端核算为准。`;
}

function fillHospital(offsite) {
  const form = document.querySelector('#check-form');
  if (!form || !state.visit) return;
  const { latitude, longitude } = state.visit.hospital;
  form.latitude.value = offsite ? (latitude + 800 / 111_320).toFixed(6) : latitude;
  form.longitude.value = longitude;
  updatePreview();
}

async function showList() {
  const token = nextToken();
  state.view = 'list';
  state.error = '';
  render();
  try {
    const data = await api('/api/visits');
    if (!isCurrent(token)) return;
    state.visits = data.visits;
    state.visitsLoaded = true;
    render();
  } catch (error) {
    if (!isCurrent(token)) return;
    state.error = error.message;
    render();
  }
}

async function openVisit(id) {
  const token = nextToken();
  state.view = 'detail';
  state.visit = null;
  state.error = '';
  render();
  try {
    const visit = await api(`/api/visits/${id}`);
    if (!isCurrent(token)) return;
    state.visit = visit;
    render();
  } catch (error) {
    if (!isCurrent(token)) return;
    state.error = error.message;
    render();
  }
}

async function showDashboard(month) {
  const token = nextToken();
  if (month && month !== state.month) state.dashboard = null;
  if (month) state.month = month;
  state.view = 'dashboard';
  state.error = '';
  render();
  try {
    const query = state.month ? `?month=${encodeURIComponent(state.month)}` : '';
    const data = await api(`/api/dashboard${query}`);
    if (!isCurrent(token)) return;
    state.dashboard = data;
    state.month = data.month;
    render();
  } catch (error) {
    if (!isCurrent(token)) return;
    state.error = error.message;
    render();
  }
}

async function submitCreate(form) {
  if (!form.hcpId.value) throw new Error('请选择医生');
  if (!form.plannedAt.value) throw new Error('请填写计划时间');
  const visit = await api('/api/visits', {
    method: 'POST',
    body: JSON.stringify({
      repId: Number(form.repId.value),
      hcpId: Number(form.hcpId.value),
      productId: Number(form.productId.value),
      plannedAt: new Date(form.plannedAt.value).toISOString(),
      objective: form.objective.value,
    }),
  });
  state.view = 'detail';
  state.visit = visit;
  state.visitsLoaded = false;
  state.error = '';
  render();
}

async function submitCheck(form) {
  if (form.latitude.value.trim() === '' || form.longitude.value.trim() === '') {
    throw new Error('请填写纬度和经度');
  }
  if (!form.checkedAt.value) throw new Error('请填写时间');
  const isCheckIn = form.dataset.form === 'check-in';
  const body = {
    latitude: Number(form.latitude.value),
    longitude: Number(form.longitude.value),
  };
  body[isCheckIn ? 'checkedInAt' : 'checkedOutAt'] = new Date(form.checkedAt.value).toISOString();
  state.visit = await api(`/api/visits/${state.visit.id}/${isCheckIn ? 'check-in' : 'check-out'}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  state.visitsLoaded = false;
  state.error = '';
  render();
}

async function submitReport(form) {
  const choice = form.materialsDistributed.value;
  if (choice !== 'yes' && choice !== 'no') throw new Error('请标明是否派发学术资料');
  state.visit = await api(`/api/visits/${state.visit.id}/report`, {
    method: 'POST',
    body: JSON.stringify({
      academicPoints: form.academicPoints.value,
      talkingPoints: form.talkingPoints.value,
      hcpFeedback: form.hcpFeedback.value,
      materialsDistributed: choice === 'yes',
      materialName: form.materialName.value,
    }),
  });
  state.visitsLoaded = false;
  state.error = '';
  render();
}

document.body.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  if (action === 'go-list') showList();
  if (action === 'go-create') {
    state.view = 'create';
    state.error = '';
    render();
  }
  if (action === 'go-dashboard') showDashboard();
  if (action === 'open') openVisit(button.dataset.id);
  if (action === 'use-hospital') fillHospital(false);
  if (action === 'offset-hospital') fillHospital(true);
  if (action === 'duration-normal' || action === 'duration-short') {
    const form = document.querySelector('#check-form');
    if (!form || !state.visit?.checkIn) return;
    form.checkedAt.value = plusMinutes(state.visit.checkIn.at, action === 'duration-short' ? 3 : 20);
  }
});

document.body.addEventListener('change', (event) => {
  if (event.target.id === 'status-filter') {
    state.statusFilter = event.target.value;
    render();
  }
  if (event.target.id === 'compliance-filter') {
    state.complianceFilter = event.target.value;
    render();
  }
  if (event.target.id === 'hospital') onHospitalChange(event.target);
  if (event.target.id === 'department') onDepartmentChange(event.target);
  if (event.target.id === 'month') showDashboard(event.target.value);
});

document.body.addEventListener('input', (event) => {
  if (event.target.matches('[data-preview]')) updatePreview();
});

document.body.addEventListener('submit', async (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  event.preventDefault();
  if (form.dataset.busy === '1') return;
  form.dataset.busy = '1';
  clearInlineError();
  try {
    if (form.dataset.form === 'create') await submitCreate(form);
    if (form.dataset.form === 'check-in' || form.dataset.form === 'check-out') await submitCheck(form);
    if (form.dataset.form === 'report') await submitReport(form);
  } catch (error) {
    showInlineError(error.message);
  } finally {
    form.dataset.busy = '';
  }
});

async function boot() {
  state.meta = await api('/api/meta');
  const note = document.querySelector('#rule-note');
  if (note) note.textContent = ruleSentence(state.meta.rules);
  await showList();
}

boot().catch((error) => {
  document.querySelector('#main').innerHTML = `<p class="form-error">${esc(error.message)}</p>`;
});
