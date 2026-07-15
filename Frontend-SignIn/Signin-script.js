function safeNavigate(path) {
  const target = new URL(path, window.location.href);

  if (window.location.protocol === 'file:') {
    target.protocol = 'http:';
    target.host = 'localhost:3000';
    target.port = '3000';
  }

  window.location.assign(target.toString());
}

const params = new URLSearchParams(window.location.search);
const role = params.get('role') || 'student';

const roleTitle = document.getElementById('roleTitle');
const signinForm = document.getElementById('signinForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const messageBox = document.getElementById('statusMessage');
const guestButton = document.getElementById('guestButton');

const roleLabel = role === 'lecturer' ? 'Lecturer' : 'Student';
roleTitle.textContent = roleLabel;

async function parseResponsePayload(response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

signinForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    if (messageBox) {
      messageBox.textContent = 'Please enter your email and password.';
    }
    return;
  }

  if (messageBox) {
    messageBox.textContent = 'Signing you in...';
  }

  try {
    const response = await fetch('/api/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password, role })
    });

    const result = await parseResponsePayload(response);
    if (!response.ok) {
      throw new Error(result.error || 'Unable to sign in.');
    }

    localStorage.setItem('myra_current_role', result.user.role);
    localStorage.setItem('myra_current_user', result.user.email);
    localStorage.setItem('myra_current_user_name', result.user.fullName);
    localStorage.setItem('myra_current_programme', result.user.programme || '');
    localStorage.setItem('myra_current_level', result.user.level || '');
    localStorage.setItem('myra_current_index_number', result.user.indexNumber || '');

    safeNavigate('../Frontend-Home/Home.html');
  } catch (error) {
    if (messageBox) {
      messageBox.textContent = error.message;
    }
  }
});

guestButton.addEventListener('click', () => {
  if (messageBox) {
    messageBox.textContent = 'Preparing guest access...';
  }

  localStorage.setItem('myra_current_role', 'guest');
  localStorage.setItem('myra_current_user', 'guest@myra.local');
  localStorage.setItem('myra_current_user_name', 'Guest');
  localStorage.setItem('myra_current_programme', 'Guest');
  localStorage.setItem('myra_current_level', 'Access');
  localStorage.setItem('myra_current_index_number', '');

  window.location.href = '../Frontend-Home/Home.html';
});
