// VSchedule notifications:
//  1) In-page "next lesson" banner (always works).
//  2) Browser/OS pop-up notifications (Web Notifications API, page open).
//  3) Background push (Phase 2+) — pushManager.subscribe + Cloudflare worker.
//     True closed-app notifications once the worker is deployed (Phase 3).
//
// The bell button toggles: enable = permission + push subscribe + worker
// registration; disable = unsubscribe locally and at the worker.

(function () {
  'use strict';

  // ------------------------------------------------------------------
  // PUSH CONFIG
  // ------------------------------------------------------------------
  // TODO Phase 3: set WORKER_URL to your deployed Cloudflare worker
  // (e.g. https://vschedule-push.<subdomain>.workers.dev) and make sure it
  // matches the VAPID keypair stored there.
  const WORKER_URL = '';
  const VAPID_PUBLIC_KEY = 'BL2-LRSrUgrMjJD65SRDgurPf5zpdFjJIQ1Yy2gOOGVlBfZFwJ_ldPw4FEuWtno7PI0Txnll9AflsjVZeRsqlSQ';

  const state = {
    permission: Notification && 'permission' in Notification ? Notification.permission : 'unsupported',
    leadMin: 10,
    notified: new Set(), // local dedupe: "day-startMin"
    pushSub: null,       // PushSubscription | null
    pushActive: false    // true once subscribed + registered with worker
  };

  let els = {};

  function initElements() {
    els.bellBtn = document.getElementById('notif-bell');
    els.leadSelect = document.getElementById('notif-lead');
    els.banner = document.getElementById('next-lesson-banner');
    els.toast = document.getElementById('notification-toast');
  }

  // ---------- helpers ----------
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const output = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
    return output;
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

  // ---------- banner ----------
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

  // Local in-page pop-ups. Disabled when background push is active to avoid duplicates.
  function checkAndNotify() {
    if (state.pushActive) return;
    if (state.permission !== 'granted') return;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const lessons = getTodayLessons();

    lessons.forEach(l => {
      const fireWindow = nowMin >= l.startMin - state.leadMin && nowMin < l.startMin;
      const key = `${l.day}-${l.startMin}`;
      if (fireWindow && !state.notified.has(key)) {
        state.notified.add(key);
        const body = `${l.subject} börjar kl. ${formatTime(l.startMin)}${l.teacher ? ' med ' + l.teacher : ''} (om ${l.startMin - nowMin} min)`;
        try {
          new Notification(`${l.subject} börjar snart`, { body });
        } catch (e) { /* ignore */ }
      }
    });
  }

  // ---------- toast + bell state ----------
  function showToast(message, isError, duration) {
    if (!els.toast) return;
    els.toast.textContent = message;
    els.toast.classList.toggle('toast-error', !!isError);
    els.toast.classList.add('show');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => els.toast.classList.remove('show'), duration || 4000);
  }

  function updateBellState() {
    if (!els.bellBtn) return;
    const active = state.pushActive || (state.permission === 'granted' && !('serviceWorker' in navigator));
    els.bellBtn.classList.toggle('active', active);
    els.bellBtn.setAttribute('aria-pressed', active);
  }

  // ---------- push (Phase 2) ----------
  async function getPushSubscription() {
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    if (existing) return existing;
    return reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
  }

  async function registerWithWorker(subscription) {
    if (!WORKER_URL) {
      showToast('Prenumeration klar. Välj minuter och vänta på push (worker deployas i fas 3).');
      state.pushActive = true;
      updateBellState();
      return; // worker not deployed yet — keep subscription locally
    }
    const res = await fetch(`${WORKER_URL}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        keys: subscription.toJSON ? subscription.toJSON().keys : subscription.keys,
        leadMin: state.leadMin
      })
    });
    if (!res.ok) throw new Error('register failed ' + res.status);
  }

  async function syncLeadToWorker() {
    if (!state.pushActive || !state.pushSub) return;
    if (!WORKER_URL) return;
    try {
      await fetch(`${WORKER_URL}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: state.pushSub.endpoint,
          keys: state.pushSub.toJSON ? state.pushSub.toJSON().keys : state.pushSub.keys,
          leadMin: state.leadMin
        })
      });
    } catch (e) { /* silent */ }
  }

  async function enablePush() {
    if (!('serviceWorker' in navigator)) {
      showToast('Den här webbläsaren stödjer inte bakgrundsnotiser.', true);
      return;
    }
    try {
      if (state.permission !== 'granted') {
        state.permission = await Notification.requestPermission();
      }
      if (state.permission !== 'granted') {
        updateBellState();
        showToast('Notiser avstängda. Du kan fortfarande se nästa lektion längst upp.', true);
        return;
      }
      state.pushSub = await getPushSubscription();
      await registerWithWorker(state.pushSub);
      state.pushActive = true;
      updateBellState();
      showToast('Bakgrundsnotiser påslagna! Du får en påminnelse innan varje lektion.');
    } catch (e) {
      state.pushActive = false;
      updateBellState();
      showToast('Kunde inte aktivera bakgrundsnotiser: ' + (e && e.message ? e.message : e), true);
    }
  }

  async function disablePush() {
    try {
      if (state.pushSub) {
        if (WORKER_URL) {
          await fetch(`${WORKER_URL}/unsubscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: state.pushSub.endpoint })
          }).catch(() => {});
        }
        await state.pushSub.unsubscribe();
      }
    } catch (e) { /* ignore */ }
    state.pushSub = null;
    state.pushActive = false;
    updateBellState();
    showToast('Notiser avstängda.');
  }

  // Restore subscription state on load.
  async function restorePushState() {
    if (!('serviceWorker' in navigator)) {
      updateBellState();
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      state.pushSub = await reg.pushManager.getSubscription();
      state.pushActive = !!state.pushSub;
    } catch (e) { /* ignore */ }
    updateBellState();
    if (state.pushActive) await syncLeadToWorker();
  }

  // ---------- events ----------
  function bindEvents() {
    if (els.bellBtn) {
      els.bellBtn.addEventListener('click', () => {
        if (state.pushActive) disablePush();
        else enablePush();
      });
    }
    if (els.leadSelect) {
      els.leadSelect.addEventListener('change', () => {
        state.leadMin = parseInt(els.leadSelect.value, 10) || 10;
        localStorage.setItem('notifLead', String(state.leadMin));
        syncLeadToWorker();
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
    updateBanner();
    checkAndNotify();
    setInterval(updateBanner, 30000);
    setInterval(checkAndNotify, 30000);
    updateBellState();
    bindEvents();
    restorePushState();
  }

  // Expose for potential reuse (e.g. debugging).
  window.SchNotif = {
    getTodayLessons,
    getNextLesson,
    state
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNotifications);
  } else {
    initNotifications();
  }
})();