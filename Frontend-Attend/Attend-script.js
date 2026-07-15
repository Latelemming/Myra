const STORAGE_KEY = 'myra_attendance_state';
let scannerInstance = null;
let lastScannedValue = '';

function getState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { activeSessionId: '', sessions: {} };
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    return { activeSessionId: '', sessions: {} };
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getSignedInName() {
  return localStorage.getItem('myra_current_user_name') || localStorage.getItem('myra_current_full_name') || '';
}

function getSignedInIndexNumber() {
  return localStorage.getItem('myra_current_index_number') || '';
}

function getActiveSession() {
  const state = getState();
  if (!state.activeSessionId) return null;
  return state.sessions[state.activeSessionId] || null;
}

function renderStudentProfile() {
  const meta = document.getElementById('studentMeta');
  const signedInName = getSignedInName();
  const input = document.getElementById('studentNameInput');
  if (meta) {
    meta.textContent = signedInName
      ? `Signed in as ${signedInName}`
      : 'No account name detected. You can still enter your name manually.';
  }
  if (input && signedInName && !input.value) {
    input.value = signedInName;
  }
}

function markAttendance(sessionId, name, indexNumber = '') {
  const state = getState();
  const normalizedSessionId = String(sessionId || '').trim();

  if (!normalizedSessionId) return false;

  if (!state.sessions[normalizedSessionId]) {
    state.sessions[normalizedSessionId] = { id: normalizedSessionId, createdAt: new Date().toISOString(), students: [] };
  }

  const session = state.sessions[normalizedSessionId];
  const normalizedName = name.trim();
  if (!normalizedName) return false;

  const existing = session.students.some((entry) => entry.name.toLowerCase() === normalizedName.toLowerCase());
  if (!existing) {
    session.students.unshift({
      name: normalizedName,
      indexNumber: String(indexNumber || '').trim(),
      timestamp: new Date().toLocaleString()
    });
  }

  state.activeSessionId = normalizedSessionId;
  saveState(state);
  return true;
}

function showStatus(message, isError = false) {
  const status = document.getElementById('studentStatus');
  if (!status) return;
  status.textContent = message;
  status.style.color = isError ? '#dc2626' : '#64748b';
}

function hasMatchingSession(value) {
  const state = getState();
  if (!value) return false;
  const session = state.sessions?.[value];
  if (!session) return false;
  return Boolean(session.attendanceOpen || state.activeSessionId === value);
}

function onScanSuccess(decodedText) {
  const value = decodedText.trim();
  if (!value || value === lastScannedValue) return;

  if (!hasMatchingSession(value)) {
    showStatus('Attendance has ended or this code is not active right now.', true);
    return;
  }

  lastScannedValue = value;
  document.getElementById('sessionCodeInput').value = value;

  const name = document.getElementById('studentNameInput').value.trim() || getSignedInName() || 'Student';
  const indexNumber = getSignedInIndexNumber();
  const marked = markAttendance(value, name, indexNumber);

  if (marked) {
    showStatus(`QR scanned successfully. Attendance marked for ${name}.`);
  } else {
    showStatus('Could not mark attendance. Please enter your name.', true);
  }

  if (scannerInstance) {
    scannerInstance.clear().catch(() => {});
  }
}

function onScanFailure(error) {
  if (typeof error === 'string' && error.includes('NotFoundException')) {
    return;
  }
  console.warn('QR scan warning:', error);
}

function startCamera() {
  if (!window.Html5QrcodeScanner) {
    showStatus('The QR scanner library is not available right now.', true);
    return;
  }

  if (scannerInstance) {
    showStatus('Scanner is already active.');
    return;
  }

  const scannerOptions = {
    fps: 10,
    qrbox: { width: 250, height: 250 },
    showScanTypeSelector: false,
    supportedScanTypes: window.Html5QrcodeScanType
      ? [window.Html5QrcodeScanType.SCAN_TYPE_CAMERA]
      : undefined
  };

  scannerInstance = new window.Html5QrcodeScanner('reader', scannerOptions, false);

  scannerInstance.render(onScanSuccess, onScanFailure);
  showStatus('Scanner ready. Point the camera at the lecturer QR code.');
}

function stopCamera() {
  if (scannerInstance) {
    scannerInstance.clear().catch(() => {});
    scannerInstance = null;
  }

  const reader = document.getElementById('reader');
  if (reader) {
    reader.innerHTML = '';
  }

  showStatus('Scanner stopped.');
}

function handleManualMark() {
  const value = document.getElementById('sessionCodeInput').value.trim();
  const name = document.getElementById('studentNameInput').value.trim() || getSignedInName();
  if (!value) {
    showStatus('Enter a session code or scan the QR code.', true);
    return;
  }

  if (!hasMatchingSession(value)) {
    showStatus('Attendance has ended or this code is not active right now.', true);
    return;
  }

  const indexNumber = getSignedInIndexNumber();
  const marked = markAttendance(value, name || 'Student', indexNumber);
  if (marked) {
    showStatus(`Attendance marked for ${name || 'the student'}.`);
  } else {
    showStatus('Could not mark attendance. Please enter your name.', true);
  }
}

function initialize() {
  renderStudentProfile();

  document.getElementById('startCameraBtn')?.addEventListener('click', startCamera);
  document.getElementById('stopCameraBtn')?.addEventListener('click', stopCamera);
  document.getElementById('markAttendanceBtn')?.addEventListener('click', handleManualMark);
}

document.addEventListener('DOMContentLoaded', initialize);
window.addEventListener('beforeunload', stopCamera);
