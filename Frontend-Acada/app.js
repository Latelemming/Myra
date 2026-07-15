let allMaterials = [];
let activeFilter = "all";
let searchTerm = "";

function injectStaticIcons() {
  document.getElementById("uploadIcon").innerHTML = ICONS.upload;
  document.getElementById("searchIcon").innerHTML = ICONS.search;
}

function getCurrentRole() {
  return String(localStorage.getItem('myra_current_role') || '').trim().toLowerCase();
}

function applyRoleAccess() {
  const uploadBtn = document.getElementById('uploadBtn');
  if (!uploadBtn) return;

  const isLecturer = getCurrentRole() === 'lecturer';
  uploadBtn.style.display = isLecturer ? 'inline-flex' : 'none';
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function materialCardTemplate(item) {
  const isAssignment = item.category === "assignment";
  const badgeClass = isAssignment ? "is-assignment" : "is-lecture";
  const badgeLabel = isAssignment ? "ASSIGNMENT" : "LECTURE MATERIAL";
  const isLecturer = getCurrentRole() === "lecturer";

  const dueRow =
    isAssignment && item.dueDate
      ? `<div class="due-row">${ICONS.calendar}<span>Due: ${formatDate(item.dueDate)}</span></div>`
      : "";

  const deleteButton = isLecturer
    ? `<button class="delete-btn" data-id="${item.id}">Delete</button>`
    : "";

  return `
    <article class="material-card" data-id="${item.id}">
      <div class="material-top">
        <div class="file-icon">
          ${ICONS.doc}
          <span class="file-type-tag">${escapeHtml(item.fileType)}</span>
        </div>
        <div class="material-body">
          <h2 class="material-title">${escapeHtml(item.title)}</h2>
          <p class="material-subtitle">${escapeHtml(item.course)} by ${escapeHtml(item.professor)}</p>
          <span class="category-badge ${badgeClass}">${badgeLabel}</span>
          ${dueRow}
        </div>
      </div>
      <div class="material-footer">
        ${deleteButton}
        <button class="download-btn" data-id="${item.id}">
          Download ${ICONS.download}
        </button>
      </div>
    </article>
  `;
}

function renderMaterials() {
  const listEl = document.getElementById("materialList");
  const term = searchTerm.trim().toLowerCase();

  const filtered = allMaterials.filter((item) => {
    const matchesFilter = activeFilter === "all" || item.category === activeFilter;
    const matchesSearch =
      !term ||
      item.title.toLowerCase().includes(term) ||
      item.course.toLowerCase().includes(term) ||
      item.professor.toLowerCase().includes(term);
    return matchesFilter && matchesSearch;
  });

  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        ${ICONS.inbox}
        <p>No materials match your search.</p>
      </div>`;
    return;
  }

  listEl.innerHTML = filtered.map(materialCardTemplate).join("");
}

function wireTabs() {
  const tabsEl = document.getElementById("tabs");
  tabsEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".tab");
    if (!btn) return;
    activeFilter = btn.dataset.filter;
    [...tabsEl.children].forEach((c) => c.classList.remove("active"));
    btn.classList.add("active");
    renderMaterials();
  });
}

function wireSearch() {
  const input = document.getElementById("searchInput");
  input.addEventListener("input", (e) => {
    searchTerm = e.target.value;
    renderMaterials();
  });
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
}

function wireMaterialActions() {
  const listEl = document.getElementById("materialList");
  listEl.addEventListener("click", async (e) => {
    const downloadBtn = e.target.closest(".download-btn");
    if (downloadBtn) {
      const id = downloadBtn.dataset.id;
      try {
        const anchor = document.createElement("a");
        anchor.href = `/api/materials/${id}/download`;
        anchor.download = "";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        showToast("Download started.");
      } catch (error) {
        showToast("Download failed. Please try again.");
      }
      return;
    }

    const deleteBtn = e.target.closest(".delete-btn");
    if (!deleteBtn) return;

    const id = deleteBtn.dataset.id;
    deleteBtn.disabled = true;
    deleteBtn.textContent = "Deleting…";

    try {
      await deleteMaterial(id);
      showToast("Material deleted.");
      allMaterials = await getMaterials();
      renderMaterials();
    } catch (error) {
      showToast(error.message || "Delete failed. Please try again.");
      deleteBtn.disabled = false;
      deleteBtn.textContent = "Delete";
    }
  });
}

async function init() {
  injectStaticIcons();
  applyRoleAccess();
  wireTabs();
  wireSearch();
  wireMaterialActions();
  allMaterials = await getMaterials();
  renderMaterials();
}

document.addEventListener("DOMContentLoaded", init);
