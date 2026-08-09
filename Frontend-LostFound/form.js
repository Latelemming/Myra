function injectStaticIcons() {
  document.getElementById("backIcon").innerHTML = ICONS.chevronLeft;
}

function wireStatusControls() {
  const select = document.getElementById("statusSelect");
  const toggleBtns = document.querySelectorAll("#statusToggleFloat button");

  function setStatus(status) {
    select.value = status;
    toggleBtns.forEach((b) => b.classList.toggle("selected", b.dataset.status === status));
  }

  toggleBtns.forEach((btn) => {
    btn.addEventListener("click", () => setStatus(btn.dataset.status));
  });

  select.addEventListener("change", () => setStatus(select.value));
}

// Accepts +233XXXXXXXXX or 0XXXXXXXXX (Ghana numbers)
function isValidGhanaPhone(value) {
  const cleaned = value.replace(/\s+/g, "");
  return /^(\+233\d{9}|0\d{9})$/.test(cleaned);
}

function setFieldError(fieldId, hasError) {
  document.getElementById(fieldId).classList.toggle("error", hasError);
}

function validateForm() {
  const name = document.getElementById("itemName").value.trim();
  const desc = document.getElementById("itemDesc").value.trim();
  const location = document.getElementById("itemLocation").value.trim();
  const contact = document.getElementById("itemContact").value.trim();
  const status = document.getElementById("statusSelect").value;
  const imageEl = document.getElementById('itemImage');
  const imageFile = imageEl && imageEl.files && imageEl.files[0] ? imageEl.files[0] : null;

  let valid = true;

  setFieldError("statusField", !status);
  if (!status) valid = false;

  setFieldError("nameField", !name);
  if (!name) valid = false;

  setFieldError("descField", !desc);
  if (!desc) valid = false;

  setFieldError("locationField", !location);
  if (!location) valid = false;

  const contactValid = isValidGhanaPhone(contact);
  setFieldError("contactField", !contactValid);
  if (!contactValid) valid = false;

  // Validate image if provided: must be an image and <= 5MB
  if (imageFile) {
    const allowed = imageFile.type && imageFile.type.startsWith('image/');
    const maxSize = 5 * 1024 * 1024; // 5MB
    const sizeOk = imageFile.size <= maxSize;
    setFieldError('imageField', !(allowed && sizeOk));
    if (!allowed || !sizeOk) valid = false;
  } else {
    setFieldError('imageField', false);
  }

  return valid;
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
}

function wireSubmit() {
  const form = document.getElementById("postForm");
  const submitBtn = document.getElementById("submitBtn");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    // Prevent guests from posting — require sign in
    const currentRole = String(localStorage.getItem('myra_current_role') || 'guest').toLowerCase();
    if (currentRole === 'guest') {
      showToast('Please sign in to post. Redirecting...');
      setTimeout(() => window.location.href = '../Frontend-SignIn/Signin.html', 700);
      return;
    }

    if (!validateForm()) {
      showToast("Please fix the highlighted fields.");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Posting…";

    const imageEl = document.getElementById('itemImage');
    const imageFile = imageEl && imageEl.files && imageEl.files[0] ? imageEl.files[0] : null;

    const payload = {
      status: document.getElementById('statusSelect').value,
      name: document.getElementById('itemName').value.trim(),
      description: document.getElementById('itemDesc').value.trim(),
      location: document.getElementById('itemLocation').value.trim(),
      contact: document.getElementById('itemContact').value.trim(),
      postedBy: localStorage.getItem('myra_current_user_name') || 'You',
      postedByUser: localStorage.getItem('myra_current_user') || 'guest@myra.local',
      imageFile,
    };

    try {
      await createItem(payload);
      showToast("Item posted successfully!");
      form.reset();
      document.getElementById("statusSelect").value = "lost";
      setTimeout(() => {
        window.location.href = "LostFound.html";
      }, 900);
    } catch (err) {
      const message = err?.message || 'Something went wrong. Try again.';
      showToast(message);
      submitBtn.disabled = false;
      submitBtn.textContent = "Post item";
      if (err?.status === 401) {
        setTimeout(() => {
          window.location.href = '../Frontend-SignIn/Signin.html';
        }, 1200);
      }
    }
  });
}

function init() {
  injectStaticIcons();
  wireStatusControls();
  wireSubmit();
}

document.addEventListener("DOMContentLoaded", init);
