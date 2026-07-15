let allItems = [];
let activeFilter = "all";
let searchTerm = "";

function injectStaticIcons() {
  document.getElementById("postIcon").innerHTML = ICONS.plus;
  document.getElementById("menuIcon").innerHTML = ICONS.menu;
  document.getElementById("searchIcon").innerHTML = ICONS.search;
}

function cardTemplate(item) {
  const isLost = item.status === "lost";
  const statusLabel = isLost ? "LOST" : "FOUND";
  const statusClass = isLost ? "is-lost" : "is-found";
  const currentUser = localStorage.getItem("myra_current_user") || "";
  const currentRole = localStorage.getItem("myra_current_role") || "";
  const isOwnPost = item.postedBy === currentUser || item.postedBy === "You";
  const canClaim = isOwnPost && currentRole !== "lecturer";

  return `
    <article class="card" data-id="${item.id}">
      <div class="card-top">
        <div class="tag-icon ${statusClass}">${ICONS.tag}</div>
        <div class="card-body">
          <div class="card-title-row">
            <h2 class="card-title">${escapeHtml(item.name)}</h2>
            <span class="status-badge ${statusClass}">${statusLabel}</span>
          </div>
          <p class="card-desc">${escapeHtml(item.description)}</p>
          <div class="meta-row">${ICONS.pin}<span>${escapeHtml(item.location)}</span></div>
          <div class="meta-row">${ICONS.calendar}<span>${formatDate(item.date)}</span></div>
          <div class="meta-row posted-by">${ICONS.person}<span>Posted by ${escapeHtml(item.postedBy)}</span></div>
        </div>
      </div>
      <div class="card-actions">
        <a class="contact-btn" href="tel:${item.contact}">${ICONS.phone} Contact</a>
        ${canClaim ? `<button class="claim-btn" type="button" data-id="${item.id}">Claimed</button>` : ""}
      </div>
    </article>
  `;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function renderItems() {
  const listEl = document.getElementById("itemList");
  const term = searchTerm.trim().toLowerCase();

  const filtered = allItems.filter((item) => {
    const matchesFilter = activeFilter === "all" || item.status === activeFilter;
    const matchesSearch =
      !term ||
      item.name.toLowerCase().includes(term) ||
      item.location.toLowerCase().includes(term) ||
      item.description.toLowerCase().includes(term);
    return matchesFilter && matchesSearch;
  });

  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        ${ICONS.inbox}
        <p>No items match your search.</p>
      </div>`;
    return;
  }

  listEl.innerHTML = filtered.map(cardTemplate).join("");
}

function wireFilters() {
  const filtersEl = document.getElementById("filters");
  filtersEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    activeFilter = btn.dataset.filter;
    [...filtersEl.children].forEach((c) => c.classList.remove("active"));
    btn.classList.add("active");
    renderItems();
  });
}

function wireSearch() {
  const input = document.getElementById("searchInput");
  input.addEventListener("input", (e) => {
    searchTerm = e.target.value;
    renderItems();
  });
}

function wireItemActions() {
  const listEl = document.getElementById("itemList");

  listEl.addEventListener("click", async (e) => {
    const btn = e.target.closest(".claim-btn");
    if (!btn) return;

    const itemId = Number(btn.dataset.id);
    const item = allItems.find((entry) => entry.id === itemId);

    const currentUser = localStorage.getItem("myra_current_user") || "";
    const currentRole = localStorage.getItem("myra_current_role") || "";

    if (!item || (item.postedBy !== currentUser && item.postedBy !== "You") || currentRole === "lecturer") return;

    const confirmed = window.confirm("Mark this item as claimed and remove it from the system?");
    if (!confirmed) return;

    await deleteItem(itemId);
    allItems = await getItems();
    renderItems();
  });
}

async function init() {
  injectStaticIcons();
  wireFilters();
  wireSearch();
  wireItemActions();
  allItems = await getItems();
  renderItems();

  if (allItems.length) {
    const latest = allItems[0];
    notifyHomeAboutLostFound(latest);
  }

  window.addEventListener("storage", async () => {
    allItems = await getItems();
    renderItems();
  });
}

document.addEventListener("DOMContentLoaded", init);
