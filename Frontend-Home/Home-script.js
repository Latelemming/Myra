const visitKey = 'frontendHomeVisitedPages';
const activityStorageKey = 'myra_recent_activities';

function safeNavigate(path) {
  const target = new URL(path, window.location.href);

  if (window.location.protocol === 'file:') {
    target.protocol = 'http:';
    target.host = 'localhost:3000';
    target.port = '3000';
  }

  window.location.assign(target.toString());
}

function getPageTitle() {
  return document.body.dataset.pageTitle || document.title || 'Home';
}

function getGreetingPrefix(hour) {
  if (hour < 12) return 'Good Morning';
  if (hour < 18) return 'Good Afternoon';
  return 'Good Evening';
}

function getStoredUserDetails() {
  return {
    role: String(localStorage.getItem('myra_current_role') || '').toLowerCase(),
    fullName: localStorage.getItem('myra_current_user_name') || '',
    programme: localStorage.getItem('myra_current_programme') || '',
    level: localStorage.getItem('myra_current_level') || ''
  };
}

function loadActivities() {
  const stored = localStorage.getItem(activityStorageKey);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length) {
        return parsed.sort((a, b) => b.time - a.time);
      }
    } catch {}
  }

  return [];
}

function saveActivities(items) {
  localStorage.setItem(activityStorageKey, JSON.stringify(items.slice(0, 8)));
}

function recordActivity({ type = 'visit', title, detail, href }) {
  const stored = loadActivities();
  const entry = {
    id: `${type}-${Date.now()}`,
    type,
    title,
    detail,
    href: href || '#',
    time: Date.now()
  };

  const existing = stored.filter((item) => item.title === entry.title && item.detail === entry.detail);
  if (!existing.length) {
    stored.unshift(entry);
    saveActivities(stored);
  }

  return entry;
}

function getCurrentPageActivity() {
  const path = window.location.pathname;
  const pageMap = {
    'Home.html': { title: 'Opened Home dashboard', detail: 'You are back on the main dashboard.', href: 'Home.html' },
    'Forum.html': { title: 'Opened Forum', detail: 'You checked the latest campus conversations.', href: '../Frontend-Forum/Forum.html' },
    'LostFound.html': { title: 'Opened Lost & Found', detail: 'You explored the latest campus posts.', href: '../Frontend-LostFound/LostFound.html' },
    'Academic.html': { title: 'Opened Academic materials', detail: 'You reviewed available study resources.', href: '../Frontend-Acada/Academic.html' },
    'Attendance.html': { title: 'Opened Attendance', detail: 'You checked the attendance section.', href: '../Frontend-Attend/Attendance.html' },
    'map.html': { title: 'Opened Campus map', detail: 'You viewed the campus locations.', href: '../Frontend-Map/map.html' },
    'AI.html': { title: 'Opened Study Assistant', detail: 'You opened the AI study helper.', href: '../Frontend-StudyAss/AI.html' }
  };

  const pageName = path.split('/').pop();
  const match = pageMap[pageName] || pageMap['Home.html'];
  return {
    type: 'visit',
    ...match
  };
}

function formatActivityTime(time) {
  const diff = Date.now() - time;
  const minutes = Math.max(1, Math.floor(diff / (1000 * 60)));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function renderRecentActivities() {
  const container = document.getElementById('recentList');
  if (!container) return;

  const activities = loadActivities().slice(0, 5);
  if (!activities.length) {
    container.innerHTML = '<p class="empty-state">No recent activity yet. Explore MYRA to start building your feed.</p>';
    return;
  }

  container.innerHTML = activities.map((activity) => `
    <a class="recent-item" href="${activity.href}">
      <span class="activity-icon">${activity.type === 'visit' ? '🧭' : '✨'}</span>
      <span class="activity-copy">
        <strong class="activity-title">${activity.title}</strong>
        <p class="activity-detail">${activity.detail}</p>
      </span>
      <span class="timestamp">${formatActivityTime(activity.time)}</span>
    </a>
  `).join('');
}

function renderNotifications() {
  const list = document.getElementById('notificationsList');
  if (!list) return;

  const activities = loadActivities().slice(0, 4);
  if (!activities.length) {
    list.innerHTML = '<div class="notification-item"><strong>No new updates</strong><span>Your recent activity will show up here.</span></div>';
    return;
  }

  list.innerHTML = activities.map((activity) => `
    <div class="notification-item">
      <strong>${activity.title}</strong>
      <span>${activity.detail}</span>
    </div>
  `).join('');
}

function updateNotificationBadge() {
  const badge = document.getElementById('notificationBadge');
  if (!badge) return;
  const activities = loadActivities();
  badge.textContent = Math.min(activities.length, 9);
}

function setGreeting(user) {
  const greeting = document.getElementById('greetingText');
  const details = document.getElementById('userDetailsText');
  const profileButton = document.getElementById('profileButton');
  const profileNameLabel = document.getElementById('profileNameLabel');
  const profileRoleLabel = document.getElementById('profileRoleLabel');
  if (!greeting) return;

  const stored = getStoredUserDetails();
  const role = String(user?.role || stored.role || '').toLowerCase();
  const name = user?.fullName || user?.name || stored.fullName || 'there';
  const programme = user?.programme || stored.programme || '';
  const level = user?.level || stored.level || '';
  const firstName = String(name).trim().split(/\s+/)[0] || 'U';
  const avatarLetter = firstName.charAt(0).toUpperCase();
  const greetingName = role === 'lecturer' ? 'Lecturer' : firstName;
  const greetingPrefix = getGreetingPrefix(new Date().getHours());
  const lecturerTag = role === 'lecturer' ? 'Academic Lead · Faculty Desk' : '';

  greeting.textContent = `${greetingPrefix}, ${greetingName}!`;
  if (details) {
    const detailText = role === 'lecturer'
      ? lecturerTag || 'Academic Lead · Faculty Desk'
      : [programme, level].filter(Boolean).join(' · ') || 'Student · Ready to learn';
    details.textContent = detailText;
  }
  if (profileButton) {
    profileButton.textContent = avatarLetter;
  }
  if (profileNameLabel) {
    profileNameLabel.textContent = name || 'Guest';
  }
  if (profileRoleLabel) {
    profileRoleLabel.textContent = role === 'lecturer' ? 'Lecturer' : (programme ? programme : 'Student');
  }
}

async function parseResponsePayload(response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

function logout() {
  localStorage.removeItem('myra_current_role');
  localStorage.removeItem('myra_current_user');
  localStorage.removeItem('myra_current_user_name');
  localStorage.removeItem('myra_current_programme');
  localStorage.removeItem('myra_current_level');

  safeNavigate('../Frontend-Splash/Splash.html');
}

document.addEventListener('DOMContentLoaded', async () => {
  const storedUser = getStoredUserDetails();
  const storedRole = storedUser.role;
  const storedName = storedUser.fullName;

  recordActivity(getCurrentPageActivity());
  renderRecentActivities();
  renderNotifications();
  updateNotificationBadge();

  const profileButton = document.getElementById('profileButton');
  const profileMenu = document.getElementById('profileMenu');
  const notificationsButton = document.getElementById('notificationsButton');
  const notificationsPanel = document.getElementById('notificationsPanel');
  const logoutButton = document.getElementById('logoutButton');
  const profileViewButton = document.getElementById('profileViewButton');

  if (profileButton && profileMenu) {
    profileButton.addEventListener('click', () => {
      const shouldShow = profileMenu.hidden;
      profileMenu.hidden = !shouldShow;
      if (!shouldShow) {
        notificationsPanel.hidden = true;
      }
    });
  }

  if (notificationsButton && notificationsPanel) {
    notificationsButton.addEventListener('click', () => {
      const shouldShow = notificationsPanel.hidden;
      notificationsPanel.hidden = !shouldShow;
      if (!shouldShow) {
        profileMenu.hidden = true;
        const badge = document.getElementById('notificationBadge');
        if (badge) {
          badge.textContent = '0';
        }
      }
      if (shouldShow) {
        renderNotifications();
      }
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener('click', logout);
  }

  if (profileViewButton) {
    profileViewButton.addEventListener('click', () => {
      profileMenu.hidden = true;
      recordActivity({
        type: 'visit',
        title: 'Viewed profile overview',
        detail: 'You opened your profile snapshot from the dashboard.',
        href: 'Home.html'
      });
      renderRecentActivities();
      renderNotifications();
      updateNotificationBadge();
    });
  }

  document.addEventListener('click', (event) => {
    const inProfile = event.target.closest('.profile-menu-wrap');
    const inNotifications = event.target.closest('.dropdown-wrap');
    if (!profileMenu || profileMenu.hidden) {
      if (!inNotifications && notificationsPanel && !notificationsPanel.hidden) {
        notificationsPanel.hidden = true;
      }
    } else if (!inProfile) {
      profileMenu.hidden = true;
    }
    if (!inNotifications && notificationsPanel && !notificationsPanel.hidden) {
      notificationsPanel.hidden = true;
    }
  });

  document.querySelectorAll('.nav-item, .bottom-link').forEach((link) => {
    link.addEventListener('click', () => {
      const href = link.getAttribute('href') || '';
      const pageTitle = link.textContent?.trim() || 'MYRA page';
      const destination = href.includes('Forum') ? 'Forum' : href.includes('LostFound') ? 'Lost & Found' : href.includes('Academic') ? 'Academic materials' : href.includes('Attendance') ? 'Attendance' : href.includes('map') ? 'Campus map' : href.includes('AI') ? 'Study Assistant' : 'Home dashboard';
      recordActivity({
        type: 'visit',
        title: `Opened ${destination}`,
        detail: `You opened ${pageTitle.trim()} from the dashboard.`,
        href
      });
      renderRecentActivities();
      renderNotifications();
      updateNotificationBadge();
    });
  });

  if (storedRole === 'guest') {
    setGreeting({ fullName: storedName || 'Guest', role: 'guest' });
    return;
  }

  try {
    const response = await fetch('/api/me', { credentials: 'include' });
    const result = await parseResponsePayload(response);

    if (!response.ok || !result.user) {
      setGreeting({ fullName: storedName || 'Guest', role: storedRole || 'student', programme: localStorage.getItem('myra_current_programme') || '', level: localStorage.getItem('myra_current_level') || '' });
      return;
    }

    setGreeting(result.user);
  } catch (error) {
    setGreeting({ fullName: storedName || 'Guest', role: storedRole || 'student', programme: localStorage.getItem('myra_current_programme') || '', level: localStorage.getItem('myra_current_level') || '' });
  }
});
