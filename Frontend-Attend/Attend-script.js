let scannerInstance = null;
let lastScannedValue = '';

function getSignedInName() {
  return localStorage.getItem('myra_current_user_name') || localStorage.getItem('myra_current_full_name') || '';
}

function getSignedInIndexNumber() {
  return localStorage.getItem('myra_current_index_number') || '';
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
    console.warn('Failed to load attendance session:', error);
    return null;
  }
}

async function postAttendance(sessionCode, name, indexNumber = '') {
  const normalizedSessionCode = String(sessionCode || '').trim();
  if (!normalizedSessionCode || !name.trim()) return null;

  try {
    const response = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: normalizedSessionCode, name: name.trim(), indexNumber: String(indexNumber || '').trim() })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Unable to mark attendance.');
    }

    const data = await response.json();
    return data.session || null;
  } catch (error) {
    console.warn('Attendance submission failed:', error);
    showStatus(error.message || 'Unable to mark attendance right now.', true);
    return null;
  }
}

function showStatus(message, isError = false) {
  const status = document.getElementById('studentStatus');
  if (!status) return;
  status.textContent = message;
  status.style.color = isError ? '#dc2626' : '#64748b';
}

async function hasMatchingSession(value) {
  const session = await fetchAttendanceSession(value);
  return Boolean(session?.attendanceOpen);
}

async function onScanSuccess(decodedText) {
  const value = decodedText.trim();
  if (!value || value === lastScannedValue) return;

  lastScannedValue = value;
  document.getElementById('sessionCodeInput').value = value;

  const session = await fetchAttendanceSession(value);
  if (!session || !session.attendanceOpen) {
    showStatus('Attendance has ended or this code is not active right now.', true);
    return;
  }

  const name = document.getElementById('studentNameInput').value.trim() || getSignedInName() || 'Student';
  const indexNumber = getSignedInIndexNumber();
  const markedSession = await postAttendance(value, name, indexNumber);

  if (markedSession) {
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

async function handleManualMark() {
  const value = document.getElementById('sessionCodeInput').value.trim();
  const name = document.getElementById('studentNameInput').value.trim() || getSignedInName();
  if (!value) {
    showStatus('Enter a session code or scan the QR code.', true);
    return;
  }

  const session = await fetchAttendanceSession(value);
  if (!session || !session.attendanceOpen) {
    showStatus('Attendance has ended or this code is not active right now.', true);
    return;
  }

  const indexNumber = getSignedInIndexNumber();
  const markedSession = await postAttendance(value, name || 'Student', indexNumber);
  if (markedSession) {
    showStatus(`Attendance marked for ${name || 'the student'}.`);
  } else {
    showStatus('Could not mark attendance. Please enter your name.', true);
  }
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

function initialize() {
  renderStudentProfile();

  document.getElementById('startCameraBtn')?.addEventListener('click', startCamera);
  document.getElementById('stopCameraBtn')?.addEventListener('click', stopCamera);
  document.getElementById('markAttendanceBtn')?.addEventListener('click', handleManualMark);
}

document.addEventListener('DOMContentLoaded', initialize);
window.addEventListener('beforeunload', stopCamera);
