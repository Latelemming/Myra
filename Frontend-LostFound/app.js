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
  const isOwnPost = item.postedByUser === currentUser || item.postedBy === currentUser || item.postedBy === "You";
  const canClaim = isOwnPost;

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
        <button class="view-btn" type="button" data-id="${item.id}">${ICONS.image} View</button>
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
  const input = document.getElementById('searchInput');
  input.addEventListener('input', (e) => {
    searchTerm = e.target.value;
    renderItems();
  });
}

function buildItemModal(item) {
  return `
    <div class="item-modal" id="itemModal" aria-hidden="false">
      <div class="modal-backdrop" data-close="true"></div>
      <div class="modal-card">
        <button class="modal-close" id="modalCloseBtn">&times;</button>
        ${item.imageUrl ? `<img class="modal-image" src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}" />` : `<div class="modal-image placeholder">No image available</div>`}
        <div class="modal-detail">
          <h2>${escapeHtml(item.name)}</h2>
          <span class="status-badge ${item.status === 'lost' ? 'is-lost' : 'is-found'}">${item.status.toUpperCase()}</span>
          <p>${escapeHtml(item.description)}</p>
          <div class="meta-row">${ICONS.pin}<span>${escapeHtml(item.location)}</span></div>
          <div class="meta-row">${ICONS.calendar}<span>${formatDate(item.date)}</span></div>
          <div class="meta-row posted-by">${ICONS.person}<span>Posted by ${escapeHtml(item.postedBy)}</span></div>
          <div class="meta-row">${ICONS.phone}<span>Contact: ${escapeHtml(item.contact)}</span></div>
        </div>
      </div>
    </div>
  `;
}

function openItemModal(item) {
  closeItemModal();
  const modalWrapper = document.createElement('div');
  modalWrapper.innerHTML = buildItemModal(item);
  document.body.appendChild(modalWrapper.firstElementChild);

  const closeButton = document.getElementById('modalCloseBtn');
  closeButton?.addEventListener('click', closeItemModal);
  document.querySelector('.modal-backdrop')?.addEventListener('click', closeItemModal);

  const modalImage = document.querySelector('.modal-image');
  if (modalImage && !modalImage.classList.contains('placeholder')) {
    modalImage.style.cursor = 'zoom-in';
    modalImage.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleImageZoom(modalImage);
    });
  }
}

function toggleImageZoom(img) {
  if (img.classList.contains('zoomed')) {
    img.classList.remove('zoomed');
  } else {
    img.classList.add('zoomed');
  }
}

function closeItemModal() {
  const modal = document.getElementById('itemModal');
  modal?.remove();
}

function wireItemActions() {
  const listEl = document.getElementById('itemList');

  listEl.addEventListener('click', async (e) => {
    const viewBtn = e.target.closest('.view-btn');
    if (viewBtn) {
      const itemId = viewBtn.dataset.id;
      const item = allItems.find((entry) => String(entry.id) === itemId);
      if (item) {
        openItemModal(item);
      }
      return;
    }

    const btn = e.target.closest('.claim-btn');
    if (!btn) return;

    const itemId = btn.dataset.id;
    const item = allItems.find((entry) => String(entry.id) === itemId);

    const currentUser = localStorage.getItem('myra_current_user') || '';
    const currentRole = localStorage.getItem('myra_current_role') || '';

    if (!item) return;

    const isOwner = item.postedByUser === currentUser || item.postedBy === currentUser || item.postedBy === 'You';
    if (!isOwner) {
      window.alert('Only the user who posted this item can mark it as claimed.');
      return;
    }

    if (currentRole === 'guest') {
      const shouldSignIn = window.confirm('You need to sign in to claim this item. Would you like to sign in now?');
      if (shouldSignIn) {
        window.location.href = '../Frontend-SignIn/Signin.html';
      }
      return;
    }

    const confirmed = window.confirm('Mark this item as claimed and remove it from the system?');
    if (!confirmed) return;

    try {
      await deleteItem(itemId);
      allItems = await getItems();
      renderItems();
    } catch (err) {
      window.alert('Failed to remove item: ' + (err.message || 'unknown error'));
    }
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

  window.addEventListener('storage', async () => {
    allItems = await getItems();
    renderItems();
  });

  window.addEventListener('focus', async () => {
    allItems = await getItems();
    renderItems();
  });

  setInterval(async () => {
    allItems = await getItems();
    renderItems();
  }, 12000);
}

document.addEventListener("DOMContentLoaded", init);
