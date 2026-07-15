
function injectStaticIcons() {
  document.getElementById("backIcon").innerHTML = ICONS.chevronLeft;
  document.getElementById("addImageIcon").innerHTML = ICONS.plus;
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

let selectedImageFile = null;

function wireImagePicker() {
  const addBtn = document.getElementById("addImageBtn");
  const input = document.getElementById("imageInput");
  const preview = document.getElementById("imagePreview");
  const previewImg = document.getElementById("imagePreviewImg");
  const removeBtn = document.getElementById("removeImage");

  addBtn.addEventListener("click", () => input.click());

  input.addEventListener("change", () => {
    const file = input.files[0];
    if (!file) return;
    selectedImageFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImg.src = e.target.result;
      preview.style.display = "block";
    };
    reader.readAsDataURL(file);
  });

  removeBtn.addEventListener("click", () => {
    selectedImageFile = null;
    input.value = "";
    preview.style.display = "none";
    previewImg.src = "";
  });
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
    if (!validateForm()) {
      showToast("Please fix the highlighted fields.");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Posting…";

    const payload = {
      status: document.getElementById("statusSelect").value,
      name: document.getElementById("itemName").value.trim(),
      description: document.getElementById("itemDesc").value.trim(),
      location: document.getElementById("itemLocation").value.trim(),
      contact: document.getElementById("itemContact").value.trim(),
      postedBy: "You",
      image: selectedImageFile ? selectedImageFile.name : null,
    };

    try {
      await createItem(payload);
      showToast("Item posted successfully!");
      form.reset();
      document.getElementById("statusSelect").value = "lost";
      document.getElementById("imagePreview").style.display = "none";
      document.getElementById("imagePreviewImg").src = "";
      selectedImageFile = null;
      setTimeout(() => {
        window.location.href = "LostFound.html";
      }, 900);
    } catch (err) {
      showToast("Something went wrong. Try again.");
      submitBtn.disabled = false;
      submitBtn.textContent = "Post item";
    }
  });
}

function init() {
  injectStaticIcons();
  wireStatusControls();
  wireImagePicker();
  wireSubmit();
}

document.addEventListener("DOMContentLoaded", init);
