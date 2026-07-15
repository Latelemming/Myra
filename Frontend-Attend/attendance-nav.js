(function () {
  function getStoredRole() {
    const role = String(localStorage.getItem('myra_current_role') || '').trim().toLowerCase();
    if (role === 'lecturer') return 'lecturer';
    if (role === 'student') return 'student';
    return 'guest';
  }

  function resolveTarget(path) {
    const target = new URL(path, window.location.href);

    if (window.location.protocol === 'file:') {
      target.protocol = 'http:';
      target.host = 'localhost:3000';
      target.port = '3000';
    }

    return target.toString();
  }

  window.goToAttendancePage = function (event) {
    if (event) event.preventDefault();

    const role = getStoredRole();
    let target = '../Frontend-SignIn/Signin.html';

    if (role === 'lecturer') {
      target = '../Frontend-Attend/Lecturer.html';
    } else if (role === 'student') {
      target = '../Frontend-Attend/Attendance.html';
    }

    window.location.assign(resolveTarget(target));
  };

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('a[data-role-nav="attendance"]').forEach((link) => {
      link.addEventListener('click', (event) => window.goToAttendancePage(event));
    });
  });
})();
