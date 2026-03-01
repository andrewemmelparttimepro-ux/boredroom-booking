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

// ── Boot ──
init();
