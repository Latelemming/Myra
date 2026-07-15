function safeNavigate(path) {
  const target = new URL(path, window.location.href);

  if (window.location.protocol === 'file:') {
    target.protocol = 'http:';
    target.host = 'localhost:3000';
    target.port = '3000';
  }

  window.location.assign(target.toString());
}

const signupForm = document.getElementById('signupForm');
const messageBox = document.getElementById('message');
const roleSelect = document.getElementById('role');

const toggleStudentFields = () => {
  const isStudent = roleSelect.value === 'student';
  document.body.classList.toggle('role-student', isStudent);
};

async function parseResponsePayload(response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

roleSelect.addEventListener('change', toggleStudentFields);
toggleStudentFields();

signupForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const role = document.getElementById('role').value;
  const payload = {
    fullName: document.getElementById('fullName').value.trim(),
    email: document.getElementById('email').value.trim(),
    password: document.getElementById('password').value.trim(),
    role
  };

  if (role === 'student') {
    payload.programme = document.getElementById('programme').value.trim();
    payload.level = document.getElementById('level').value.trim();
    payload.indexNumber = document.getElementById('indexNumber').value.trim();
  }

  if (!payload.fullName || !payload.email || !payload.password) {
    messageBox.textContent = 'Please fill in all fields.';
    return;
  }

  messageBox.textContent = 'Creating your account...';

  try {
    const response = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await parseResponsePayload(response);

    if (!response.ok) {
      throw new Error(result.error || 'Signup failed.');
    }

    messageBox.textContent = `Account created successfully for ${result.role}.`;
    signupForm.reset();

    setTimeout(() => {
      safeNavigate('Signin.html');
    }, 900);
  } catch (error) {
    messageBox.textContent = error.message;
  }
});
