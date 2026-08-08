const STORAGE_KEY = 'myra_attendance_session';
let qrCodeInstance = null;
let lastAttendanceSignature = '';
let currentSession = null;
let isRendering = false;

function getStoredSession() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { activeCode: '' };
  try {
    return JSON.parse(raw);
  } catch {
    return { activeCode: '' };
  }
}

function saveStoredSession(code) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ activeCode: String(code || '').trim() }));
}

function getActiveSessionCode() {
  return String(getStoredSession().activeCode || '').trim();
}

function setActiveSessionCode(code) {
  saveStoredSession(code);
}

function generateSessionCode() {
  const stamp = Date.now().toString(36).toUpperCase();
  const randomPart = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `MYRA-${stamp}-${randomPart}`;
}

async function fetchAttendanceSession(code) {
  const normalized = String(code || '').trim();
  if (!normalized) return null;

  try {
    const response = await fetch(`/api/attendance?code=${encodeURIComponent(normalized)}`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.session || null;
  } catch (error) {
    console.warn('Failed to fetch session:', error);
    return null;
  }
}

async function createAttendanceSession(code, attendanceNumber = '1') {
  try {
    const response = await fetch('/api/attendance/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, attendanceNumber })
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to create session.');
    }
    const data = await response.json();
    return data.session || null;
  } catch (error) {
    console.warn('Create attendance session failed:', error);
    alert(error.message || 'Unable to create attendance session.');
    return null;
  }
}

async function updateAttendanceSessionOnServer(payload) {
  try {
    const response = await fetch('/api/attendance/session', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to update attendance session.');
    }
    const data = await response.json();
    return data.session || null;
  } catch (error) {
    console.warn('Update attendance session failed:', error);
    alert(error.message || 'Unable to update attendance session.');
    return null;
  }
}

async function resetAttendanceSession(code) {
  try {
    const response = await fetch('/api/attendance/session/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to reset session.');
    }
    const data = await response.json();
    return data.session || null;
  } catch (error) {
    console.warn('Reset attendance session failed:', error);
    alert(error.message || 'Unable to reset attendance session.');
    return null;
  }
}

function renderQrCode(value) {
  const container = document.getElementById('qrContainer');
  if (!container) return;

  container.innerHTML = '';

  if (!value) {
    container.textContent = 'Enter a value to generate a QR code.';
    return;
  }

  if (window.QRCode) {
    qrCodeInstance = new window.QRCode(container, {
      text: value,
      width: 220,
      height: 220,
      colorDark: '#0369a1',
      colorLight: '#ffffff',
      correctLevel: window.QRCode.CorrectLevel.H
    });
  }
}

function openQrFullscreen() {
  const label = document.getElementById('sessionCodeLabel');
  const value = (label?.textContent || '').trim();

  if (!value || !window.QRCode) return;

  const overlay = document.createElement('div');
  overlay.className = 'qr-fullscreen';

  const shell = document.createElement('div');
  shell.className = 'qr-fullscreen-shell';
  overlay.appendChild(shell);

  new window.QRCode(shell, {
    text: value,
    width: 360,
    height: 360,
    colorDark: '#0369a1',
    colorLight: '#ffffff',
    correctLevel: window.QRCode.CorrectLevel.H
  });

  overlay.addEventListener('click', () => overlay.remove());
  document.body.appendChild(overlay);
}

function updateAttendanceButtons(session) {
  const startBtn = document.getElementById('startAttendanceBtn');
  const endBtn = document.getElementById('endAttendanceBtn');
  if (!startBtn || !endBtn) return;

  startBtn.disabled = Boolean(session?.attendanceOpen);
  startBtn.textContent = session?.attendanceOpen ? 'Attendance active' : 'Start attendance';
  endBtn.disabled = !session?.attendanceOpen;
}

async function renderLecturer() {
  if (isRendering) return;
  isRendering = true;

  const activeCode = getActiveSessionCode();
  const label = document.getElementById('sessionCodeLabel');
  const input = document.getElementById('qrTextInput');
  const tableBody = document.getElementById('attendanceTableBody');
  const countLabel = document.getElementById('attendanceCountLabel');
  const attendanceNumberInput = document.getElementById('attendanceNumberInput');

  if (!activeCode) {
    if (label) label.textContent = '—';
    if (input) input.value = '';
    if (tableBody) tableBody.innerHTML = '<tr><td colspan="3" class="empty-row">No active session. Click above to generate one.</td></tr>';
    isRendering = false;
    return;
  }

  const session = await fetchAttendanceSession(activeCode);
  currentSession = session;

  if (!session) {
    if (label) label.textContent = activeCode;
    if (input && !input.value) input.value = activeCode;
    if (tableBody) tableBody.innerHTML = '<tr><td colspan="3" class="empty-row">Session not found on server.</td></tr>';
    isRendering = false;
    return;
  }

  const signature = JSON.stringify(session.students || []);
  if (signature === lastAttendanceSignature && document.getElementById('attendanceTableBody')) {
    isRendering = false;
    return;
  }

  lastAttendanceSignature = signature;

  const activeValue = session.code || session.id;
  if (label) label.textContent = activeValue;
  if (input && !input.value) input.value = activeValue;
  if (attendanceNumberInput) attendanceNumberInput.value = session.attendanceNumber || '1';

  if (countLabel) countLabel.textContent = session.students?.length ? String(session.students.length) : '0';
  updateAttendanceButtons(session);
  renderQrCode(activeValue);

  if (tableBody) {
    if (!session.students || !session.students.length) {
      tableBody.innerHTML = '<tr><td colspan="3" class="empty-row">No students have scanned yet.</td></tr>';
    } else {
      tableBody.innerHTML = session.students
        .map((entry) => `<tr><td><strong>${entry.name}</strong></td><td>${entry.indexNumber || '—'}</td><td><span class="time-stamp">${entry.timestamp}</span></td></tr>`)
        .join('');
    }
  }

  isRendering = false;
}

function downloadTxt() {
  const session = currentSession;
  if (!session || !session.students || !session.students.length) {
    alert('No attendance list to export yet.');
    return;
  }

  const lines = session.students.map((entry) => `${entry.name}${entry.indexNumber ? ` - ${entry.indexNumber}` : ''}`);
  const content = lines.join('\n');
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `Attendance_${session.id}.txt`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadPdf() {
  const session = currentSession;
  if (!session || !session.students || !session.students.length) {
    alert('No attendance list to export yet.');
    return;
  }

  if (!window.jspdf?.jsPDF) {
    alert('PDF library not fully loaded. Check your internet connection.');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text('MYRA Attendance Report', 14, 20);
  doc.setFontSize(11);
  doc.text(`Session ID: ${session.id}`, 14, 32);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 40);

  let y = 56;
  session.students.forEach((entry) => {
    const detail = entry.indexNumber ? `${entry.name} — ${entry.indexNumber}` : entry.name;
    doc.text(`• ${detail}`, 14, y);
    y += 8;
  });

  doc.save(`Attendance_${session.id}.pdf`);
}

async function createSession() {
  const sessionId = generateSessionCode();
  const session = await createAttendanceSession(sessionId, '1');
  if (!session) return;

  setActiveSessionCode(sessionId);
  document.getElementById('qrTextInput').value = sessionId;
  document.getElementById('attendanceNumberInput').value = '1';
  currentSession = session;
  await renderLecturer();
}

async function startAttendance() {
  const code = getActiveSessionCode();
  if (!code) {
    alert('Set a session code before starting attendance.');
    return;
  }

  const attendanceNumber = document.getElementById('attendanceNumberInput')?.value.trim() || '1';
  const session = await updateAttendanceSessionOnServer({ code, attendanceOpen: true, attendanceNumber });
  if (session) {
    currentSession = session;
    await renderLecturer();
  }
}

async function endAttendance() {
  const code = getActiveSessionCode();
  if (!code) return;
  const session = await updateAttendanceSessionOnServer({ code, attendanceOpen: false });
  if (session) {
    currentSession = session;
    await renderLecturer();
  }
}

async function resetSession() {
  const code = getActiveSessionCode();
  if (!code) return;
  if (!confirm('Are you sure you want to clear the student list for this session?')) return;

  const session = await resetAttendanceSession(code);
  if (session) {
    currentSession = session;
    await renderLecturer();
  }
}

function initialize() {
  renderLecturer();

  window.setInterval(() => {
    const code = getActiveSessionCode();
    if (code) {
      renderLecturer();
    }
  }, 2000);

  document.getElementById('generateQrBtn')?.addEventListener('click', () => {
    createSession();
  });

  const input = document.getElementById('qrTextInput');
  document.getElementById('confirmCodeBtn')?.addEventListener('click', async () => {
    const value = input?.value.trim();
    const code = getActiveSessionCode();
    if (!code) return;
    if (!value) {
      alert('Enter a session code before confirming.');
      return;
    }
    if (currentSession?.attendanceOpen) {
      alert('Stop the current attendance before changing the code.');
      return;
    }

    if (value === code) {
      return;
    }

    const session = await updateAttendanceSessionOnServer({ code, newCode: value });
    if (session) {
      setActiveSessionCode(value);
      currentSession = session;
      await renderLecturer();
    }
  });

  const attendanceNumberInput = document.getElementById('attendanceNumberInput');
  attendanceNumberInput?.addEventListener('change', async () => {
    const code = getActiveSessionCode();
    if (!code) return;
    const value = attendanceNumberInput.value.trim() || '1';
    const session = await updateAttendanceSessionOnServer({ code, attendanceNumber: value });
    if (session) {
      currentSession = session;
      await renderLecturer();
    }
  });

  document.getElementById('qrContainer')?.addEventListener('click', openQrFullscreen);
  document.getElementById('startAttendanceBtn')?.addEventListener('click', startAttendance);
  document.getElementById('endAttendanceBtn')?.addEventListener('click', endAttendance);
  document.getElementById('downloadCsvBtn')?.addEventListener('click', downloadTxt);
  document.getElementById('downloadPdfBtn')?.addEventListener('click', downloadPdf);
  document.getElementById('resetSessionBtn')?.addEventListener('click', resetSession);

  if (!getActiveSessionCode()) {
    createSession();
  }
}

document.addEventListener('DOMContentLoaded', initialize);

function resetSession() {
  const state = getState();
  if (state.activeSessionId && state.sessions[state.activeSessionId]) {
    if (confirm('Are you sure you want to clear the student list for this session?')) {
      state.sessions[state.activeSessionId].students = [];
      saveState(state);
      renderLecturer();
    }
  }
}

function initialize() {
  renderLecturer();

  window.addEventListener('storage', () => {
    renderLecturer();
  });

  window.setInterval(() => {
    const session = getActiveSession();
    const signature = JSON.stringify(session?.students || []);
    if (signature !== lastAttendanceSignature) {
      renderLecturer();
    }
  }, 1000);

  document.getElementById('generateQrBtn')?.addEventListener('click', () => {
    createSession();
  });

  const input = document.getElementById('qrTextInput');
  document.getElementById('confirmCodeBtn')?.addEventListener('click', () => {
    const value = input?.value.trim();
    const state = getState();
    const session = state.sessions[state.activeSessionId];
    if (!session) return;
    if (!value) {
      alert('Enter a session code before confirming.');
      return;
    }
    if (session.attendanceOpen) {
      alert('Stop the current attendance before changing the code.');
      return;
    }
    session.code = value;
    saveState(state);
    renderLecturer();
  });

  const attendanceNumberInput = document.getElementById('attendanceNumberInput');
  attendanceNumberInput?.addEventListener('input', () => {
    const state = getState();
    const session = state.sessions[state.activeSessionId];
    if (session) {
      session.attendanceNumber = attendanceNumberInput.value.trim() || '1';
      saveState(state);
    }
  });

  document.getElementById('qrContainer')?.addEventListener('click', openQrFullscreen);

  document.getElementById('startAttendanceBtn')?.addEventListener('click', startAttendance);
  document.getElementById('endAttendanceBtn')?.addEventListener('click', endAttendance);
  document.getElementById('downloadCsvBtn')?.addEventListener('click', downloadTxt);
  document.getElementById('downloadPdfBtn')?.addEventListener('click', downloadPdf);
  document.getElementById('resetSessionBtn')?.addEventListener('click', resetSession);

  if (!getActiveSession()) {
    createSession();
  }
}

document.addEventListener('DOMContentLoaded', initialize);
