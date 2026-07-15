const STORAGE_KEY = "lost-found-items";
const LEGACY_DEMO_NAMES = ["Umbrella", "Cute Hat", "iPhone 17"];
const ACTIVITY_KEY = "myra_recent_activities";

function readItems() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Could not read lost and found items:", error);
    return [];
  }
}

function saveItems(items) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    console.warn("Could not save lost and found items:", error);
  }
}

async function getItems() {
  const items = readItems();
  const hasLegacyDemoItems = items.some((item) => LEGACY_DEMO_NAMES.includes(item.name));

  if (hasLegacyDemoItems) {
    saveItems([]);
    return Promise.resolve([]);
  }

  return Promise.resolve(
    items.slice().sort((a, b) => {
      const aDate = new Date(a.date || 0).getTime();
      const bDate = new Date(b.date || 0).getTime();
      return bDate - aDate;
    })
  );
}

function notifyHomeAboutLostFound(item) {
  try {
    const stored = window.localStorage.getItem(ACTIVITY_KEY);
    const list = stored ? JSON.parse(stored) : [];
    const entry = {
      id: `lostfound-${item.id}`,
      type: "lostfound",
      title: "New lost & found post",
      detail: `${item.name} was just posted in Lost & Found.`,
      href: "../Frontend-LostFound/LostFound.html",
      time: Date.now(),
    };

    const filtered = list.filter((existing) => existing.id !== entry.id);
    filtered.unshift(entry);
    window.localStorage.setItem(ACTIVITY_KEY, JSON.stringify(filtered.slice(0, 8)));
  } catch (error) {
    console.warn("Could not update home activity feed:", error);
  }
}

async function createItem(payload) {
  const item = {
    id: Date.now(),
    date: new Date().toISOString().slice(0, 10),
    ...payload,
  };

  const items = [item, ...readItems()];
  saveItems(items);
  notifyHomeAboutLostFound(item);
  return Promise.resolve(item);
}

async function deleteItem(id) {
  const items = readItems().filter((item) => item.id !== Number(id));
  saveItems(items);
  return Promise.resolve(true);
}

function formatDate(isoDate) {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
