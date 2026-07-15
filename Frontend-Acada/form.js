let selectedFile = null;

function injectStaticIcons() {
  document.getElementById("uploadIconCircle").innerHTML = ICONS.plus;
}

function getCurrentRole() {
  return String(localStorage.getItem('myra_current_role') || '').trim().toLowerCase();
}

function enforceLecturerAccess() {
  if (getCurrentRole() !== 'lecturer') {
    document.body.innerHTML = '<div class="app"><div class="empty-state" style="padding: 64px 20px;">Only lecturers can upload materials.</div></div>';
    return false;
  }
  return true;
}

async function populateCourses() {
  const input = document.getElementById("courseInput");
  const list = document.getElementById("courseSuggestions");
  if (!input || !list) return;

  try {
    const courses = await getCourses();
    list.innerHTML = "";
    courses.forEach((course) => {
      const option = document.createElement("option");
      option.value = course.name;
      option.textContent = course.code ? `${course.code} — ${course.name}` : course.name;
      list.appendChild(option);
    });
  } catch (error) {
    console.warn("Could not load course suggestions", error);
  }
}

function wireCategoryToggle() {
  const categorySelect = document.getElementById("categorySelect");
  const dueDateField = document.getElementById("dueDateField");

  function syncDueDateVisibility() {
    dueDateField.style.display = categorySelect.value === "assignment" ? "block" : "none";
  }

  categorySelect.addEventListener("change", syncDueDateVisibility);
  syncDueDateVisibility();
}

function wireDropzone() {
  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("fileInput");
  const filenameEl = document.getElementById("dropzoneFilename");

  dropzone.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", () => {
    if (fileInput.files[0]) {
      selectedFile = fileInput.files[0];
      filenameEl.textContent = selectedFile.name;
    }
  });

  ["dragover", "dragenter"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add("drag-over");
    })
  );

  ["dragleave", "drop"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.remove("drag-over");
    })
  );

  dropzone.addEventListener("drop", (e) => {
    const file = e.dataTransfer.files[0];
    if (file) {
      selectedFile = file;
      filenameEl.textContent = file.name;
    }
  });
}

function setFieldError(fieldId, hasError) {
  document.getElementById(fieldId).classList.toggle("error", hasError);
}

function validateForm() {
  const course = document.getElementById("courseInput").value.trim();
  const title = document.getElementById("materialTitle").value.trim();
  const desc = document.getElementById("materialDesc").value.trim();
  const category = document.getElementById("categorySelect").value;
  const dueDate = document.getElementById("dueDateInput").value.trim();

  let valid = true;

  setFieldError("courseField", !course);
  if (!course) valid = false;

  setFieldError("titleField", !title);
  if (!title) valid = false;

  setFieldError("descField", !desc);
  if (!desc) valid = false;

  if (category === "assignment") {
    const dueDateValid = /^\d{4}-\d{2}-\d{2}$/.test(dueDate) && !Number.isNaN(new Date(dueDate).getTime());
    setFieldError("dueDateField", !dueDateValid);
    if (!dueDateValid) valid = false;
  } else {
    setFieldError("dueDateField", false);
  }

  const dropzoneWrap = document.getElementById("dropzoneWrap");
  dropzoneWrap.classList.toggle("error", !selectedFile);
  if (!selectedFile) valid = false;

  return valid;
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
}

function wireCancel() {
  document.getElementById("cancelBtn").addEventListener("click", () => {
    window.location.href = "Academic.html";
  });
}

function wireSubmit() {
  const form = document.getElementById("uploadForm");
  const submitBtn = document.getElementById("submitBtn");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      showToast("Please fix the highlighted fields.");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Uploading…";

    const category = document.getElementById("categorySelect").value;

    const payload = {
      course: document.getElementById("courseInput").value.trim(),
      title: document.getElementById("materialTitle").value.trim(),
      description: document.getElementById("materialDesc").value.trim(),
      category,
      dueDate: category === "assignment" ? document.getElementById("dueDateInput").value.trim() : null,
      professor: "You", // TODO(backend): pull from the logged-in lecturer's session
    };

    try {
      await uploadMaterial(payload, selectedFile);
      showToast("Material uploaded successfully!");
      form.reset();
      selectedFile = null;
      document.getElementById("dropzoneFilename").textContent = "";
      setTimeout(() => {
        window.location.href = "Academic.html";
      }, 900);
    } catch (err) {
      showToast(err.message || "Upload failed. Try again.");
      submitBtn.disabled = false;
      submitBtn.textContent = "Upload";
    }
  });
}

async function init() {
  injectStaticIcons();
  if (!enforceLecturerAccess()) return;
  await populateCourses();
  wireCategoryToggle();
  wireDropzone();
  wireCancel();
  wireSubmit();
}

document.addEventListener("DOMContentLoaded", init);
