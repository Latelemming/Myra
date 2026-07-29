(function () {
  const redirectToSignin = () => {
    const target = new URL('../Frontend-SignIn/Signin.html', window.location.href);

    if (window.location.protocol === 'file:') {
      target.protocol = 'http:';
      target.host = 'localhost:3000';
      target.port = '3000';
    }

    window.location.replace(target.toString());
  };

  fetch('/api/me', { credentials: 'include' })
    .then((response) => {
      if (!response.ok) {
        // If server is down or session expired, allow localStorage-stored
        // user details to keep the user signed in locally. Only redirect
        // to the signin page when no stored user info exists.
        const storedUser = localStorage.getItem('myra_current_user');
        const storedRole = localStorage.getItem('myra_current_role');
        if (!storedUser || !storedRole) {
          redirectToSignin();
        }
      }
    })
    .catch(() => {
      const storedUser = localStorage.getItem('myra_current_user');
      const storedRole = localStorage.getItem('myra_current_role');
      if (!storedUser || !storedRole) {
        redirectToSignin();
      }
    });
})();
