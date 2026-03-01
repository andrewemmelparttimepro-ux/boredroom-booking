// BoredRoom Booking — Dashboard
const API = window.location.origin + '/api';
const TOKEN = localStorage.getItem('bb_token');
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ── Auth Guard ──
if (!TOKEN) window.location.href = '/';

function authHeaders() {
  return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN };
}

async function apiFetch(path, opts = {}) {
  opts.headers = { ...authHeaders(), ...opts.headers };
  const res = await fetch(API + path, opts);
  if (res.status === 401) { logout(); return null; }
  return res;
}

function logout() {
  localStorage.removeItem('bb_token');
  localStorage.removeItem('bb_user');
  localStorage.removeItem('bb_business');
  window.location.href = '/';
}

// ── Toast ──
function toast(msg, type = 'success') {
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// ── Page Navigation ──
function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  document.getElementById('page-' + page).classList.remove('hidden');
  document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
  document.querySelector(`[data-page="${page}"]`).classList.add('active');

  if (page === 'services') loadServices();
  else if (page === 'staff') loadStaff();
  else if (page === 'clients') loadClients();
  else if (page === 'settings') loadSettings();
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

// ── Init ──
async function init() {
  try {
    const res = await apiFetch('/auth/me');
    if (!res) return;
    const data = await res.json();
    document.getElementById('userName').textContent = data.user.name;
    document.getElementById('userRole').textContent = data.user.role;
    document.getElementById('userAvatar').textContent = data.user.name.charAt(0).toUpperCase();
    localStorage.setItem('bb_user', JSON.stringify(data.user));
    localStorage.setItem('bb_business', JSON.stringify(data.business));
  } catch (e) {
    console.error('Init error:', e);
  }
}

// ═══════════════════════════════════════════
// SERVICES
// ═══════════════════════════════════════════
let servicesCache = [];

async function loadServices() {
  const res = await apiFetch('/services');
  if (!res) return;
  servicesCache = await res.json();
  renderServicesTable();
}

function renderServicesTable() {
  const tbody = document.getElementById('servicesTableBody');
  if (servicesCache.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">
      <h3>No services yet</h3>
      <p>Add your first service or import starter barbershop services.</p>
    </div></td></tr>`;
    document.getElementById('seedServicesBtn').classList.remove('hidden');
    return;
  }
  document.getElementById('seedServicesBtn').classList.add('hidden');

  tbody.innerHTML = servicesCache.map(s => `
    <tr>
      <td>
        <div class="flex items-center gap-2">
          <span style="width:10px;height:10px;border-radius:50%;background:${s.color || '#8CC63F'};display:inline-block;flex-shrink:0;"></span>
          <strong>${esc(s.name)}</strong>
          ${s.is_popular ? '<span class="badge badge-gold">Popular</span>' : ''}
        </div>
      </td>
      <td class="text-muted">${esc(s.category || '—')}</td>
      <td>${s.duration_minutes}min${s.buffer_minutes > 0 ? ' +' + s.buffer_minutes : ''}</td>
      <td>${s.price != null ? '$' + Number(s.price).toFixed(2) : '—'}</td>
      <td><span class="badge ${s.is_active ? 'badge-active' : 'badge-inactive'}">${s.is_active ? 'Active' : 'Inactive'}</span></td>
      <td style="text-align:right;">
        <button class="btn-icon" title="Edit" onclick="editService('${s.id}')">✎</button>
        <button class="btn-icon" title="Toggle" onclick="toggleService('${s.id}', ${!s.is_active})">⏻</button>
      </td>
    </tr>
  `).join('');
}

function openServiceModal(svc = null) {
  document.getElementById('serviceModalTitle').textContent = svc ? 'Edit Service' : 'Add Service';
  document.getElementById('svcEditId').value = svc ? svc.id : '';
  document.getElementById('svcName').value = svc ? svc.name : '';
  document.getElementById('svcCategory').value = svc ? (svc.category || '') : '';
  document.getElementById('svcDuration').value = svc ? svc.duration_minutes : 30;
  document.getElementById('svcBuffer').value = svc ? (svc.buffer_minutes || 0) : 0;
  document.getElementById('svcPrice').value = svc ? (svc.price || '') : '';
  document.getElementById('svcColor').value = svc ? (svc.color || '#8CC63F') : '#8CC63F';
  document.getElementById('svcDescription').value = svc ? (svc.description || '') : '';
  document.getElementById('svcPopular').checked = svc ? svc.is_popular : false;
  document.getElementById('serviceModal').classList.add('active');
}

function editService(id) {
  const svc = servicesCache.find(s => s.id === id);
  if (svc) openServiceModal(svc);
}

async function saveService() {
  const id = document.getElementById('svcEditId').value;
  const body = {
    name: document.getElementById('svcName').value.trim(),
    category: document.getElementById('svcCategory').value.trim() || null,
    duration_minutes: parseInt(document.getElementById('svcDuration').value),
    buffer_minutes: parseInt(document.getElementById('svcBuffer').value) || 0,
    price: parseFloat(document.getElementById('svcPrice').value) || null,
    color: document.getElementById('svcColor').value,
    description: document.getElementById('svcDescription').value.trim() || null,
    is_popular: document.getElementById('svcPopular').checked,
  };

  if (!body.name || !body.duration_minutes) { toast('Name and duration are required', 'error'); return; }

  const res = await apiFetch(id ? `/services/${id}` : '/services', {
    method: id ? 'PATCH' : 'POST',
    body: JSON.stringify(body),
  });
  if (!res || !res.ok) { toast('Failed to save service', 'error'); return; }
  toast(id ? 'Service updated' : 'Service created');
  closeModal('serviceModal');
  loadServices();
}

async function toggleService(id, isActive) {
  await apiFetch(`/services/${id}`, { method: 'PATCH', body: JSON.stringify({ is_active: isActive }) });
  loadServices();
}

async function seedServices() {
  const res = await apiFetch('/services/seed', { method: 'POST' });
  if (!res) return;
  if (res.ok) { toast('Starter services imported!'); loadServices(); }
  else { const d = await res.json(); toast(d.error || 'Seed failed', 'error'); }
}

// ═══════════════════════════════════════════
// STAFF
// ═══════════════════════════════════════════
let staffCache = [];

async function loadStaff() {
  const res = await apiFetch('/staff');
  if (!res) return;
  staffCache = await res.json();
  renderStaffGrid();
}

function renderStaffGrid() {
  const grid = document.getElementById('staffGrid');
  if (staffCache.length === 0) {
    grid.innerHTML = `<div class="card" style="grid-column:1/-1;"><div class="empty-state">
      <h3>No staff yet</h3><p>Add your first team member to start scheduling.</p>
    </div></div>`;
    return;
  }

  grid.innerHTML = staffCache.map(s => {
    const initials = s.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const svcBadges = (s.services || []).map(sv =>
      `<span class="badge badge-gold">${esc(sv.service_name)}</span>`
    ).join('');

    return `
    <div class="staff-card">
      <div class="staff-card-header">
        ${s.photo_url
          ? `<img src="${esc(s.photo_url)}" class="staff-avatar" style="object-fit:cover;" alt="${esc(s.name)}">`
          : `<div class="staff-avatar">${initials}</div>`
        }
        <div class="staff-card-info">
          <h3>${esc(s.name)}</h3>
          <span>${esc(s.role || 'Staff')}</span>
        </div>
        <span class="badge ${s.is_active ? 'badge-active' : 'badge-inactive'}">${s.is_active ? 'Active' : 'Inactive'}</span>
      </div>
      ${s.email ? `<div class="text-sm text-muted" style="margin-bottom:4px;">${esc(s.email)}</div>` : ''}
      ${s.phone ? `<div class="text-sm text-muted">${esc(s.phone)}</div>` : ''}
      ${svcBadges ? `<div class="staff-card-services">${svcBadges}</div>` : ''}
      <div class="staff-card-actions">
        <button class="btn btn-secondary btn-sm" onclick="editStaff('${s.id}')">Edit</button>
        <button class="btn btn-secondary btn-sm" onclick="toggleStaffActive('${s.id}', ${!s.is_active})">
          ${s.is_active ? 'Deactivate' : 'Activate'}
        </button>
      </div>
    </div>`;
  }).join('');
}

async function openStaffModal(staff = null) {
  document.getElementById('staffModalTitle').textContent = staff ? 'Edit Staff Member' : 'Add Staff Member';
  document.getElementById('staffEditId').value = staff ? staff.id : '';
  document.getElementById('staffName').value = staff ? staff.name : '';
  document.getElementById('staffEmail').value = staff ? (staff.email || '') : '';
  document.getElementById('staffPhone').value = staff ? (staff.phone || '') : '';
  document.getElementById('staffRole').value = staff ? (staff.role || 'staff') : 'staff';
  document.getElementById('staffPhoto').value = staff ? (staff.photo_url || '') : '';

  // Load availability
  const hoursGrid = document.getElementById('staffHoursGrid');
  let availability = [];
  if (staff) {
    const res = await apiFetch(`/staff/${staff.id}/availability`);
    if (res && res.ok) availability = await res.json();
  }

  hoursGrid.innerHTML = DAY_NAMES.map((day, i) => {
    const a = availability.find(x => x.day_of_week === i) || { is_working: i !== 0, start_time: '09:00', end_time: '17:00' };
    return `
      <div class="hours-row">
        <span class="day-label">${day.slice(0, 3)}</span>
        <label class="toggle"><input type="checkbox" data-staff-day="${i}" ${a.is_working ? 'checked' : ''}><span class="toggle-slider"></span></label>
        <input type="time" data-staff-start="${i}" value="${a.start_time ? a.start_time.slice(0, 5) : '09:00'}">
        <input type="time" data-staff-end="${i}" value="${a.end_time ? a.end_time.slice(0, 5) : '17:00'}">
      </div>`;
  }).join('');

  // Load services checklist
  if (servicesCache.length === 0) {
    const svcRes = await apiFetch('/services');
    if (svcRes && svcRes.ok) servicesCache = await svcRes.json();
  }

  let staffServiceIds = [];
  if (staff) {
    const ssRes = await apiFetch(`/staff/${staff.id}/services`);
    if (ssRes && ssRes.ok) {
      const ssData = await ssRes.json();
      staffServiceIds = ssData.map(s => s.id);
    }
  }

  document.getElementById('staffServicesChecklist').innerHTML = servicesCache.filter(s => s.is_active).map(s => `
    <label style="display:flex;align-items:center;gap:6px;background:var(--bg-input);padding:6px 12px;border-radius:6px;font-size:12px;cursor:pointer;">
      <input type="checkbox" data-staff-svc="${s.id}" ${staffServiceIds.includes(s.id) ? 'checked' : ''}>
      ${esc(s.name)}
    </label>
  `).join('') || '<span class="text-muted text-sm">No active services. Create services first.</span>';

  document.getElementById('staffModal').classList.add('active');
}

async function editStaff(id) {
  const s = staffCache.find(x => x.id === id);
  if (s) openStaffModal(s);
}

async function saveStaff() {
  const id = document.getElementById('staffEditId').value;
  const body = {
    name: document.getElementById('staffName').value.trim(),
    email: document.getElementById('staffEmail').value.trim() || null,
    phone: document.getElementById('staffPhone').value.trim() || null,
    role: document.getElementById('staffRole').value.trim() || 'staff',
    photo_url: document.getElementById('staffPhoto').value.trim() || null,
  };

  if (!body.name) { toast('Name is required', 'error'); return; }

  // Save basic info
  const res = await apiFetch(id ? `/staff/${id}` : '/staff', {
    method: id ? 'PATCH' : 'POST',
    body: JSON.stringify(body),
  });
  if (!res || !res.ok) { toast('Failed to save staff', 'error'); return; }
  const staffData = await res.json();
  const staffId = staffData.id;

  // Save availability
  const availability = DAY_NAMES.map((_, i) => ({
    dayOfWeek: i,
    isWorking: document.querySelector(`[data-staff-day="${i}"]`)?.checked || false,
    startTime: document.querySelector(`[data-staff-start="${i}"]`)?.value || '09:00',
    endTime: document.querySelector(`[data-staff-end="${i}"]`)?.value || '17:00',
  }));
  await apiFetch(`/staff/${staffId}/availability`, {
    method: 'PUT',
    body: JSON.stringify({ availability }),
  });

  // Save services
  const serviceIds = [];
  document.querySelectorAll('[data-staff-svc]').forEach(el => {
    if (el.checked) serviceIds.push(el.dataset.staffSvc);
  });
  await apiFetch(`/staff/${staffId}/services`, {
    method: 'PUT',
    body: JSON.stringify({ serviceIds }),
  });

  toast(id ? 'Staff updated' : 'Staff member added');
  closeModal('staffModal');
  loadStaff();
}

async function toggleStaffActive(id, isActive) {
  await apiFetch(`/staff/${id}`, { method: 'PATCH', body: JSON.stringify({ is_active: isActive }) });
  loadStaff();
}

// ═══════════════════════════════════════════
// CLIENTS
// ═══════════════════════════════════════════
let clientsCache = [];

async function loadClients() {
  const res = await apiFetch('/clients');
  if (!res) return;
  clientsCache = await res.json();
  renderClientsTable();
}

function renderClientsTable() {
  const tbody = document.getElementById('clientsTableBody');
  if (clientsCache.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state">
      <h3>No clients yet</h3><p>Clients will appear here when they book or you add them.</p>
    </div></td></tr>`;
    return;
  }

  tbody.innerHTML = clientsCache.map(c => `
    <tr>
      <td><strong>${esc(c.name)}</strong></td>
      <td class="text-muted">${esc(c.email || '—')}</td>
      <td class="text-muted">${esc(c.phone || '—')}</td>
      <td>${c.no_show_count > 0 ? `<span class="badge badge-inactive">${c.no_show_count}</span>` : '0'}</td>
      <td style="text-align:right;">
        <button class="btn-icon" title="Edit" onclick="editClient('${c.id}')">✎</button>
        <button class="btn-icon" title="Delete" onclick="deleteClient('${c.id}')">✕</button>
      </td>
    </tr>
  `).join('');
}

function openClientModal(client = null) {
  document.getElementById('clientModalTitle').textContent = client ? 'Edit Client' : 'Add Client';
  document.getElementById('clientEditId').value = client ? client.id : '';
  document.getElementById('clientName').value = client ? client.name : '';
  document.getElementById('clientEmail').value = client ? (client.email || '') : '';
  document.getElementById('clientPhone').value = client ? (client.phone || '') : '';
  document.getElementById('clientNotes').value = client ? (client.notes || '') : '';
  document.getElementById('clientModal').classList.add('active');
}

function editClient(id) {
  const c = clientsCache.find(x => x.id === id);
  if (c) openClientModal(c);
}

async function saveClient() {
  const id = document.getElementById('clientEditId').value;
  const body = {
    name: document.getElementById('clientName').value.trim(),
    email: document.getElementById('clientEmail').value.trim() || null,
    phone: document.getElementById('clientPhone').value.trim() || null,
    notes: document.getElementById('clientNotes').value.trim() || null,
  };

  if (!body.name) { toast('Name is required', 'error'); return; }

  const res = await apiFetch(id ? `/clients/${id}` : '/clients', {
    method: id ? 'PATCH' : 'POST',
    body: JSON.stringify(body),
  });
  if (!res || !res.ok) { toast('Failed to save client', 'error'); return; }
  toast(id ? 'Client updated' : 'Client added');
  closeModal('clientModal');
  loadClients();
}

async function deleteClient(id) {
  if (!confirm('Delete this client?')) return;
  await apiFetch(`/clients/${id}`, { method: 'DELETE' });
  loadClients();
}

// ═══════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════
async function loadSettings() {
  // Business profile
  const bizRes = await apiFetch('/business');
  if (bizRes && bizRes.ok) {
    const biz = await bizRes.json();
    document.getElementById('bizName').value = biz.name || '';
    document.getElementById('bizSlug').value = biz.slug || '';
    document.getElementById('bizEmail').value = biz.email || '';
    document.getElementById('bizPhone').value = biz.phone || '';
    document.getElementById('bizAddress').value = biz.address || '';
    document.getElementById('bizTimezone').value = biz.timezone || 'America/Chicago';
    document.getElementById('bizBrandColor').value = biz.brand_color || '#8CC63F';
    document.getElementById('bizLogo').value = biz.logo_url || '';
  }

  // Business hours
  const hoursRes = await apiFetch('/business/hours');
  if (hoursRes && hoursRes.ok) {
    const hours = await hoursRes.json();
    const grid = document.getElementById('hoursGrid');
    grid.innerHTML = DAY_NAMES.map((day, i) => {
      const h = hours.find(x => x.day_of_week === i) || { is_open: false, open_time: '09:00', close_time: '17:00' };
      return `
        <div class="hours-row">
          <span class="day-label">${day.slice(0, 3)}</span>
          <label class="toggle"><input type="checkbox" data-biz-day="${i}" ${h.is_open ? 'checked' : ''}><span class="toggle-slider"></span></label>
          <input type="time" data-biz-start="${i}" value="${h.open_time ? h.open_time.slice(0, 5) : '09:00'}">
          <input type="time" data-biz-end="${i}" value="${h.close_time ? h.close_time.slice(0, 5) : '17:00'}">
        </div>`;
    }).join('');
  }
}

async function saveBusiness() {
  const body = {
    name: document.getElementById('bizName').value.trim(),
    slug: document.getElementById('bizSlug').value.trim(),
    email: document.getElementById('bizEmail').value.trim() || null,
    phone: document.getElementById('bizPhone').value.trim() || null,
    address: document.getElementById('bizAddress').value.trim() || null,
    timezone: document.getElementById('bizTimezone').value,
    brand_color: document.getElementById('bizBrandColor').value,
    logo_url: document.getElementById('bizLogo').value.trim() || null,
  };

  const res = await apiFetch('/business', { method: 'PATCH', body: JSON.stringify(body) });
  if (res && res.ok) toast('Business profile saved');
  else toast('Failed to save profile', 'error');
}

async function saveHours() {
  const hours = DAY_NAMES.map((_, i) => ({
    dayOfWeek: i,
    isOpen: document.querySelector(`[data-biz-day="${i}"]`)?.checked || false,
    openTime: document.querySelector(`[data-biz-start="${i}"]`)?.value || '09:00',
    closeTime: document.querySelector(`[data-biz-end="${i}"]`)?.value || '17:00',
  }));

  const res = await apiFetch('/business/hours', { method: 'PUT', body: JSON.stringify({ hours }) });
  if (res && res.ok) toast('Business hours saved');
  else toast('Failed to save hours', 'error');
}

// ── Utility ──
function esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ═══════════════════════════════════════════
// CALENDAR
// ═══════════════════════════════════════════
let calDate = new Date();
let calView = 'day';
let calAppointments = [];

function formatDateStr(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function calToday() { calDate = new Date(); loadCalendar(); }
function calPrev() {
  if (calView === 'day') calDate.setDate(calDate.getDate() - 1);
  else calDate.setDate(calDate.getDate() - 7);
  loadCalendar();
}
function calNext() {
  if (calView === 'day') calDate.setDate(calDate.getDate() + 1);
  else calDate.setDate(calDate.getDate() + 7);
  loadCalendar();
}
function calGoToDate(dateStr) {
  calDate = new Date(dateStr + 'T12:00:00');
  loadCalendar();
}
function calSwitchView(view) {
  calView = view;
  loadCalendar();
}

async function loadCalendar() {
  const dateStr = formatDateStr(calDate);
  document.getElementById('calDatePicker').value = dateStr;

  if (calView === 'day') {
    document.getElementById('calDayView').classList.remove('hidden');
    document.getElementById('calWeekView').classList.add('hidden');
    document.getElementById('calendarDateLabel').textContent =
      calDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    await loadDayView(dateStr);
  } else {
    document.getElementById('calDayView').classList.add('hidden');
    document.getElementById('calWeekView').classList.remove('hidden');
    document.getElementById('calendarDateLabel').textContent = 'Week of ' +
      calDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    await loadWeekView();
  }
}

async function loadDayView(dateStr) {
  // Load staff
  if (staffCache.length === 0) {
    const sr = await apiFetch('/staff');
    if (sr && sr.ok) staffCache = await sr.json();
  }
  const activeStaff = staffCache.filter(s => s.is_active);

  // Load appointments
  const res = await apiFetch(`/appointments?date=${dateStr}`);
  if (!res || !res.ok) return;
  calAppointments = await res.json();

  const grid = document.getElementById('calDayGrid');
  const START_HOUR = 6;
  const END_HOUR = 21;
  const HOURS = END_HOUR - START_HOUR;
  const HOUR_HEIGHT = 60;

  if (activeStaff.length === 0) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><h3>No active staff</h3><p>Add staff members to see the calendar.</p></div>';
    return;
  }

  // Build time column
  let timeColHtml = '<div class="cal-time-col">';
  for (let h = START_HOUR; h <= END_HOUR; h++) {
    const label = h === 0 ? '12 AM' : h < 12 ? h + ' AM' : h === 12 ? '12 PM' : (h - 12) + ' PM';
    timeColHtml += `<div class="cal-time-label" style="height:${HOUR_HEIGHT}px;">${label}</div>`;
  }
  timeColHtml += '</div>';

  // Build staff columns
  const colCount = activeStaff.length;
  let headerHtml = `<div class="cal-staff-header" style="grid-template-columns:repeat(${colCount},1fr);">`;
  activeStaff.forEach(s => {
    headerHtml += `<div class="cal-staff-header-cell">${esc(s.name)}</div>`;
  });
  headerHtml += '</div>';

  let colsHtml = `<div class="cal-staff-cols" style="grid-template-columns:repeat(${colCount},1fr);height:${HOURS * HOUR_HEIGHT}px;">`;

  activeStaff.forEach((staff, colIdx) => {
    colsHtml += '<div class="cal-staff-col">';

    // Hour lines
    for (let h = 0; h <= HOURS; h++) {
      colsHtml += `<div class="cal-hour-line" style="top:${h * HOUR_HEIGHT}px;"></div>`;
      if (h < HOURS) {
        colsHtml += `<div class="cal-hour-line cal-half-line" style="top:${h * HOUR_HEIGHT + 30}px;"></div>`;
      }
    }

    // Appointments for this staff
    const staffAppts = calAppointments.filter(a => a.staff_id === staff.id);
    staffAppts.forEach(a => {
      const start = new Date(a.start_time);
      const end = new Date(a.end_time);
      const startMin = start.getUTCHours() * 60 + start.getUTCMinutes();
      const endMin = end.getUTCHours() * 60 + end.getUTCMinutes();
      const top = ((startMin - START_HOUR * 60) / 60) * HOUR_HEIGHT;
      const height = ((endMin - startMin) / 60) * HOUR_HEIGHT;
      const color = a.service_color || '#B8AA96';

      const isBlocked = a.status === 'blocked';
      const timeStr = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' });

      colsHtml += `
        <div class="cal-appt-block ${isBlocked ? 'status-blocked' : ''}"
             style="top:${top}px;height:${Math.max(height, 24)}px;background:${isBlocked ? '' : color + '22'};border-left-color:${color};color:${isBlocked ? 'var(--text-muted)' : 'var(--text-primary)'};"
             onclick="showApptDetail('${a.id}')">
          <div class="appt-time">${timeStr}</div>
          <div class="appt-client">${isBlocked ? (a.notes || 'Blocked') : esc(a.client_name || 'Walk-in')}</div>
          <div class="appt-service">${esc(a.service_name || '')}</div>
        </div>`;
    });

    colsHtml += '</div>';
  });
  colsHtml += '</div>';

  grid.innerHTML = timeColHtml + '<div>' + headerHtml + colsHtml + '</div>';
}

async function loadWeekView() {
  // Get the Monday of the current week
  const monday = new Date(calDate);
  const day = monday.getDay();
  monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1));

  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);

  const res = await apiFetch(`/appointments?start_date=${formatDateStr(monday)}&end_date=${formatDateStr(sunday)}`);
  let weekAppts = [];
  if (res && res.ok) weekAppts = await res.json();

  const grid = document.getElementById('calWeekGrid');
  const today = formatDateStr(new Date());
  let html = '';

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    const ds = formatDateStr(d);
    const isToday = ds === today;
    const dayAppts = weekAppts.filter(a => {
      const ad = new Date(a.start_time);
      return formatDateStr(ad) === ds;
    });

    html += `<div class="cal-week-day ${isToday ? 'is-today' : ''}" onclick="calDate=new Date('${ds}T12:00:00');calView='day';document.getElementById('calViewSelect').value='day';loadCalendar();">`;
    html += `<div class="cal-week-day-header">${DAY_NAMES[d.getDay()].slice(0, 3)}</div>`;
    html += `<div class="cal-week-day-date">${d.getDate()}</div>`;

    dayAppts.slice(0, 5).forEach(a => {
      const t = new Date(a.start_time);
      const timeStr = t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' });
      html += `<div class="cal-week-appt-pill">${timeStr} ${esc(a.client_name || a.notes || 'Appt')}</div>`;
    });
    if (dayAppts.length > 5) html += `<div class="text-sm text-muted">+${dayAppts.length - 5} more</div>`;
    html += '</div>';
  }

  grid.innerHTML = html;
}

// Appointment detail panel
async function showApptDetail(id) {
  const res = await apiFetch(`/appointments/${id}`);
  if (!res || !res.ok) return;
  const a = await res.json();

  document.getElementById('apptDetailPanel').classList.remove('hidden');
  document.getElementById('apptDetailTitle').textContent = a.service_name || 'Blocked Time';

  const start = new Date(a.start_time);
  const end = new Date(a.end_time);
  const dateStr = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
  const startTimeStr = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' });
  const endTimeStr = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' });

  const statusOptions = ['pending', 'confirmed', 'completed', 'no_show', 'cancelled', 'blocked']
    .map(s => `<option value="${s}" ${a.status === s ? 'selected' : ''}>${s.replace('_', ' ').toUpperCase()}</option>`)
    .join('');

  document.getElementById('apptDetailBody').innerHTML = `
    ${a.client_name ? `<div class="appt-detail-row"><label>Client</label><div class="value">${esc(a.client_name)}</div></div>` : ''}
    ${a.client_phone ? `<div class="appt-detail-row"><label>Phone</label><div class="value">${esc(a.client_phone)}</div></div>` : ''}
    ${a.client_email ? `<div class="appt-detail-row"><label>Email</label><div class="value">${esc(a.client_email)}</div></div>` : ''}
    <div class="appt-detail-row"><label>Staff</label><div class="value">${esc(a.staff_name || '—')}</div></div>
    <div class="appt-detail-row"><label>Service</label><div class="value">${esc(a.service_name || '—')}${a.service_price ? ' — $' + Number(a.service_price).toFixed(2) : ''}</div></div>
    <div class="appt-detail-row"><label>Time</label><div class="value">${dateStr} · ${startTimeStr} – ${endTimeStr}</div></div>
    <div class="appt-detail-row">
      <label>Status</label>
      <select onchange="updateApptStatus('${a.id}', this.value)" style="width:100%;">${statusOptions}</select>
    </div>
    <div class="appt-detail-row"><label>Notes</label><div class="value text-muted">${esc(a.notes || 'None')}</div></div>
    <div class="appt-detail-row"><label>Source</label><div class="value text-muted">${esc(a.source || '—')}</div></div>
    <div style="margin-top:24px;display:flex;gap:8px;">
      <button class="btn btn-danger btn-sm" onclick="cancelAppt('${a.id}')">Cancel Appt</button>
      <button class="btn btn-secondary btn-sm" onclick="deleteAppt('${a.id}')">Delete</button>
    </div>
  `;
}

function closeApptDetail() {
  document.getElementById('apptDetailPanel').classList.add('hidden');
}

async function updateApptStatus(id, status) {
  const res = await apiFetch(`/appointments/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });
  if (res && res.ok) { toast('Status updated'); loadCalendar(); }
  else { const d = await res.json().catch(() => ({})); toast(d.error || 'Update failed', 'error'); }
}

async function cancelAppt(id) {
  await updateApptStatus(id, 'cancelled');
  closeApptDetail();
}

async function deleteAppt(id) {
  if (!confirm('Permanently delete this appointment?')) return;
  await apiFetch(`/appointments/${id}`, { method: 'DELETE' });
  toast('Appointment deleted');
  closeApptDetail();
  loadCalendar();
}

// ═══════════════════════════════════════════
// NEW APPOINTMENT WIZARD
// ═══════════════════════════════════════════
let apptState = { step: 1, serviceId: null, staffId: null, date: null, time: null, clientId: null };

async function openNewAppointmentModal() {
  apptState = { step: 1, serviceId: null, staffId: null, date: null, time: null, clientId: null };

  // Load services
  if (servicesCache.length === 0) {
    const res = await apiFetch('/services');
    if (res && res.ok) servicesCache = await res.json();
  }

  const list = document.getElementById('apptServiceList');
  list.innerHTML = servicesCache.filter(s => s.is_active).map(s => `
    <div class="appt-option" onclick="selectApptService('${s.id}', this)">
      <div>
        <div class="opt-name">${esc(s.name)}</div>
        <div class="opt-detail">${s.duration_minutes}min${s.price ? ' · $' + Number(s.price).toFixed(2) : ''}</div>
      </div>
      <span style="width:10px;height:10px;border-radius:50%;background:${s.color || '#8CC63F'};"></span>
    </div>
  `).join('') || '<p class="text-muted">No active services.</p>';

  showApptStep(1);
  document.getElementById('newApptModal').classList.add('active');
}

function selectApptService(id, el) {
  apptState.serviceId = id;
  document.querySelectorAll('#apptServiceList .appt-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
}

async function loadApptStaffOptions() {
  if (staffCache.length === 0) {
    const res = await apiFetch('/staff');
    if (res && res.ok) staffCache = await res.json();
  }

  const list = document.getElementById('apptStaffList');
  const activeStaff = staffCache.filter(s => s.is_active);
  list.innerHTML = `<div class="appt-option" onclick="selectApptStaff('any', this)">
    <div><div class="opt-name">Any Available</div><div class="opt-detail">Auto-assign best available</div></div>
  </div>` + activeStaff.map(s => `
    <div class="appt-option" onclick="selectApptStaff('${s.id}', this)">
      <div>
        <div class="opt-name">${esc(s.name)}</div>
        <div class="opt-detail">${esc(s.role || 'Staff')}</div>
      </div>
    </div>
  `).join('');
}

function selectApptStaff(id, el) {
  apptState.staffId = id;
  document.querySelectorAll('#apptStaffList .appt-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
}

async function loadApptSlots() {
  const dateVal = document.getElementById('apptDate').value;
  if (!dateVal || !apptState.serviceId) return;
  apptState.date = dateVal;

  const biz = JSON.parse(localStorage.getItem('bb_business') || '{}');
  const params = new URLSearchParams({
    businessId: biz.id,
    serviceId: apptState.serviceId,
    staffId: apptState.staffId || 'any',
    date: dateVal
  });

  const res = await apiFetch(`/slots?${params}`);
  if (!res || !res.ok) return;
  const slots = await res.json();

  const grid = document.getElementById('apptSlotGrid');
  if (slots.length === 0) {
    grid.innerHTML = '<p class="text-muted">No available slots for this date.</p>';
    return;
  }

  // Deduplicate by time (show unique times, pick first available staff)
  const seen = new Map();
  slots.forEach(s => { if (!seen.has(s.time)) seen.set(s.time, s); });

  grid.innerHTML = Array.from(seen.values()).map(s => {
    const h = parseInt(s.time.split(':')[0]);
    const m = s.time.split(':')[1];
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `<div class="appt-slot" onclick="selectApptSlot('${s.time}', '${s.staffId}', this)">${h12}:${m} ${ampm}</div>`;
  }).join('');
}

function selectApptSlot(time, staffId, el) {
  apptState.time = time;
  if (apptState.staffId === 'any') apptState.staffId = staffId;
  document.querySelectorAll('.appt-slot').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
}

function toggleManualTime() {
  const manual = document.getElementById('apptManualTime').checked;
  document.getElementById('apptManualTimeInput').classList.toggle('hidden', !manual);
  document.getElementById('apptSlotGrid').classList.toggle('hidden', manual);
}

function showApptStep(n) {
  apptState.step = n;
  for (let i = 1; i <= 4; i++) {
    document.getElementById('apptStep' + i).classList.toggle('hidden', i !== n);
  }
  document.getElementById('apptNextBtn').textContent = n === 4 ? 'Book Appointment' : 'Next';
  document.getElementById('apptBackBtn').classList.toggle('hidden', n === 1);
}

function apptBack() {
  if (apptState.step > 1) showApptStep(apptState.step - 1);
}

async function apptNext() {
  if (apptState.step === 1) {
    if (!apptState.serviceId) { toast('Select a service', 'error'); return; }
    await loadApptStaffOptions();
    showApptStep(2);
  } else if (apptState.step === 2) {
    if (!apptState.staffId) { toast('Select a staff member', 'error'); return; }
    document.getElementById('apptDate').value = formatDateStr(calDate);
    apptState.date = formatDateStr(calDate);
    loadApptSlots();
    showApptStep(3);
  } else if (apptState.step === 3) {
    const manual = document.getElementById('apptManualTime').checked;
    if (manual) {
      apptState.time = document.getElementById('apptManualTimeInput').value;
    }
    if (!apptState.date || !apptState.time) { toast('Select a date and time', 'error'); return; }
    // Load clients for step 4
    if (clientsCache.length === 0) {
      const res = await apiFetch('/clients');
      if (res && res.ok) clientsCache = await res.json();
    }
    searchClients('');
    showApptStep(4);
  } else if (apptState.step === 4) {
    await bookAppointment();
  }
}

function searchClients(query) {
  const q = query.toLowerCase();
  const filtered = q ? clientsCache.filter(c =>
    (c.name || '').toLowerCase().includes(q) ||
    (c.email || '').toLowerCase().includes(q) ||
    (c.phone || '').includes(q)
  ) : clientsCache;

  document.getElementById('apptClientResults').innerHTML = `
    <div class="appt-client-option" onclick="selectApptClient(null)" style="${!apptState.clientId ? 'background:var(--gold-dim);' : ''}">
      <div class="client-name">Walk-in (no client)</div>
    </div>
  ` + filtered.slice(0, 10).map(c => `
    <div class="appt-client-option" onclick="selectApptClient('${c.id}')" style="${apptState.clientId === c.id ? 'background:var(--gold-dim);' : ''}">
      <div class="client-name">${esc(c.name)}</div>
      <div class="client-info">${esc(c.email || '')} ${esc(c.phone || '')}</div>
    </div>
  `).join('');
}

function selectApptClient(id) {
  apptState.clientId = id;
  searchClients(document.getElementById('apptClientSearch').value);
}

function showQuickAddClient() {
  document.getElementById('quickAddClientForm').classList.toggle('hidden');
}

async function quickAddClient() {
  const name = document.getElementById('quickClientName').value.trim();
  if (!name) { toast('Name required', 'error'); return; }

  const body = {
    name,
    email: document.getElementById('quickClientEmail').value.trim() || null,
    phone: document.getElementById('quickClientPhone').value.trim() || null,
  };

  const res = await apiFetch('/clients', { method: 'POST', body: JSON.stringify(body) });
  if (!res || !res.ok) { toast('Failed to add client', 'error'); return; }
  const client = await res.json();
  clientsCache.push(client);
  apptState.clientId = client.id;
  document.getElementById('quickAddClientForm').classList.add('hidden');
  searchClients('');
  toast('Client added and selected');
}

async function bookAppointment() {
  const startTime = `${apptState.date}T${apptState.time}:00`;

  const body = {
    service_id: apptState.serviceId,
    staff_id: apptState.staffId === 'any' ? staffCache.find(s => s.is_active)?.id : apptState.staffId,
    start_time: startTime,
    client_id: apptState.clientId,
    source: 'owner'
  };

  if (!body.staff_id) { toast('No staff available', 'error'); return; }

  const res = await apiFetch('/appointments', { method: 'POST', body: JSON.stringify(body) });
  if (!res) return;

  if (res.ok) {
    toast('Appointment booked!');
    closeModal('newApptModal');
    loadCalendar();
  } else {
    const d = await res.json().catch(() => ({}));
    toast(d.error || 'Booking failed', 'error');
  }
}

// Block Time
async function openBlockTimeModal() {
  if (staffCache.length === 0) {
    const res = await apiFetch('/staff');
    if (res && res.ok) staffCache = await res.json();
  }

  document.getElementById('blockStaffSelect').innerHTML = staffCache.filter(s => s.is_active)
    .map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
  document.getElementById('blockDate').value = formatDateStr(calDate);
  document.getElementById('blockStartTime').value = '09:00';
  document.getElementById('blockTimeModal').classList.add('active');
}

async function saveBlockTime() {
  const staffId = document.getElementById('blockStaffSelect').value;
  const date = document.getElementById('blockDate').value;
  const startTime = document.getElementById('blockStartTime').value;
  const duration = parseInt(document.getElementById('blockDuration').value);
  const notes = document.getElementById('blockNotes').value.trim();

  if (!staffId || !date || !startTime) { toast('Fill all fields', 'error'); return; }

  // We need a service_id. Use the first active service (block time still needs one for DB).
  if (servicesCache.length === 0) {
    const res = await apiFetch('/services');
    if (res && res.ok) servicesCache = await res.json();
  }
  const svc = servicesCache.find(s => s.is_active);
  if (!svc) { toast('Need at least one service', 'error'); return; }

  const body = {
    staff_id: staffId,
    service_id: svc.id,
    start_time: `${date}T${startTime}:00`,
    status: 'blocked',
    notes: notes || 'Blocked time',
    source: 'owner'
  };

  const res = await apiFetch('/appointments', { method: 'POST', body: JSON.stringify(body) });
  if (res && res.ok) {
    toast('Time blocked');
    closeModal('blockTimeModal');
    loadCalendar();
  } else {
    toast('Failed to block time', 'error');
  }
}

// ── Boot ──
init();
// Load calendar on first visit
setTimeout(() => loadCalendar(), 500);
