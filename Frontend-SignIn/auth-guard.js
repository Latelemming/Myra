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
        redirectToSignin();
      }
    })
    .catch(() => {
      redirectToSignin();
    });
})();
