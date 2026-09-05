// Next-lesson notifications: in-page banner + browser/OS pop-up notifications.
// The schedule is weekly-recurring (same lessons every week), so we compute
// today's lessons from scheduleData. This logic is built to be PWA-friendly:
// the same data/shape can be reused by a service worker for background push
// when this is wrapped into a mobile/web app later.

(function () {
  'use strict';

  const state = {
    permission: Notification && 'permission' in Notification ? Notification.permission : 'unsupported',
    leadMin: 10,
    notified: new Set() // keys like "1-13:55" (day-startMin) to avoid duplicates
  };

  let els = {};

  function initElements() {
    els.bellBtn = document.getElementById('notif-bell');
    els.leadSelect = document.getElementById('notif-lead');
    els.banner = document.getElementById('next-lesson-banner');
    els.toast = document.getElementById('notification-toast');
  }

  // JS getDay(): Sunday=0, Monday=1 ... Saturday=6.
  // Our data uses Monday=1 ... Friday=5. Returns [] on weekends.
  function getTodayLessons() {
    const jsDay = new Date().getDay();
    const dayMap = { 0: 0, 6: 0 }; // weekend -> no lessons
    const dayIndex = dayMap[jsDay] !== undefined ? dayMap[jsDay] : jsDay;
    if (dayIndex === 0) return [];
    return getScheduleForDay(dayIndex).map(cls => {
      const { start, end } = parseTimeRange(cls.time);
      const color = categoryColors[cls.category] || '#64748b';
      return { ...cls, startMin: start, endMin: end, color };
    });
  }

  function getNextLesson(lessons, nowMin) {
    return lessons
      .filter(l => l.startMin > nowMin)
      .sort((a, b) => a.startMin - b.startMin)[0] || null;
  }

  function formatTime(min) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  function lessonsLeftToday(lessons, nowMin) {
    return lessons.some(l => l.endMin > nowMin);
  }

  function updateBanner() {
    if (!els.banner) return;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const lessons = getTodayLessons();
    const next = getNextLesson(lessons, nowMin);

    if (!next || !lessonsLeftToday(lessons, nowMin)) {
      els.banner.style.display = 'none';
      return;
    }

    const minsTo = next.startMin - nowMin;
    const teacher = next.teacher ? ` · ${next.teacher}` : '';
    els.banner.style.background = next.color;
    els.banner.innerHTML = `
      <span class="nb-icon">🔔</span>
      <span class="nb-text">
        Nästa lektion: <strong>${escapeHtml(next.subject)}</strong>
        kl. ${formatTime(next.startMin)}${escapeHtml(teacher)}
        ${minsTo > 0 ? ` <span class="nb-countdown">(om ${minsTo} min)</span>` : ''}
      </span>
    `;
    els.banner.style.display = 'flex';
  }

  function checkAndNotify() {
    if (state.permission !== 'granted') return;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const lessons = getTodayLessons();

    lessons.forEach(l => {
      const fireWindow = nowMin >= l.startMin - state.leadMin && nowMin < l.startMin;
      const key = `${l.day}-${l.startMin}`;
      if (fireWindow && !state.notified.has(key)) {
        state.notified.add(key);
        const minutesRemaining = l.startMin - nowMin;
        const body = `${l.subject} börjar kl. ${formatTime(l.startMin)}${l.teacher ? ' med ' + l.teacher : ''} (om ${minutesRemaining} min)`;
        try {
          new Notification(`${l.subject} börjar snart`, {
            body,
            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📅</text></svg>'
          });
        } catch (e) {
          // Notification constructor failed (e.g. some mobile browsers) - ignore.
        }
      }
    });
  }

  function showToast(message, isError) {
    if (!els.toast) return;
    els.toast.textContent = message;
    els.toast.classList.toggle('toast-error', !!isError);
    els.toast.classList.add('show');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => els.toast.classList.remove('show'), 4000);
  }

  function updateBellState() {
    if (!els.bellBtn) return;
    const granted = state.permission === 'granted';
    els.bellBtn.classList.toggle('active', granted);
    els.bellBtn.setAttribute('aria-pressed', granted);
  }

  async function requestNotificationPermission() {
    if (!('Notification' in window)) {
      showToast('Den här webbläsaren stöder inte notiser.', true);
      return;
    }
    if (state.permission === 'denied') {
      showToast('Notiser är avstängda i webbläsarens inställningar.', true);
      return;
    }
    try {
      state.permission = await Notification.requestPermission();
      updateBellState();
      if (state.permission === 'granted') {
        showToast('Notiser påslagna! Du får en påminnelse innan varje lektion.');
      } else {
        showToast('Notiser avstängda. Du kan fortfarande se nästa lektion längst upp.');
      }
    } catch (e) {
      showToast('Kunde inte begära tillstånd för notiser.', true);
    }
  }

  function bindEvents() {
    if (els.bellBtn) {
      els.bellBtn.addEventListener('click', requestNotificationPermission);
    }
    if (els.leadSelect) {
      els.leadSelect.addEventListener('change', () => {
        state.leadMin = parseInt(els.leadSelect.value, 10) || 10;
        localStorage.setItem('notifLead', String(state.leadMin));
      });
    }
    const savedLead = parseInt(localStorage.getItem('notifLead'), 10);
    if (savedLead && els.leadSelect) {
      state.leadMin = savedLead;
      els.leadSelect.value = String(savedLead);
    }
  }

  function initNotifications() {
    initElements();
    // Reset notified set weekly (simplest: clear once per day change).
    updateBanner();
    checkAndNotify();
    setInterval(updateBanner, 30000);
    setInterval(checkAndNotify, 30000);
    updateBellState();
    bindEvents();
  }

  // Expose for potential reuse (e.g. future service worker).
  window.SchNotif = { getTodayLessons, getNextLesson };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNotifications);
  } else {
    initNotifications();
  }
})();
