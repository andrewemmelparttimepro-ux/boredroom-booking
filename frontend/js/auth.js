// BoredRoom Booking — Auth
const API = window.location.origin + '/api';

// Check if already logged in
(function checkAuth() {
  const token = localStorage.getItem('bb_token');
  if (token && window.location.pathname === '/' || window.location.pathname === '/index.html') {
    // Verify token is still valid
    fetch(API + '/auth/me', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => { if (r.ok) window.location.href = '/dashboard.html'; })
      .catch(() => {});
  }
})();

function showLogin() {
  document.getElementById('loginForm').classList.remove('hidden');
  document.getElementById('registerForm').classList.add('hidden');
}

function showRegister() {
  document.getElementById('loginForm').classList.add('hidden');
  document.getElementById('registerForm').classList.remove('hidden');
}

async function handleLogin() {
  const btn = document.getElementById('loginBtn');
  const errEl = document.getElementById('loginError');
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!email || !password) {
    errEl.textContent = 'Please fill in all fields';
    errEl.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Signing in...';
  errEl.style.display = 'none';

  try {
    const res = await fetch(API + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();

    if (!res.ok) {
      errEl.textContent = data.error || 'Login failed';
      errEl.style.display = 'block';
      return;
    }

    localStorage.setItem('bb_token', data.token);
    localStorage.setItem('bb_user', JSON.stringify(data.user));
    localStorage.setItem('bb_business', JSON.stringify(data.business));
    window.location.href = '/dashboard.html';
  } catch (err) {
    errEl.textContent = 'Network error. Please try again.';
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
}

async function handleRegister() {
  const btn = document.getElementById('registerBtn');
  const errEl = document.getElementById('registerError');
  const businessName = document.getElementById('regBizName').value.trim();
  const slug = document.getElementById('regSlug').value.trim();
  const ownerName = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;

  if (!businessName || !slug || !ownerName || !email || !password) {
    errEl.textContent = 'Please fill in all fields';
    errEl.style.display = 'block';
    return;
  }

  if (password.length < 8) {
    errEl.textContent = 'Password must be at least 8 characters';
    errEl.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Creating...';
  errEl.style.display = 'none';

  try {
    const res = await fetch(API + '/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessName, slug, ownerName, email, password })
    });
    const data = await res.json();

    if (!res.ok) {
      errEl.textContent = data.error || 'Registration failed';
      errEl.style.display = 'block';
      return;
    }

    localStorage.setItem('bb_token', data.token);
    window.location.href = '/dashboard.html';
  } catch (err) {
    errEl.textContent = 'Network error. Please try again.';
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create Account';
  }
}

// Enter key support
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    if (!document.getElementById('loginForm').classList.contains('hidden')) {
      handleLogin();
    } else {
      handleRegister();
    }
  }
});
