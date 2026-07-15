const STORAGE_KEY = 'myra_attendance_state';
let qrCodeInstance = null;
let lastAttendanceSignature = '';

function getState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { activeSessionId: '', sessions: {} };

  try {
    return JSON.parse(raw);
  } catch {
    return { activeSessionId: '', sessions: {} };
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function generateSessionCode() {
  const stamp = Date.now().toString(36).toUpperCase();
  const randomPart = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `MYRA-${stamp}-${randomPart}`;
}

function createSession() {
  const state = getState();
  const sessionId = generateSessionCode();
  state.activeSessionId = sessionId;
  state.sessions[sessionId] = {
    id: sessionId,
    createdAt: new Date().toISOString(),
    students: [],
    attendanceOpen: false,
    attendanceNumber: '1'
  };
  saveState(state);

  const input = document.getElementById('qrTextInput');
  if (input) {
    input.value = sessionId;
  }

  const attendanceNumberInput = document.getElementById('attendanceNumberInput');
  if (attendanceNumberInput) {
    attendanceNumberInput.value = '1';
  }

  renderQrCode(sessionId);
  renderLecturer();
  return sessionId;
}

function getActiveSession() {
  const state = getState();
  if (!state.activeSessionId) return null;
  return state.sessions[state.activeSessionId] || null;
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
  const input = document.getElementById('qrTextInput');
  const label = document.getElementById('sessionCodeLabel');
  const value = (input?.value || label?.textContent || '').trim();

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

function renderLecturer() {
  const session = getActiveSession();
  const label = document.getElementById('sessionCodeLabel');
  const input = document.getElementById('qrTextInput');
  const tableBody = document.getElementById('attendanceTableBody');
  const countLabel = document.getElementById('attendanceCountLabel');
  const attendanceNumberInput = document.getElementById('attendanceNumberInput');
  const signature = JSON.stringify(session?.students || []);

  if (signature === lastAttendanceSignature && document.getElementById('attendanceTableBody')) {
    return;
  }

  lastAttendanceSignature = signature;

  if (!session) {
    if (label) label.textContent = '—';
    if (tableBody) tableBody.innerHTML = '<tr><td colspan="3" class="empty-row">No active session. Click above to generate one.</td></tr>';
    return;
  }

  if (label) label.textContent = session.id;
  if (input && !input.value) {
    input.value = session.id;
  }

  const activeValue = input?.value || session.id;
  if (input && input.value !== session.id) {
    input.value = activeValue;
  }

  const sessionCodeLabel = document.getElementById('sessionCodeLabel');
  if (sessionCodeLabel) {
    sessionCodeLabel.textContent = activeValue;
  }

  if (countLabel) {
    countLabel.textContent = session.students?.length ? String(session.students.length) : '0';
  }

  if (attendanceNumberInput) {
    attendanceNumberInput.value = session.attendanceNumber || '1';
  }

  updateAttendanceButtons(session);
  renderQrCode(activeValue);

  if (tableBody) {
    if (!session.students || !session.students.length) {
      tableBody.innerHTML = '<tr><td colspan="3" class="empty-row">No students have scanned yet.</td></tr>';
      return;
    }

    tableBody.innerHTML = session.students
      .map((entry) => `<tr><td><strong>${entry.name}</strong></td><td>${entry.indexNumber || '—'}</td><td><span class="time-stamp">${entry.timestamp}</span></td></tr>`)
      .join('');
  }
}

function downloadTxt() {
  const session = getActiveSession();
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
  const session = getActiveSession();
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

function startAttendance() {
  const state = getState();
  const session = state.sessions[state.activeSessionId];
  if (!session) return;

  session.attendanceOpen = true;
  saveState(state);
  renderLecturer();
}

function endAttendance() {
  const state = getState();
  const session = state.sessions[state.activeSessionId];
  if (!session) return;

  session.attendanceOpen = false;
  saveState(state);
  renderLecturer();
}

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
  input?.addEventListener('input', () => {
    const value = input.value.trim();
    const label = document.getElementById('sessionCodeLabel');
    if (label) label.textContent = value || '—';
    renderQrCode(value);
  });

  input?.addEventListener('change', () => {
    const value = input.value.trim();
    const label = document.getElementById('sessionCodeLabel');
    if (label) label.textContent = value || '—';
    renderQrCode(value);
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
