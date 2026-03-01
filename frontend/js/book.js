// BoredRoom Booking — Public Booking Widget
const API = window.location.origin;
let biz = null, services = [], staffList = [];
let state = { step: 1, serviceId: null, staffId: null, date: null, time: null, selectedSlot: null };

// Detect mode from URL
const pathParts = window.location.pathname.split('/');
const mode = pathParts[1]; // 'book', 'cancel', 'reschedule'
const slugOrToken = pathParts[2];

if (new URLSearchParams(window.location.search).has('embed')) {
  document.body.classList.add('embed');
}

// ── Init ──
async function init() {
  if (mode === 'cancel') return initCancel();
  if (mode === 'reschedule') return initReschedule();

  // Normal booking flow
  try {
    const res = await fetch(`${API}/api/public/business/${slugOrToken}`);
    if (!res.ok) throw new Error('not found');
    biz = await res.json();

    // Apply brand color
    document.documentElement.style.setProperty('--accent', biz.brand_color || '#8CC63F');
    const hsl = hexToHSL(biz.brand_color || '#8CC63F');
    document.documentElement.style.setProperty('--accent-hover', adjustBrightness(biz.brand_color || '#8CC63F', -15));
    document.documentElement.style.setProperty('--accent-dim', (biz.brand_color || '#8CC63F') + '1F');

    document.title = `Book — ${biz.name}`;
    document.getElementById('bizName').textContent = biz.name;
    document.getElementById('bizInfo').textContent = [biz.address, biz.phone].filter(Boolean).join(' · ');

    // Load services
    const svcRes = await fetch(`${API}/api/public/services/${biz.id}`);
    services = await svcRes.json();

    document.getElementById('loadingScreen').classList.add('hidden');
    document.getElementById('bookFlow').classList.remove('hidden');
    renderServices();
  } catch (e) {
    document.getElementById('loadingScreen').classList.add('hidden');
    document.getElementById('errorScreen').classList.remove('hidden');
  }
}

// ── Services ──
function renderServices(filterCat = null) {
  // Category tabs
  const cats = [...new Set(services.map(s => s.category).filter(Boolean))];
  const tabsEl = document.getElementById('categoryTabs');
  if (cats.length > 1) {
    tabsEl.innerHTML = `<button class="category-tab ${!filterCat ? 'active' : ''}" onclick="renderServices(null)">All</button>` +
      cats.map(c => `<button class="category-tab ${filterCat === c ? 'active' : ''}" onclick="renderServices('${c}')">${esc(c)}</button>`).join('');
  } else {
    tabsEl.innerHTML = '';
  }

  const filtered = filterCat ? services.filter(s => s.category === filterCat) : services;
  document.getElementById('serviceGrid').innerHTML = filtered.map(s => `
    <div class="service-card ${state.serviceId === s.id ? 'selected' : ''}" onclick="selectService('${s.id}')">
      <div>
        <div class="svc-name">${esc(s.name)}${s.is_popular ? '<span class="popular-badge">Popular</span>' : ''}</div>
        <div class="svc-meta">${s.duration_minutes} min${s.description ? ' · ' + esc(s.description) : ''}</div>
      </div>
      <div class="svc-price">${s.price ? '$' + Number(s.price).toFixed(0) : ''}</div>
    </div>
  `).join('');
}

function selectService(id) {
  state.serviceId = id;
  document.querySelectorAll('.service-card').forEach(el => el.classList.remove('selected'));
  event.currentTarget.classList.add('selected');
}

// ── Staff ──
async function loadStaff() {
  const res = await fetch(`${API}/api/public/staff/${biz.id}?serviceId=${state.serviceId}`);
  staffList = await res.json();

  const grid = document.getElementById('staffPickGrid');
  grid.innerHTML = `
    <div class="staff-pick-card ${state.staffId === 'any' ? 'selected' : ''}" onclick="selectStaff('any')">
      <div class="staff-pick-avatar">★</div>
      <div class="staff-pick-name">Any Available</div>
    </div>
  ` + staffList.map(s => {
    const initials = s.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    return `
      <div class="staff-pick-card ${state.staffId === s.id ? 'selected' : ''}" onclick="selectStaff('${s.id}')">
        ${s.photo_url
          ? `<img src="${esc(s.photo_url)}" class="staff-pick-avatar" style="object-fit:cover;">`
          : `<div class="staff-pick-avatar">${initials}</div>`
        }
        <div class="staff-pick-name">${esc(s.name)}</div>
      </div>`;
  }).join('');
}

function selectStaff(id) {
  state.staffId = id;
  document.querySelectorAll('.staff-pick-card').forEach(el => el.classList.remove('selected'));
  event.currentTarget.classList.add('selected');
}

// ── Calendar ──
let calMonth, calYear;

function renderCalendar() {
  const today = new Date();
  if (!calMonth && calMonth !== 0) { calMonth = today.getMonth(); calYear = today.getFullYear(); }

  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const dows = ['Su','Mo','Tu','We','Th','Fr','Sa'];

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const todayStr = fmtDate(today);

  let html = `
    <div class="mini-cal-header">
      <button class="mini-cal-nav" onclick="calPrevMonth()">‹</button>
      <h3>${months[calMonth]} ${calYear}</h3>
      <button class="mini-cal-nav" onclick="calNextMonth()">›</button>
    </div>
    <div class="mini-cal-grid">
      ${dows.map(d => `<div class="mini-cal-dow">${d}</div>`).join('')}
  `;

  for (let i = 0; i < firstDay; i++) html += '<div class="mini-cal-day empty"></div>';

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isPast = dateStr < todayStr;
    const isToday = dateStr === todayStr;
    const isSelected = dateStr === state.date;
    const cls = [
      'mini-cal-day',
      isPast ? 'disabled' : '',
      isToday ? 'today' : '',
      isSelected ? 'selected' : ''
    ].filter(Boolean).join(' ');

    html += `<div class="${cls}" ${isPast ? '' : `onclick="selectDate('${dateStr}')"`}>${d}</div>`;
  }

  html += '</div>';
  document.getElementById('miniCalendar').innerHTML = html;
}

function calPrevMonth() {
  calMonth--;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  renderCalendar();
}
function calNextMonth() {
  calMonth++;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  renderCalendar();
}

async function selectDate(dateStr) {
  state.date = dateStr;
  renderCalendar();
  // Fetch slots
  document.getElementById('timeSlotsArea').innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';

  const params = new URLSearchParams({
    businessId: biz.id,
    serviceId: state.serviceId,
    staffId: state.staffId || 'any',
    date: dateStr
  });

  const res = await fetch(`${API}/api/slots?${params}`);
  const slots = await res.json();

  if (slots.length === 0) {
    document.getElementById('timeSlotsArea').innerHTML = '<div class="no-slots-msg">No available times on this date. Try another day.</div>';
    return;
  }

  // Dedupe by time
  const seen = new Map();
  slots.forEach(s => { if (!seen.has(s.time)) seen.set(s.time, s); });

  document.getElementById('timeSlotsArea').innerHTML = '<div class="time-slot-grid">' +
    Array.from(seen.values()).map(s => {
      const h = parseInt(s.time.split(':')[0]);
      const m = s.time.split(':')[1];
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const isSelected = state.time === s.time;
      return `<div class="time-slot ${isSelected ? 'selected' : ''}" onclick="selectTime('${s.time}','${s.staffId}')">${h12}:${m} ${ampm}</div>`;
    }).join('') + '</div>';
}

function selectTime(time, staffId) {
  state.time = time;
  state.selectedSlot = { time, staffId };
  if (state.staffId === 'any') state.staffId = staffId;
  // Re-render to show selection
  document.querySelectorAll('.time-slot').forEach(el => el.classList.remove('selected'));
  event.currentTarget.classList.add('selected');
}

// ── Client Info / Summary ──
function renderSummary() {
  const svc = services.find(s => s.id === state.serviceId);
  const staff = state.staffId === 'any' ? { name: 'Any Available' } : (staffList.find(s => s.id === state.staffId) || { name: 'Staff' });
  const d = new Date(state.date + 'T12:00:00');
  const dateStr = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const h = parseInt(state.time.split(':')[0]);
  const m = state.time.split(':')[1];
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;

  document.getElementById('bookingSummary').innerHTML = `
    <div class="summary-row"><span class="label">Service</span><span>${esc(svc.name)}</span></div>
    <div class="summary-row"><span class="label">With</span><span>${esc(staff.name)}</span></div>
    <div class="summary-row"><span class="label">Date</span><span>${dateStr}</span></div>
    <div class="summary-row"><span class="label">Time</span><span>${h12}:${m} ${ampm}</span></div>
    <div class="summary-row"><span class="label">Duration</span><span>${svc.duration_minutes} min</span></div>
    ${svc.price ? `<div class="summary-row summary-total"><span>Total</span><span>$${Number(svc.price).toFixed(2)}</span></div>` : ''}
  `;
}

async function checkReturnClient() {
  const email = document.getElementById('clientEmail').value.trim();
  if (!email) return;
  // Simple return detection by checking if name auto-fills would be nice
  // For now, localStorage-based
  const saved = localStorage.getItem('bb_client_' + biz.id);
  if (saved) {
    try {
      const c = JSON.parse(saved);
      if (c.email === email) {
        document.getElementById('clientName').value = c.name || '';
        document.getElementById('clientPhone').value = c.phone || '';
        document.getElementById('returnClientMsg').textContent = `Welcome back, ${c.name}!`;
        document.getElementById('returnClientMsg').classList.remove('hidden');
      }
    } catch (e) {}
  }
}

// ── Navigation ──
function showStep(n) {
  state.step = n;
  for (let i = 1; i <= 4; i++) {
    document.getElementById('step' + i).classList.toggle('hidden', i !== n);
    document.getElementById('prog' + i).classList.toggle('active', i <= n);
  }
  document.getElementById('backBtn').classList.toggle('hidden', n === 1);
  document.getElementById('nextBtn').textContent = n === 4 ? 'Book Appointment' : 'Continue';
}

function bookBack() {
  if (state.step > 1) showStep(state.step - 1);
}

async function bookNext() {
  if (state.step === 1) {
    if (!state.serviceId) return;
    await loadStaff();
    showStep(2);
  } else if (state.step === 2) {
    if (!state.staffId) { state.staffId = 'any'; }
    renderCalendar();
    showStep(3);
  } else if (state.step === 3) {
    if (!state.date || !state.time) return;
    renderSummary();
    showStep(4);
  } else if (state.step === 4) {
    await submitBooking();
  }
}

async function submitBooking() {
  const name = document.getElementById('clientName').value.trim();
  const email = document.getElementById('clientEmail').value.trim();
  const phone = document.getElementById('clientPhone').value.trim();
  const notes = document.getElementById('clientNotes').value.trim();

  if (!name || !email || !phone) return;

  const btn = document.getElementById('nextBtn');
  btn.disabled = true;
  btn.textContent = 'Booking...';

  try {
    const res = await fetch(`${API}/api/public/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId: biz.id,
        serviceId: state.serviceId,
        staffId: state.selectedSlot?.staffId || state.staffId,
        startTime: `${state.date}T${state.time}:00`,
        clientName: name,
        clientEmail: email,
        clientPhone: phone,
        notes
      })
    });

    const data = await res.json();
    if (!res.ok) {
      btn.disabled = false;
      btn.textContent = 'Book Appointment';
      alert(data.error || 'Booking failed');
      return;
    }

    // Save client info locally for return detection
    localStorage.setItem('bb_client_' + biz.id, JSON.stringify({ name, email, phone }));

    // Show confirmation
    showConfirmation(data);
  } catch (e) {
    btn.disabled = false;
    btn.textContent = 'Book Appointment';
    alert('Booking failed. Please try again.');
  }
}

function showConfirmation(appt) {
  document.getElementById('bookFlow').classList.add('hidden');
  document.getElementById('confirmScreen').classList.remove('hidden');

  const start = new Date(appt.start_time);
  const dateStr = start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const timeStr = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' });

  document.getElementById('confirmDetails').innerHTML = `
    <div class="summary-row"><span class="label">Service</span><span>${esc(appt.service_name)}</span></div>
    <div class="summary-row"><span class="label">With</span><span>${esc(appt.staff_name)}</span></div>
    <div class="summary-row"><span class="label">Date</span><span>${dateStr}</span></div>
    <div class="summary-row"><span class="label">Time</span><span>${timeStr}</span></div>
    <div class="summary-row"><span class="label">Confirmation</span><span style="font-family:monospace;">${appt.booking_token}</span></div>
  `;

  // Calendar links
  const endTime = new Date(appt.end_time);
  const gcalStart = start.toISOString().replace(/[-:]/g, '').replace('.000', '');
  const gcalEnd = endTime.toISOString().replace(/[-:]/g, '').replace('.000', '');
  const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(appt.service_name + ' at ' + biz.name)}&dates=${gcalStart}/${gcalEnd}&details=${encodeURIComponent('Booking confirmation: ' + appt.booking_token)}&location=${encodeURIComponent(biz.address || '')}`;

  document.getElementById('calLinks').innerHTML = `
    <a href="${gcalUrl}" target="_blank" class="cal-link">📅 Google Calendar</a>
    <a href="/api/public/appointment/${appt.booking_token}" class="cal-link" onclick="alert('Calendar download coming soon');return false;">🍎 Apple Calendar</a>
  `;
}

// ── Cancel flow ──
async function initCancel() {
  document.getElementById('loadingScreen').classList.add('hidden');
  try {
    const res = await fetch(`${API}/api/public/appointment/${slugOrToken}`);
    if (!res.ok) throw new Error();
    const appt = await res.json();

    document.getElementById('cancelScreen').classList.remove('hidden');
    const start = new Date(appt.start_time);
    document.getElementById('cancelDetails').innerHTML = `
      <div class="summary-row"><span class="label">Service</span><span>${esc(appt.service_name)}</span></div>
      <div class="summary-row"><span class="label">With</span><span>${esc(appt.staff_name)}</span></div>
      <div class="summary-row"><span class="label">Date</span><span>${start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })}</span></div>
      <div class="summary-row"><span class="label">Time</span><span>${start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' })}</span></div>
      <div class="summary-row"><span class="label">Business</span><span>${esc(appt.business_name)}</span></div>
    `;

    if (appt.status === 'cancelled') {
      document.getElementById('cancelBtn').classList.add('hidden');
      document.getElementById('cancelTitle').textContent = 'Appointment Cancelled';
      document.getElementById('cancelMsg').textContent = 'This appointment has already been cancelled.';
      document.getElementById('cancelMsg').classList.remove('hidden');
    }
  } catch (e) {
    document.getElementById('errorScreen').classList.remove('hidden');
    document.getElementById('errorMsg').textContent = 'Appointment not found.';
  }
}

async function confirmCancel() {
  const btn = document.getElementById('cancelBtn');
  btn.disabled = true;
  btn.textContent = 'Cancelling...';

  try {
    const res = await fetch(`${API}/api/public/cancel/${slugOrToken}`, { method: 'POST' });
    const data = await res.json();

    if (res.ok) {
      btn.classList.add('hidden');
      document.getElementById('cancelTitle').textContent = 'Appointment Cancelled';
      document.getElementById('cancelMsg').textContent = 'Your appointment has been cancelled successfully.';
      document.getElementById('cancelMsg').classList.remove('hidden');
      document.getElementById('cancelMsg').style.color = '#27AE60';
    } else {
      document.getElementById('cancelMsg').textContent = data.error || 'Cancel failed';
      document.getElementById('cancelMsg').classList.remove('hidden');
      document.getElementById('cancelMsg').style.color = '#C0392B';
      btn.disabled = false;
      btn.textContent = 'Cancel Appointment';
    }
  } catch (e) {
    btn.disabled = false;
    btn.textContent = 'Cancel Appointment';
  }
}

async function initReschedule() {
  // For now redirect to cancel — full reschedule is a stretch goal
  window.location.href = `/cancel/${slugOrToken}`;
}

// ── Utilities ──
function esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function fmtDate(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function hexToHSL(hex) {
  let r = parseInt(hex.slice(1, 3), 16) / 255;
  let g = parseInt(hex.slice(3, 5), 16) / 255;
  let b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function adjustBrightness(hex, amount) {
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  r = Math.max(0, Math.min(255, r + amount));
  g = Math.max(0, Math.min(255, g + amount));
  b = Math.max(0, Math.min(255, b + amount));
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

// ── Boot ──
init();
