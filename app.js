/* global API_URL */

const SUGGEST = {
  C: ['นาย', 'นาง', 'นางสาว', 'ว่าที่ร้อยตรี', 'ว่าที่ร้อยตรีหญิง'],
  G: ['ต่ำกว่าปริญญาตรี', 'ปริญญาตรี', 'ประกาศนียบัตรบัณฑิต', 'ปริญญาโท', 'ปริญญาเอก'],
  J: ['ต่ำกว่าปริญญาตรี', 'ปริญญาตรี', 'ประกาศนียบัตรบัณฑิต', 'ปริญญาโท', 'ปริญญาเอก']
};
// จัดกลุ่มฟิลด์ที่แก้ไขได้ให้เป็นหมวดหมู่ที่มีความหมาย แทนการอ้างอิงคอลัมน์ตรงๆ
const FORM_SECTIONS = [
  { title: '👤 ชื่อและตำแหน่ง', keys: ['C', 'D', 'E', 'F'] },
  { title: '🎓 วุฒิการศึกษาที่บรรจุ', keys: ['G', 'H', 'I'] },
  { title: '📜 วุฒิการศึกษาสูงสุด', keys: ['J', 'K'] }
];
// ฟิลด์ที่มักมีข้อความยาว ให้ขยายเต็มความกว้างอัตโนมัติ
const FULL_WIDTH_KEYS = ['H', 'I', 'K'];
const PHONE_STORAGE_KEY = 'audit_system_phone';
const PHONE_PATTERN = /^[0-9]{10}$/;

const state = {
  phone: '',
  groups: [],
  selectedGroup: null,
  items: [],
  record: null
};

// ---------------- เข้าสู่ระบบด้วยเบอร์โทร ----------------

window.addEventListener('DOMContentLoaded', function () {
  bindGlobalEvents();
  const savedPhone = localStorage.getItem(PHONE_STORAGE_KEY);
  if (savedPhone && PHONE_PATTERN.test(savedPhone)) {
    enterApp(savedPhone);
  }
});

function handlePhoneSubmit(e) {
  e.preventDefault();
  const input = document.getElementById('phoneInput');
  const value = input.value.trim();
  if (!PHONE_PATTERN.test(value)) {
    showLoginError('กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง (ตัวเลข 10 หลักเท่านั้น)');
    return;
  }
  showLoginError('');
  localStorage.setItem(PHONE_STORAGE_KEY, value);
  enterApp(value);
}

function enterApp(phone) {
  state.phone = phone;
  document.getElementById('userPhone').textContent = phone;
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  loadGroups();
}

function showLoginError(msg) {
  document.getElementById('loginNote').textContent = msg;
}

function signOut() {
  state.phone = '';
  localStorage.removeItem(PHONE_STORAGE_KEY);
  document.getElementById('phoneInput').value = '';
  document.getElementById('app').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
}

// ---------------- เรียก API (Apps Script) ----------------

async function apiGet(action, params) {
  const url = new URL(API_URL);
  url.searchParams.set('action', action);
  Object.keys(params || {}).forEach(function (k) { url.searchParams.set(k, params[k]); });
  const res = await fetch(url.toString(), { method: 'GET' });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'เกิดข้อผิดพลาด');
  return json.data;
}

async function apiPost(action, params) {
  const body = JSON.stringify(Object.assign({ action: action }, params));
  // ใช้ text/plain เพื่อให้เป็น "simple request" ไม่ต้องทำ CORS preflight (Apps Script ไม่รองรับ OPTIONS)
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: body
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'เกิดข้อผิดพลาด');
  return json.data;
}

// ---------------- Event bindings ----------------

function bindGlobalEvents() {
  document.getElementById('phoneForm').addEventListener('submit', handlePhoneSubmit);
  document.getElementById('phoneInput').addEventListener('input', function (e) {
    e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
  });
  document.getElementById('btnSignOut').addEventListener('click', signOut);
  document.querySelectorAll('.btn-back').forEach(function (btn) {
    btn.addEventListener('click', function () { goToStep(Number(btn.dataset.back)); });
  });
  document.getElementById('groupSearch').addEventListener('input', function (e) {
    renderGroups(filterGroups(e.target.value));
  });
  document.getElementById('itemSearch').addEventListener('input', function (e) {
    renderItems(filterItems(e.target.value));
  });
  document.getElementById('btnSave').addEventListener('click', handleSave);
  document.getElementById('btnReset').addEventListener('click', function () {
    renderEditForm(state.record);
    showToast('เรียกคืนค่าข้อมูลเดิมเรียบร้อย', 'success');
  });
  document.getElementById('btnHistory').addEventListener('click', openHistory);
  document.getElementById('closeHistory').addEventListener('click', closeHistory);
  document.getElementById('historyModal').addEventListener('click', function (e) {
    if (e.target.id === 'historyModal') closeHistory();
  });
}

// ---------------- STEP 1: กลุ่มสาระฯ/ฝ่ายงาน ----------------

async function loadGroups() {
  try {
    state.groups = await apiGet('getGroups');
    renderGroups(state.groups);
  } catch (err) { handleError(err); }
}

function filterGroups(term) {
  term = (term || '').trim().toLowerCase();
  if (!term) return state.groups;
  return state.groups.filter(function (g) { return g.name.toLowerCase().indexOf(term) !== -1; });
}

function renderGroups(groups) {
  const grid = document.getElementById('groupGrid');
  if (!groups || groups.length === 0) {
    grid.innerHTML = '<p class="empty-state">ไม่พบข้อมูลกลุ่มสาระฯ/ฝ่ายงาน</p>';
    return;
  }
  grid.innerHTML = '';
  groups.forEach(function (g) {
    const card = document.createElement('div');
    card.className = 'group-card';
    card.innerHTML = '<div class="g-name">' + escapeHtml(g.name) + '</div>' +
      '<div class="g-count">' + g.count + ' รายการ</div>';
    card.addEventListener('click', function () { selectGroup(g.name); });
    grid.appendChild(card);
  });
}

async function selectGroup(name) {
  state.selectedGroup = name;
  document.getElementById('selectedGroupTitle').textContent = 'รายชื่อ: ' + name;
  document.getElementById('itemSearch').value = '';
  goToStep(2);
  document.getElementById('itemList').innerHTML = '<div class="skeleton-row"></div>';
  try {
    state.items = await apiGet('getItemsByGroup', { group: name });
    renderItems(state.items);
  } catch (err) { handleError(err); }
}

// ---------------- STEP 2: รายชื่อบุคลากร ----------------

function filterItems(term) {
  term = (term || '').trim().toLowerCase();
  if (!term) return state.items;
  return state.items.filter(function (it) {
    const full = (it.prefix + it.firstName + it.lastName + it.order).toLowerCase();
    return full.indexOf(term) !== -1;
  });
}

function renderItems(items) {
  const list = document.getElementById('itemList');
  if (!items || items.length === 0) {
    list.innerHTML = '<p class="empty-state">ไม่พบรายชื่อในกลุ่มนี้</p>';
    return;
  }
  list.innerHTML = '';
  items.forEach(function (it) {
    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML =
      '<span class="item-order">' + escapeHtml(String(it.order)) + '</span>' +
      '<span class="item-name">' + escapeHtml(it.prefix + it.firstName + ' ' + it.lastName) + '</span>' +
      '<span class="item-arrow">→</span>';
    row.addEventListener('click', function () { selectItem(it.row); });
    list.appendChild(row);
  });
}

async function selectItem(row) {
  goToStep(3);
  document.getElementById('editForm').innerHTML = '<div class="skeleton-row"></div>';
  try {
    state.record = await apiGet('getRecord', { row: row });
    renderRecord(state.record);
  } catch (err) { handleError(err); }
}

// ---------------- STEP 3: ตรวจสอบ/แก้ไข ----------------

function renderRecord(record) {
  const byKey = {};
  record.fields.forEach(function (f) { byKey[f.key] = f; });
  document.getElementById('recordSummary').innerHTML =
    '<div><b>' + escapeHtml(byKey.A.header) + ':</b> ' + escapeHtml(byKey.A.value) + '</div>' +
    '<div><b>' + escapeHtml(byKey.B.header) + ':</b> ' + escapeHtml(String(byKey.B.value)) + '</div>' +
    '<div><b>ชื่อ-สกุล:</b> ' + escapeHtml([byKey.C.value, byKey.D.value, byKey.E.value].filter(Boolean).join(' ')) + '</div>';
  renderEditForm(record);
}

function renderEditForm(record) {
  const form = document.getElementById('editForm');
  form.innerHTML = '';
  const byKey = {};
  record.fields.forEach(function (f) { byKey[f.key] = f; });

  FORM_SECTIONS.forEach(function (section) {
    const sectionEl = document.createElement('div');
    sectionEl.className = 'field-section';

    const titleEl = document.createElement('div');
    titleEl.className = 'field-section-title';
    titleEl.textContent = section.title;
    sectionEl.appendChild(titleEl);

    const gridEl = document.createElement('div');
    gridEl.className = 'field-section-grid';

    section.keys.forEach(function (key) {
      const f = byKey[key];
      if (!f) return;
      gridEl.appendChild(buildField_(f));
    });

    sectionEl.appendChild(gridEl);
    form.appendChild(sectionEl);
  });

  updateSaveHint();
}

function buildField_(f) {
  const wrap = document.createElement('div');
  wrap.className = 'field' + (FULL_WIDTH_KEYS.indexOf(f.key) !== -1 ? ' full' : '');
  wrap.dataset.key = f.key;

  const label = document.createElement('label');
  label.textContent = f.header;
  wrap.appendChild(label);

  const input = document.createElement('input');
  input.type = 'text';
  if (SUGGEST[f.key]) {
    const listId = 'list-' + f.key;
    input.setAttribute('list', listId);
    const dl = document.createElement('datalist');
    dl.id = listId;
    SUGGEST[f.key].forEach(function (opt) {
      const o = document.createElement('option');
      o.value = opt;
      dl.appendChild(o);
    });
    wrap.appendChild(dl);
  }
  input.value = f.value === null || f.value === undefined ? '' : f.value;
  input.dataset.original = input.value;
  input.addEventListener('input', function () {
    wrap.classList.toggle('changed', input.value !== input.dataset.original);
    updateSaveHint();
  });
  wrap.appendChild(input);
  return wrap;
}

function updateSaveHint() {
  const changed = document.querySelectorAll('#editForm .field.changed').length;
  const hint = document.getElementById('saveHint');
  hint.textContent = changed > 0
    ? 'มีการแก้ไข ' + changed + ' รายการ — ระบบจะบันทึกทับข้อมูลเดิมและเก็บประวัติอัตโนมัติ'
    : '';
}

async function handleSave() {
  const fields = document.querySelectorAll('#editForm .field');
  const newValues = {};
  fields.forEach(function (wrap) {
    newValues[wrap.dataset.key] = wrap.querySelector('input').value;
  });

  const btn = document.getElementById('btnSave');
  btn.disabled = true;
  btn.textContent = 'กำลังบันทึก...';

  try {
    const result = await apiPost('updateRecord', {
      row: state.record.row,
      newValues: JSON.stringify(newValues),
      phone: state.phone
    });
    if (result.changed === 0) {
      showToast('ไม่มีข้อมูลที่เปลี่ยนแปลง', 'error');
    } else {
      showToast('บันทึกสำเร็จ (' + result.changed + ' รายการ) โดยเบอร์ ' + result.phone, 'success');
      state.record = await apiGet('getRecord', { row: state.record.row });
      renderRecord(state.record);
    }
  } catch (err) {
    handleError(err);
  } finally {
    btn.disabled = false;
    btn.textContent = 'บันทึกทับข้อมูล';
  }
}

// ---------------- ประวัติการแก้ไข ----------------

async function openHistory() {
  const modal = document.getElementById('historyModal');
  const body = document.getElementById('historyBody');
  body.innerHTML = '<p class="empty-state">กำลังโหลดข้อมูล...</p>';
  modal.classList.remove('hidden');

  const byKey = {};
  state.record.fields.forEach(function (f) { byKey[f.key] = f; });

  try {
    const history = await apiGet('getHistory', { group: byKey.A.value, order: byKey.B.value });
    renderHistory(history);
  } catch (err) { handleError(err); }
}

function renderHistory(history) {
  const body = document.getElementById('historyBody');
  if (!history || history.length === 0) {
    body.innerHTML = '<p class="empty-state">ยังไม่มีประวัติการแก้ไขสำหรับรายการนี้</p>';
    return;
  }
  body.innerHTML = '';
  history.forEach(function (h) {
    const div = document.createElement('div');
    div.className = 'history-item';
    div.innerHTML =
      '<div class="h-top"><span>🕘 ' + escapeHtml(h.datetime) + '</span><span>📱 ' + escapeHtml(h.phone) + '</span></div>' +
      '<div class="h-field">' + escapeHtml(h.header) + '</div>' +
      '<div class="h-change"><span class="h-old">' + escapeHtml(String(h.oldValue) || '(ว่าง)') + '</span> → ' +
      '<span class="h-new">' + escapeHtml(String(h.newValue) || '(ว่าง)') + '</span></div>';
    body.appendChild(div);
  });
}

function closeHistory() {
  document.getElementById('historyModal').classList.add('hidden');
}

// ---------------- นำทาง / ยูทิลิตี้ ----------------

function goToStep(stepNum) {
  [1, 2, 3].forEach(function (n) {
    document.getElementById('panel-' + n).classList.toggle('hidden', n !== stepNum);
    const stepEl = document.querySelector('.step[data-step="' + n + '"]');
    stepEl.classList.toggle('active', n === stepNum);
    stepEl.classList.toggle('done', n < stepNum);
  });
}

function showToast(msg, type) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(function () { toast.className = 'toast'; }, 3800);
}

function handleError(err) {
  console.error(err);
  showToast('เกิดข้อผิดพลาด: ' + (err && err.message ? err.message : err), 'error');
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
