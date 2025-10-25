const SHIFT_RULES = {
  morning: {
    label: '오전',
    time: '09:00 - 15:00',
    capacity: 2,
  },
  afternoon: {
    label: '오후',
    time: '15:00 - 21:00',
    capacity: 1,
  },
};

const MEMBERS = [
  '함상훈',
  '표영군',
  '박은영',
  '임소정',
  '이도우',
  '김가영',
  '전유석',
  '윤재승',
  '이지수',
];

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const API_ENDPOINT = '/api/schedule';

// 일본 공휴일 (Japanese National Holidays)
const JAPAN_HOLIDAYS = {
  '2025': {
    '01-01': '元日 (설날)',
    '01-13': '成人の日 (성인의 날)',
    '02-11': '建国記念の日 (건국기념일)',
    '02-23': '天皇誕生日 (천황탄생일)',
    '02-24': '振替休日 (대체휴일)',
    '03-20': '春分の日 (춘분의 날)',
    '04-29': '昭和の日 (쇼와의 날)',
    '05-03': '憲法記念日 (헌법기념일)',
    '05-04': 'みどりの日 (녹색의 날)',
    '05-05': 'こどもの日 (어린이날)',
    '05-06': '振替休日 (대체휴일)',
    '07-21': '海の日 (바다의 날)',
    '08-11': '山の日 (산의 날)',
    '09-15': '敬老の日 (경로의 날)',
    '09-23': '秋分の日 (추분의 날)',
    '10-13': 'スポーツの日 (스포츠의 날)',
    '11-03': '文化の日 (문화의 날)',
    '11-23': '勤労感謝の日 (근로감사의 날)',
    '11-24': '振替休日 (대체휴일)',
  },
  '2026': {
    '01-01': '元日 (설날)',
    '01-12': '成人の日 (성인의 날)',
    '02-11': '建国記念の日 (건국기념일)',
    '02-23': '天皇誕生日 (천황탄생일)',
    '03-20': '春分の日 (춘분의 날)',
    '04-29': '昭和の日 (쇼와의 날)',
    '05-03': '憲法記念日 (헌법기념일)',
    '05-04': 'みどりの日 (녹색의 날)',
    '05-05': 'こどもの日 (어린이날)',
    '05-06': '振替休日 (대체휴일)',
    '07-20': '海の日 (바다의 날)',
    '08-11': '山の日 (산의 날)',
    '09-21': '敬老の日 (경로의 날)',
    '09-22': '秋分の日 (추분의 날)',
    '10-12': 'スポーツの日 (스포츠의 날)',
    '11-03': '文化の日 (문화의 날)',
    '11-23': '勤労感謝の日 (근로감사의 날)',
  },
};

function isJapanHoliday(dateKey) {
  const [year, month, day] = dateKey.split('-');
  const monthDay = `${month}-${day}`;
  return JAPAN_HOLIDAYS[year]?.[monthDay] || null;
}

const calendarGrid = document.getElementById('calendarGrid');
const monthLabel = document.getElementById('monthLabel');
const todayBtn = document.getElementById('todayBtn');
const prevMonthBtn = document.getElementById('prevMonth');
const nextMonthBtn = document.getElementById('nextMonth');
const weeklyStatsEl = document.getElementById('weeklyStats');
const holidayListEl = document.getElementById('holidayList');

const dayTemplate = document.getElementById('dayTemplate');
const shiftTemplate = document.getElementById('shiftTemplate');
const assignmentModal = document.getElementById('assignmentModal');
const memberSelect = document.getElementById('memberSelect');
const modalInfo = document.getElementById('modalInfo');
const saveAssignmentBtn = document.getElementById('saveAssignment');
const cancelAssignmentBtn = document.getElementById('cancelAssignment');

const visibleDate = new Date();
visibleDate.setDate(1);

let schedule = {};
let pendingAssignment = null;

function showLoadingState(message = '스케줄을 불러오는 중입니다...') {
  calendarGrid.innerHTML = `<p class="loading-state">${message}</p>`;
  weeklyStatsEl.innerHTML = '';
  holidayListEl.innerHTML = '';
}

async function fetchScheduleFromServer() {
  const response = await fetch(API_ENDPOINT, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Failed to load schedule');
  }
  const data = await response.json();
  return typeof data === 'object' && data !== null ? data : {};
}

async function persistScheduleToServer() {
  const response = await fetch(API_ENDPOINT, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(schedule),
  });

  if (!response.ok) {
    throw new Error('Failed to save schedule');
  }
}

async function refreshScheduleState() {
  try {
    schedule = await fetchScheduleFromServer();
  } catch (error) {
    console.error('Failed to refresh schedule', error);
  }
}

async function initializeScheduleBoard() {
  showLoadingState();
  try {
    schedule = await fetchScheduleFromServer();
  } catch (error) {
    console.error('Failed to load schedule', error);
    alert('서버에서 스케줄을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.');
  }
  renderCalendar();
}

function getDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function ensureDate(recordKey) {
  if (!schedule[recordKey]) {
    schedule[recordKey] = { morning: [], afternoon: [] };
  }
}

function formatDateLabel(dateKey) {
  const [y, m, d] = dateKey.split('-').map((part) => Number(part));
  return `${y}년 ${m}월 ${d}일`;
}

function getWeekNumber(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  // Find the first day of the month
  const firstDay = new Date(year, month, 1);
  const firstDayOfWeek = firstDay.getDay(); // 0 (Sunday) to 6 (Saturday)

  // Calculate week number within the month
  const weekNum = Math.ceil((day + firstDayOfWeek) / 7);

  return `${year}-${String(month + 1).padStart(2, '0')}-W${weekNum}`;
}

function getWeeklyShiftCounts(weekKey) {
  const counts = {};
  MEMBERS.forEach(name => {
    counts[name] = 0;
  });

  // Iterate through all schedule entries
  Object.entries(schedule).forEach(([dateKey, daySchedule]) => {
    const [y, m, d] = dateKey.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const entryWeekKey = getWeekNumber(date);

    if (entryWeekKey === weekKey) {
      // Count morning and afternoon shifts
      ['morning', 'afternoon'].forEach(shiftKey => {
        const assigned = daySchedule[shiftKey] || [];
        assigned.forEach(name => {
          if (counts[name] !== undefined) {
            counts[name]++;
          }
        });
      });
    }
  });

  return counts;
}

function getMonthHolidays(year, month) {
  const holidays = [];
  const lastDay = new Date(year, month + 1, 0).getDate();

  for (let day = 1; day <= lastDay; day++) {
    const date = new Date(year, month, day);
    const dateKey = getDateKey(date);
    const holidayName = isJapanHoliday(dateKey);

    if (holidayName) {
      holidays.push({ day, name: holidayName });
    }
  }

  return holidays;
}

function renderHolidayList() {
  const year = visibleDate.getFullYear();
  const month = visibleDate.getMonth();
  const holidays = getMonthHolidays(year, month);

  if (holidays.length === 0) {
    holidayListEl.innerHTML = '';
    return;
  }

  holidayListEl.innerHTML = '<p class="holiday-list-title">이번 달 일본 공휴일</p>';
  const list = document.createElement('ul');
  list.className = 'holiday-items';

  holidays.forEach(({ day, name }) => {
    const item = document.createElement('li');
    item.innerHTML = `<strong>${month + 1}월 ${day}일</strong>: ${name}`;
    list.appendChild(item);
  });

  holidayListEl.appendChild(list);
}

function renderWeeklyStats() {
  const year = visibleDate.getFullYear();
  const month = visibleDate.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();

  // Find all unique weeks in the current month
  const weeks = new Set();
  for (let day = 1; day <= lastDay; day++) {
    const date = new Date(year, month, day);
    weeks.add(getWeekNumber(date));
  }

  weeklyStatsEl.innerHTML = '<h3 class="stats-title">주간 근무 현황</h3>';

  const weeksArray = Array.from(weeks);
  weeksArray.forEach((weekKey) => {
    const counts = getWeeklyShiftCounts(weekKey);

    const weekSection = document.createElement('div');
    weekSection.className = 'week-section';

    const weekTitle = document.createElement('h4');
    weekTitle.className = 'week-title';
    weekTitle.textContent = `${weekKey.split('-W')[1]}주차`;
    weekSection.appendChild(weekTitle);

    const statsGrid = document.createElement('div');
    statsGrid.className = 'stats-grid';

    MEMBERS.forEach((name) => {
      const count = counts[name];
      const isOverLimit = name !== '박은영' && count >= 4;

      const statItem = document.createElement('div');
      statItem.className = `stat-item ${isOverLimit ? 'over-limit' : ''}`;
      statItem.innerHTML = `
        <span class="stat-name">${name}</span>
        <span class="stat-count">${count}회</span>
      `;

      statsGrid.appendChild(statItem);
    });

    weekSection.appendChild(statsGrid);
    weeklyStatsEl.appendChild(weekSection);
  });
}

function renderCalendar() {
  const year = visibleDate.getFullYear();
  const month = visibleDate.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const totalSlots = firstWeekday + lastDay;
  const trailingPlaceholders = (7 - (totalSlots % 7)) % 7;

  monthLabel.textContent = `${year}년 ${month + 1}월`;
  calendarGrid.innerHTML = '';

  renderWeeklyStats();
  renderHolidayList();

  for (let i = 0; i < firstWeekday; i += 1) {
    calendarGrid.appendChild(createPlaceholderDay());
  }

  for (let day = 1; day <= lastDay; day += 1) {
    const date = new Date(year, month, day);
    const dateKey = getDateKey(date);
    const dayFragment = dayTemplate.content.cloneNode(true);

    const dayEl = dayFragment.querySelector('.day');
    const weekdayEl = dayFragment.querySelector('.weekday');
    const dateEl = dayFragment.querySelector('.date');
    const shiftsEl = dayFragment.querySelector('.shifts');

    weekdayEl.textContent = WEEKDAYS[date.getDay()];
    dateEl.textContent = day;

    // Check if it's a holiday
    const holidayName = isJapanHoliday(dateKey);
    if (holidayName) {
      dayEl.classList.add('holiday');
      dayEl.title = holidayName;
    }

    const daySchedule = schedule[dateKey] || { morning: [], afternoon: [] };

    Object.entries(SHIFT_RULES).forEach(([shiftKey, info]) => {
      const assigned = daySchedule[shiftKey] || [];

      const shiftFragment = shiftTemplate.content.cloneNode(true);
      const shiftEl = shiftFragment.querySelector('.shift');
      const shiftNameEl = shiftFragment.querySelector('.shift-name');
      const slotCountEl = shiftFragment.querySelector('.slot-count');
      const assignmentsEl = shiftFragment.querySelector('.assignments');
      const addBtn = shiftFragment.querySelector('.add-btn');

      shiftEl.dataset.shift = shiftKey;
      shiftNameEl.textContent = info.label;

      slotCountEl.textContent = `${assigned.length} / ${info.capacity}명`;
      addBtn.disabled = assigned.length >= info.capacity;

      if (assigned.length === 0) {
        const emptyMsg = document.createElement('p');
        emptyMsg.className = 'empty-msg';
        emptyMsg.textContent = '아직 배정 없음';
        assignmentsEl.appendChild(emptyMsg);
      } else {
        assigned.forEach((name, index) => {
          const chip = document.createElement('button');
          chip.className = 'assignment-chip';
          chip.type = 'button';
          chip.innerHTML = `<span>${name}</span><span class="remove-mark" aria-hidden="true">×</span>`;
          chip.title = `${name} 삭제`;
          chip.addEventListener('click', () =>
            removeAssignment(dateKey, shiftKey, index, name),
          );
          assignmentsEl.appendChild(chip);
        });
      }

      addBtn.addEventListener('click', () => handleAdd(dateKey, shiftKey));
      shiftsEl.appendChild(shiftFragment);
    });

    calendarGrid.appendChild(dayFragment);
  }

  for (let i = 0; i < trailingPlaceholders; i += 1) {
    calendarGrid.appendChild(createPlaceholderDay());
  }
}

function handleAdd(dateKey, shiftKey) {
  ensureDate(dateKey);
  const rule = SHIFT_RULES[shiftKey];
  const assigned = schedule[dateKey][shiftKey];

  if (assigned.length >= rule.capacity) {
    alert(`${rule.label}의 정원이 가득 찼습니다.`);
    return;
  }

  openAssignmentModal(dateKey, shiftKey);
}

function openAssignmentModal(dateKey, shiftKey) {
  if (!shiftKey) return;

  pendingAssignment = { dateKey, shiftKey };
  ensureDate(dateKey);

  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const weekKey = getWeekNumber(date);
  const assigned = schedule[dateKey][shiftKey];

  populateMemberOptions(assigned, weekKey);
  modalInfo.textContent = `${formatDateLabel(dateKey)} · ${SHIFT_RULES[shiftKey].label}`;

  assignmentModal.hidden = false;
  memberSelect.disabled = false;
  memberSelect.focus();
}

function populateMemberOptions(takenList, weekKey) {
  memberSelect.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '이름을 선택하세요';
  placeholder.disabled = true;
  placeholder.selected = true;
  memberSelect.appendChild(placeholder);

  // Get weekly shift counts
  const weeklyCounts = getWeeklyShiftCounts(weekKey);

  MEMBERS.forEach((name) => {
    const option = document.createElement('option');
    option.value = name;

    const weeklyCount = weeklyCounts[name];
    const countText = name === '박은영' ? '' : ` (주: ${weeklyCount}회)`;

    option.textContent = `${name}${countText}`;
    option.disabled = takenList.includes(name) || (name !== '박은영' && weeklyCount >= 4);

    // Add warning if approaching limit
    if (name !== '박은영' && weeklyCount >= 4) {
      option.textContent += ' - 주간 한도 초과';
    }

    memberSelect.appendChild(option);
  });

  saveAssignmentBtn.disabled = true;
}

function closeAssignmentModal() {
  pendingAssignment = null;
  memberSelect.value = '';
  memberSelect.disabled = false;
  assignmentModal.hidden = true;
}

function createPlaceholderDay() {
  const placeholder = document.createElement('article');
  placeholder.className = 'day placeholder';
  return placeholder;
}

async function removeAssignment(dateKey, shiftKey, index, name) {
  const confirmed = confirm(`${name} 배정을 삭제할까요?`);
  if (!confirmed) return;

  ensureDate(dateKey);
  schedule[dateKey][shiftKey].splice(index, 1);

  if (
    schedule[dateKey].morning.length === 0 &&
    schedule[dateKey].afternoon.length === 0
  ) {
    delete schedule[dateKey];
  }

  try {
    await persistScheduleToServer();
  } catch (error) {
    console.error('Failed to save schedule', error);
    alert('서버 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    await refreshScheduleState();
  }

  renderCalendar();
}

prevMonthBtn.addEventListener('click', () => {
  visibleDate.setMonth(visibleDate.getMonth() - 1);
  renderCalendar();
});

nextMonthBtn.addEventListener('click', () => {
  visibleDate.setMonth(visibleDate.getMonth() + 1);
  renderCalendar();
});

todayBtn.addEventListener('click', () => {
  const now = new Date();
  visibleDate.setFullYear(now.getFullYear(), now.getMonth(), 1);
  renderCalendar();
});

memberSelect.addEventListener('change', () => {
  saveAssignmentBtn.disabled = memberSelect.value === '';
});

saveAssignmentBtn.addEventListener('click', async () => {
  if (!pendingAssignment) return;

  const selectedName = memberSelect.value;
  if (!selectedName) {
    alert('이름을 선택해 주세요.');
    return;
  }

  const { dateKey, shiftKey } = pendingAssignment;

  if (!shiftKey) {
    alert('근무 시간을 선택해 주세요.');
    return;
  }

  ensureDate(dateKey);
  const rule = SHIFT_RULES[shiftKey];
  const assigned = schedule[dateKey][shiftKey];

  if (assigned.length >= rule.capacity) {
    alert(`${rule.label}의 정원이 가득 찼습니다.`);
    closeAssignmentModal();
    renderCalendar();
    return;
  }

  if (assigned.includes(selectedName)) {
    alert('이미 배정된 이름입니다.');
    return;
  }

  assigned.push(selectedName);

  saveAssignmentBtn.disabled = true;
  try {
    await persistScheduleToServer();
  } catch (error) {
    console.error('Failed to save schedule', error);
    alert('서버 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    await refreshScheduleState();
  }

  closeAssignmentModal();
  renderCalendar();
});

cancelAssignmentBtn.addEventListener('click', () => {
  closeAssignmentModal();
});

assignmentModal.addEventListener('click', (event) => {
  if (event.target === assignmentModal) {
    closeAssignmentModal();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !assignmentModal.hidden) {
    closeAssignmentModal();
  }
});

// PDF Export functionality
const pdfBtn = document.getElementById('pdfBtn');
if (pdfBtn) {
  pdfBtn.addEventListener('click', () => {
    window.print();
  });
}

// Share Link functionality
const shareBtn = document.getElementById('shareBtn');
if (shareBtn) {
  shareBtn.addEventListener('click', async () => {
    const currentUrl = window.location.href;
    const year = visibleDate.getFullYear();
    const month = visibleDate.getMonth() + 1;
    const shareUrl = `${currentUrl.split('?')[0]}?year=${year}&month=${month}`;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareUrl);
        showNotification('링크가 클립보드에 복사되었습니다!');
      } else {
        // Fallback for non-secure contexts
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          document.execCommand('copy');
          showNotification('링크가 클립보드에 복사되었습니다!');
        } catch (err) {
          prompt('링크를 복사하세요:', shareUrl);
        }
        document.body.removeChild(textArea);
      }
    } catch (err) {
      console.error('Failed to copy:', err);
      prompt('링크를 복사하세요:', shareUrl);
    }
  });
}

// Show notification
function showNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.classList.add('show');
  }, 10);

  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, 3000);
}

// Load month from URL parameters
function loadMonthFromURL() {
  const params = new URLSearchParams(window.location.search);
  const year = params.get('year');
  const month = params.get('month');

  if (year && month) {
    visibleDate.setFullYear(parseInt(year));
    visibleDate.setMonth(parseInt(month) - 1);
  }
}

// Load month from URL on page load
loadMonthFromURL();

initializeScheduleBoard();
