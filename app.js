const state = {
  currentView: 'grid',
  activeDay: 'all',
  searchQuery: '',
  theme: 'light'
};

const els = {};

function initElements() {
  els.header = document.querySelector('.header');
  els.searchInput = document.getElementById('search-input');
  els.dayTabs = document.querySelectorAll('.day-tab');
  els.viewBtns = document.querySelectorAll('.view-btn');
  els.icsLink = document.getElementById('ics-download');
  els.themeToggle = document.getElementById('theme-toggle');
  els.timetable = document.querySelector('.timetable');
  els.cardsContainer = document.querySelector('.cards-container');
  els.legendGrid = document.querySelector('.legend-grid');
  els.body = document.body;
}

function computeOverlapGroups(classes) {
  const sorted = [...classes].sort((a, b) => a.startMin - b.startMin);
  const groups = [];
  let currentGroup = [];
  let groupEnd = -1;

  sorted.forEach(cls => {
    if (currentGroup.length === 0 || cls.startMin < groupEnd) {
      currentGroup.push(cls);
      groupEnd = Math.max(groupEnd, cls.endMin);
    } else {
      groups.push(currentGroup);
      currentGroup = [cls];
      groupEnd = cls.endMin;
    }
  });
  if (currentGroup.length > 0) groups.push(currentGroup);
  return groups;
}

function buildGrid() {
  const dayIndices = [1, 2, 3, 4, 5];
  let html = '';

  html += '<div class="time-header" style="grid-column: 1; grid-row: 1">Tid</div>';
  days.forEach((d, i) => {
    const col = i + 2;
    html += `<div class="day-header" data-day="${i + 1}" style="grid-column: ${col}; grid-row: 1">${d.fullName}</div>`;
  });

  const SLOT_DURATION = 30;
  const START_MIN = 8 * 60;
  const END_MIN = 19 * 60;
  const TOTAL_SLOTS = (END_MIN - START_MIN) / SLOT_DURATION;
  const TOTAL_MINUTES = END_MIN - START_MIN;
  const AFTER_SCHOOL_THRESHOLD = START_MIN + 8 * 60;

  for (let i = 0; i < TOTAL_SLOTS; i++) {
    const slotStart = START_MIN + i * SLOT_DURATION;
    const label = `${String(Math.floor(slotStart / 60)).padStart(2, '0')}:${String(slotStart % 60).padStart(2, '0')}`;
    html += `<div class="time-label" style="grid-row: ${i + 2}">${label}</div>`;
  }

  for (let rowOffset = 0; rowOffset < TOTAL_SLOTS; rowOffset++) {
    const gridRow = rowOffset + 2;
    dayIndices.forEach((dayIdx, dayPos) => {
      const gridCol = dayPos + 2;
      html += `<div class="grid-cell" style="grid-column: ${gridCol}; grid-row: ${gridRow}"></div>`;
    });
  }

  dayIndices.forEach((dayIdx, dayPos) => {
    const gridCol = dayPos + 2;
    const dayClasses = getScheduleForDay(dayIdx).map(cls => {
      const { start, end } = parseTimeRange(cls.time);
      const isAfterSchool = start >= AFTER_SCHOOL_THRESHOLD;
      const color = isAfterSchool ? '#06b6d4' : categoryColors[cls.category] || '#64748b';
      return { ...cls, startMin: start, endMin: end, color, isAfterSchool };
    });

    const groups = computeOverlapGroups(dayClasses);

    let dayHtml = '';
    groups.forEach(group => {
      const n = group.length;
      group.forEach((cls, idx) => {
        const topPct = ((cls.startMin - START_MIN) / TOTAL_MINUTES) * 100;
        const heightPct = ((cls.endMin - cls.startMin) / TOTAL_MINUTES) * 100;
        const widthPct = 100 / n;
        const leftPct = idx * widthPct;
        const duration = cls.endMin - cls.startMin;
        const isCompact = duration <= 20;

        dayHtml += `
          <div class="class-block${isCompact ? ' compact' : ''}" style="
            top: ${topPct}%;
            height: ${heightPct}%;
            left: calc(${leftPct}% + 1px);
            width: calc(${widthPct}% - 2px);
            --card-color: ${cls.color};
            --color: ${cls.color};
          " data-day="${dayIdx}" data-category="${cls.category}" data-subject="${escapeHtml(cls.subject)}" data-time="${escapeHtml(cls.time)}" data-start="${cls.startMin}" data-end="${cls.endMin}">
            <span class="time">${escapeHtml(cls.time)}</span>
            <span class="subject">${escapeHtml(cls.subject)}</span>
            ${cls.teacher ? `<span class="teacher">${escapeHtml(cls.teacher)}</span>` : ''}
          </div>
        `;
      });
    });

    html += `<div class="day-column" data-day="${dayIdx}" style="grid-column: ${gridCol}; grid-row: 2 / -1">${dayHtml}</div>`;
  });

  els.timetable.innerHTML = html;
  initNowIndicator();
}

function buildCards() {
  let html = '';
  days.forEach(day => {
    const dayClasses = getScheduleForDay(day.index);
    if (dayClasses.length === 0) return;

    html += `<div class="day-card-header">${day.fullName}</div>`;

    dayClasses.forEach(cls => {
      const color = categoryColors[cls.category] || '#64748b';
      const { start, end } = parseTimeRange(cls.time);
      html += `
        <div class="class-card" style="--card-color: ${color};" data-day="${day.index}" data-category="${cls.category}" data-subject="${escapeHtml(cls.subject)}" data-time="${escapeHtml(cls.time)}" data-start="${start}" data-end="${end}">
          <div class="class-card-content">
            <span class="class-card-time">${escapeHtml(cls.time)}</span>
            <span class="class-card-subject">${escapeHtml(cls.subject)}</span>
            ${cls.teacher ? `<span class="class-card-teacher">${escapeHtml(cls.teacher)}</span>` : ''}
          </div>
        </div>
      `;
    });
  });
  els.cardsContainer.innerHTML = html;
}

function buildLegend() {
  const categories = getAllCategories();
  let html = '';
  categories.forEach(cat => {
    html += `
      <div class="legend-item" data-category="${cat.key}">
        <span class="legend-color" style="background: ${cat.color}"></span>
        <span>${cat.label}</span>
      </div>
    `;
  });
  els.legendGrid.innerHTML = html;
}

function addNowIndicator() {
  const now = new Date();
  const day = now.getDay();
  const dayMap = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 0, 0: 0 };
  const currentDay = dayMap[day];
  if (currentDay === 0) return;

  const minutes = now.getHours() * 60 + now.getMinutes();
  const START_MIN = 8 * 60;
  const END_MIN = 19 * 60;
  const TOTAL_MINUTES = END_MIN - START_MIN;

  if (minutes < START_MIN || minutes >= END_MIN) return;

  const topPct = ((minutes - START_MIN) / TOTAL_MINUTES) * 100;

  const dayColumnIdx = currentDay;
  const dayColPos = dayColumnIdx - 1;
  const dayColumns = els.timetable.querySelectorAll('.day-column');
  if (dayColumns[dayColPos]) {
    const indicator = document.createElement('div');
    indicator.className = 'now-indicator';
    indicator.style.top = `${topPct}%`;
    dayColumns[dayColPos].appendChild(indicator);
  }
}

function highlightCurrentLesson() {
  const now = new Date();
  const dayMap = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 0, 0: 0 };
  const currentDay = dayMap[now.getDay()];
  const minutes = now.getHours() * 60 + now.getMinutes();

  const allBlocks = els.timetable.querySelectorAll('.class-block');
  const allCards = els.cardsContainer.querySelectorAll('.class-card');
  const targets = [...allBlocks, ...allCards];

  targets.forEach(block => {
    if (currentDay !== 0 && block.dataset.day == currentDay) {
      const start = parseInt(block.dataset.start, 10);
      const end = parseInt(block.dataset.end, 10);
      if (!isNaN(start) && !isNaN(end) && minutes >= start && minutes < end) {
        block.classList.add('current');
        return;
      }
    }
    block.classList.remove('current');
  });
}

let nowRefreshInterval;
function initNowIndicator() {
  addNowIndicator();
  highlightCurrentLesson();
  clearInterval(nowRefreshInterval);
  nowRefreshInterval = setInterval(highlightCurrentLesson, 30000);
}

function applyFilters() {
  const query = state.searchQuery.toLowerCase().trim();
  const dayFilter = state.activeDay;

  document.querySelectorAll('.class-block, .class-card').forEach(el => {
    const elDay = parseInt(el.dataset.day, 10);
    const subject = el.dataset.subject.toLowerCase();
    const category = el.dataset.category;

    const dayMatch = dayFilter === 'all' || elDay === parseInt(dayFilter, 10);
    const searchMatch = !query || subject.includes(query) || category.includes(query) || categoryLabels[category]?.toLowerCase().includes(query);

    if (dayMatch && searchMatch) {
      el.classList.remove('hidden', 'dimmed');
    } else if (dayMatch && !searchMatch) {
      el.classList.add('dimmed');
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
      el.classList.remove('dimmed');
    }
  });

  document.querySelectorAll('.day-card-header').forEach(header => {
    const dayName = header.textContent;
    const dayIdx = days.findIndex(d => d.fullName === dayName) + 1;
    const cards = Array.from(header.parentElement.querySelectorAll(`.class-card[data-day="${dayIdx}"]`));
    const visibleCards = cards.filter(c => !c.classList.contains('hidden'));
    header.style.display = visibleCards.length > 0 ? 'block' : 'none';
  });

  updateLegendHighlight(query);
}

function updateLegendHighlight(query) {
  document.querySelectorAll('.legend-item').forEach(item => {
    const cat = item.dataset.category;
    const label = categoryLabels[cat]?.toLowerCase() || '';
    const match = !query || label.includes(query) || cat.includes(query);
    item.style.opacity = match ? '1' : '0.3';
  });
}

function setView(view) {
  state.currentView = view;
  document.body.classList.remove('grid', 'cards');
  document.body.classList.add(view);

  els.viewBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
    btn.setAttribute('aria-pressed', btn.dataset.view === view);
  });

  highlightCurrentLesson();
}

function setDayFilter(day) {
  state.activeDay = day;
  els.dayTabs.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.day === day);
    btn.setAttribute('aria-pressed', btn.dataset.day === day);
  });
  applyFilters();
}

function setSearch(query) {
  state.searchQuery = query;
  applyFilters();
}

function toggleTheme() {
  state.theme = state.theme === 'light' ? 'dark' : 'light';
  els.body.dataset.theme = state.theme;
  localStorage.setItem('theme', state.theme);
  updateThemeIcon();
}

function updateThemeIcon() {
  const sunIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`;
  const moonIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
  els.themeToggle.innerHTML = state.theme === 'dark' ? sunIcon : moonIcon;
}

function loadTheme() {
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  state.theme = saved || (prefersDark ? 'dark' : 'light');
  els.body.dataset.theme = state.theme;
  updateThemeIcon();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function bindEvents() {
  els.searchInput.addEventListener('input', (e) => setSearch(e.target.value));

  els.dayTabs.forEach(btn => {
    btn.addEventListener('click', () => setDayFilter(btn.dataset.day));
  });

  els.viewBtns.forEach(btn => {
    btn.addEventListener('click', () => setView(btn.dataset.view));
  });

  els.themeToggle.addEventListener('click', toggleTheme);

  els.icsLink.href = 'schedule.ics';

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      els.searchInput.value = '';
      setSearch('');
      els.searchInput.blur();
    }
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
      state.theme = e.matches ? 'dark' : 'light';
      els.body.dataset.theme = state.theme;
      updateThemeIcon();
    }
  });
}

function init() {
  initElements();
  loadTheme();
  buildGrid();
  buildCards();
  buildLegend();
  bindEvents();
  applyFilters();
}

document.addEventListener('DOMContentLoaded', init);