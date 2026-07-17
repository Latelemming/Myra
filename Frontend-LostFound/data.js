const STORAGE_KEY = 'lost-found-items';
const ACTIVITY_KEY = 'myra_recent_activities';
const API_LOSTFOUND = '/api/lostfound';

function readItems() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Could not read lost and found items from localStorage:', error);
    return [];
  }
}

function saveItems(items) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    console.warn('Could not save lost and found items to localStorage:', error);
  }
}

async function getItems() {
  try {
    const response = await fetch(API_LOSTFOUND, { credentials: 'include' });
    if (!response.ok) {
      throw new Error('Failed to fetch lost & found items');
    }

    const data = await response.json();
    if (!Array.isArray(data.items)) {
      throw new Error('Unexpected response format');
    }

    return data.items.slice().sort((a, b) => {
      const aDate = new Date(a.createdAt || a.date || 0).getTime();
      const bDate = new Date(b.createdAt || b.date || 0).getTime();
      return bDate - aDate;
    });
  } catch (error) {
    console.warn('Could not load lost & found from backend:', error);
    return readItems().slice().sort((a, b) => {
      const aDate = new Date(a.date || 0).getTime();
      const bDate = new Date(b.date || 0).getTime();
      return bDate - aDate;
    });
  }
}

function notifyHomeAboutLostFound(item) {
  try {
    const stored = window.localStorage.getItem(ACTIVITY_KEY);
    const list = stored ? JSON.parse(stored) : [];
    const entry = {
      id: `lostfound-${item.id}`,
      type: 'lostfound',
      title: 'New lost & found post',
      detail: `${item.name} was just posted in Lost & Found.`,
      href: '../Frontend-LostFound/LostFound.html',
      time: Date.now(),
    };

    const filtered = list.filter((existing) => existing.id !== entry.id);
    filtered.unshift(entry);
    window.localStorage.setItem(ACTIVITY_KEY, JSON.stringify(filtered.slice(0, 8)));
  } catch (error) {
    console.warn('Could not update home activity feed:', error);
  }
}

async function createItem(payload) {
  const formData = new FormData();
  formData.append('status', payload.status);
  formData.append('name', payload.name);
  formData.append('description', payload.description);
  formData.append('location', payload.location);
  formData.append('contact', payload.contact);
  formData.append('postedBy', payload.postedBy || 'You');
  formData.append('postedByUser', payload.postedByUser || localStorage.getItem('myra_current_user') || 'guest@myra.local');

  if (payload.imageFile) {
    formData.append('image', payload.imageFile, payload.imageFile.name);
  }

  const headers = {};
  const currentUser = localStorage.getItem('myra_current_user');
  if (currentUser) {
    headers['X-Current-User'] = currentUser;
  }

  const response = await fetch(API_LOSTFOUND, {
    method: 'POST',
    body: formData,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error((body && body.error) || 'Could not create item.');
  }

  const data = await response.json();
  if (!data.item) {
    throw new Error('Unexpected server response.');
  }

  notifyHomeAboutLostFound(data.item);
  return data.item;
}

async function deleteItem(id) {
  const currentUser = localStorage.getItem('myra_current_user') || 'guest@myra.local';
  const currentRole = localStorage.getItem('myra_current_role') || 'guest';
  const response = await fetch(`${API_LOSTFOUND}/${id}`, {
    method: 'DELETE',
    headers: {
      'X-Current-User': currentUser,
      'X-Current-Role': currentRole,
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error((body && body.error) || 'Could not delete item.');
  }

  return true;
}

function formatDate(isoDate) {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
