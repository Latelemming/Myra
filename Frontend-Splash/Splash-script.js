const roleCards = Array.from(document.querySelectorAll('.role-card'));
const continueBtn = document.getElementById('continueBtn');

function safeNavigate(path) {
  const target = new URL(path, window.location.href);

  if (window.location.protocol === 'file:') {
    target.protocol = 'http:';
    target.host = 'localhost:3000';
    target.port = '3000';
  }

  window.location.assign(target.toString());
}

const roleLabel = {
  student: 'Student',
  lecturer: 'Lecturer'
};

const setSelectedRole = (role) => {
  roleCards.forEach((card) => {
    const isSelected = card.dataset.role === role;
    card.classList.toggle('selected', isSelected);
    card.setAttribute('aria-checked', isSelected ? 'true' : 'false');
  });

  continueBtn.classList.add('show');
  continueBtn.textContent = `Continue as ${roleLabel[role]}`;
};

roleCards.forEach((card) => {
  card.addEventListener('click', () => setSelectedRole(card.dataset.role));

  card.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setSelectedRole(card.dataset.role);
    }
  });
});

continueBtn.addEventListener('click', () => {
  const role = continueBtn.textContent.includes('Lecturer') ? 'lecturer' : 'student';
  safeNavigate(`../Frontend-SignIn/Signin.html?role=${role}`);
});

setSelectedRole('student');