// ===== CORE.JS =====

// Global state and main DOM references
let questions = [];
let sections = [];
let currentSectionId = null;

const questionsContainer = document.getElementById('questionsContainer');
const addQuestionBtn = document.getElementById('addQuestionBtn');
const exportBtn = document.getElementById('menuExport');
const importTrigger = document.getElementById('menuImport');
const importInput = document.getElementById('importInput');
const printBtn = document.getElementById('menuPrint');
const marksInfo = document.getElementById('marksInfo');
const maxMarksInput = document.getElementById('maxMarks');

const metaFields = {
  schoolName: document.getElementById('schoolName'),
  paperTitle: document.getElementById('paperTitle'),
  subject: document.getElementById('subject'),
  className: document.getElementById('className'),
  classSection: document.getElementById('classSection'),
  examDate: document.getElementById('examDate'),
  duration: document.getElementById('duration'),
  maxMarks: maxMarksInput
};

// Snapshot DOM references
const snapSchool = document.getElementById('snapSchool');
const snapSubject = document.getElementById('snapSubject');
const snapClass = document.getElementById('snapClass');
const snapSection = document.getElementById('snapSection');
const snapDate = document.getElementById('snapDate');
const snapDuration = document.getElementById('snapDuration');
const snapMaxMarks = document.getElementById('snapMaxMarks');
const snapTotal = document.getElementById('snapTotal');

// Theme and layout controls
const themeToggleBtn = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
const themeLabel = document.getElementById('themeLabel');

const burgerBtn = document.getElementById('burgerBtn');
const burgerMenu = document.getElementById('burgerMenu');

const metaToggleBtn = document.getElementById('metaToggleBtn');
const paperMetaBody = document.getElementById('paperMetaBody');
let metaCollapsedMobile = false;

// Schools and storage keys
const defaultSchools = ['Ved Home Classes', 'Pacific Word School'];
const SCHOOL_KEY = 'ved-school-options-v1';
const SCHOOL_SELECTED_KEY = 'ved-school-selected-v1';

// Versioning
const updateVersionBtn = document.getElementById('updateVersionBtn');
const versionInfo = document.getElementById('versionInfo');
const VERSION_CODE_KEY = 'qp-version-code';
const VERSION_LABEL_KEY = 'qp-version-label';

// Simple debounce helper
function debounce(fn, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

// Load extra schools from localStorage
function loadSchoolOptionsFromStorage() {
  const stored = localStorage.getItem(SCHOOL_KEY);
  if (!stored) return;
  try {
    const names = JSON.parse(stored);
    const select = metaFields.schoolName;
    names.forEach(name => {
      if (defaultSchools.includes(name)) return;
      let exists = false;
      for (let i = 0; i < select.options.length; i++) {
        if (select.options[i].value === name) { exists = true; break; }
      }
      if (!exists) {
        const opt = document.createElement('option');
        opt.textContent = name;
        select.appendChild(opt);
      }
    });
  } catch {
    // ignore
  }
}

function saveSchoolOptionsToStorage() {
  const select = metaFields.schoolName;
  const names = [];
  for (let i = 0; i < select.options.length; i++) {
    const name = select.options[i].value;
    if (!defaultSchools.includes(name)) names.push(name);
  }
  localStorage.setItem(SCHOOL_KEY, JSON.stringify(names));
}

// Confirm modal
let confirmResolve = null;
const confirmModal = document.getElementById('confirmModal');
const confirmMessage = document.getElementById('confirmMessage');
const confirmOk = document.getElementById('confirmOk');

document.getElementById('confirmCancel').onclick = () => {
  confirmModal.style.display = 'none';
  if (confirmResolve) confirmResolve(false);
};

document.getElementById('confirmOk').onclick = () => {
  confirmModal.style.display = 'none';
  if (confirmResolve) confirmResolve(true);
};

function showConfirm(message, okText = 'Delete') {
  confirmMessage.textContent = message;
  if (confirmOk) confirmOk.textContent = okText;
  confirmModal.style.display = 'flex';
  return new Promise(res => { confirmResolve = res; });
}

// add/delete school modal logic
const schoolModal = document.getElementById('schoolModal');
const newSchoolInput = document.getElementById('newSchoolInput');

document.getElementById('addSchoolLink').onclick = () => {
  newSchoolInput.value = '';
  schoolModal.style.display = 'flex';
  newSchoolInput.focus();
};

document.getElementById('schoolCancel').onclick = () => {
  schoolModal.style.display = 'none';
};

document.getElementById('schoolSave').onclick = () => {
  const name = newSchoolInput.value.trim();
  if (!name) { schoolModal.style.display = 'none'; return; }
  const select = metaFields.schoolName;
  let exists = false;
  for (let i = 0; i < select.options.length; i++) {
    if (select.options[i].value === name) { exists = true; break; }
  }
  if (!exists) {
    const opt = document.createElement('option');
    opt.textContent = name;
    select.appendChild(opt);
    saveSchoolOptionsToStorage();
  }
  select.value = name;
  localStorage.setItem(SCHOOL_SELECTED_KEY, name);
  schoolModal.style.display = 'none';
  updateSnapshotMeta();
  updateSchoolDeleteVisibility();
};

const deleteSchoolBtn = document.getElementById('deleteSchoolBtn');
function updateSchoolDeleteVisibility() {
  const current = metaFields.schoolName.value;
  if (defaultSchools.includes(current)) {
    deleteSchoolBtn.style.visibility = 'hidden';
  } else {
    deleteSchoolBtn.style.visibility = 'visible';
  }
}
deleteSchoolBtn.onclick = async () => {
  const select = metaFields.schoolName;
  const current = select.value;
  if (defaultSchools.includes(current)) return;
  const ok = await showConfirm('Delete school "' + current + '"?');
  if (!ok) return;
  for (let i = 0; i < select.options.length; i++) {
    if (select.options[i].value === current) {
      select.remove(i);
      break;
    }
  }
  saveSchoolOptionsToStorage();
  select.value = 'Ved Home Classes';
  localStorage.setItem(SCHOOL_SELECTED_KEY, select.value);
  updateSnapshotMeta();
  updateSchoolDeleteVisibility();
};

// Theme handling
function applyTheme(theme) {
  if (theme === 'dark') {
    document.body.classList.add('theme-dark');
    themeIcon.textContent = '🌙';
    themeLabel.textContent = 'Dark mode';
  } else {
    document.body.classList.remove('theme-dark');
    themeIcon.textContent = '🌞';
    themeLabel.textContent = 'Light mode';
  }
  localStorage.setItem('qp-theme', theme);
}

const savedTheme = localStorage.getItem('qp-theme') || 'light';
applyTheme(savedTheme);

themeToggleBtn.addEventListener('click', () => {
  const isDark = document.body.classList.contains('theme-dark');
  applyTheme(isDark ? 'light' : 'dark');
});

// Burger menu
burgerBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  burgerMenu.classList.toggle('open');
});
document.addEventListener('click', () => burgerMenu.classList.remove('open'));
burgerMenu.addEventListener('click', (e) => e.stopPropagation());

// Marks info floating behavior
function updateMarksInfoFloating() {
  const toolbar = document.querySelector('.toolbar');
  if (!toolbar || !marksInfo) return;
  const rect = toolbar.getBoundingClientRect();
  const fullyVisible =
    rect.top >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight);
  if (fullyVisible) {
    marksInfo.classList.remove('sticky-floating');
  } else {
    marksInfo.classList.add('sticky-floating');
  }
}

// Format date helper (for display)
function formatDateDDMMYYYY(isoStr) {
  if (!isoStr) return '';
  const [y, m, d] = isoStr.split('-');
  if (!y || !m || !d) return isoStr;
  return `${d}/${m}/${y}`;
}

// Snapshot + print details
function updateSnapshotMeta() {
  snapSchool.textContent = metaFields.schoolName.value || '-';
  snapSubject.textContent = metaFields.subject.value || '-';
  const clsSelect = metaFields.className;
  const clsText = clsSelect.options[clsSelect.selectedIndex]?.textContent;
  snapClass.textContent = clsText || '-';
  snapSection.textContent = metaFields.classSection.value || '-';
  snapDate.textContent = metaFields.examDate.value
    ? formatDateDDMMYYYY(metaFields.examDate.value)
    : '-';
  snapDuration.textContent = metaFields.duration.value
    ? metaFields.duration.value + ' min'
    : '-';
  snapMaxMarks.textContent = metaFields.maxMarks.value || '-';

  const printHeader = document.getElementById('printSchoolHeader');
  if (printHeader) {
    printHeader.textContent = metaFields.schoolName.value || '';
  }
}

function updatePrintExamDetails() {
  const container = document.getElementById('printExamDetails');
  if (!container) return;
  container.innerHTML = '';
  if (metaFields.paperTitle && metaFields.paperTitle.value) {
    const title = document.createElement('h2');
    title.className = 'print-paper-title';
    title.textContent = metaFields.paperTitle.value;
    container.appendChild(title);
  }

  const rows = [
    { label: 'Subject', value: metaFields.subject.value },
    { label: 'Class', value: metaFields.className.value },
    { label: 'Section', value: metaFields.classSection.value },
    {
      label: 'Exam Date',
      value: metaFields.examDate.value
        ? formatDateDDMMYYYY(metaFields.examDate.value)
        : ''
    },
    {
      label: 'Duration',
      value: metaFields.duration.value
        ? metaFields.duration.value + ' min'
        : ''
    },
    { label: 'Max Marks', value: metaFields.maxMarks.value }
  ];

  rows.forEach(r => {
    if (!r.value) return;
    const row = document.createElement('div');
    row.className = 'print-only-exam-row';

    const labelSpan = document.createElement('span');
    labelSpan.className = 'print-only-exam-label';
    labelSpan.textContent = r.label + ':';

    const valueSpan = document.createElement('span');
    valueSpan.className = 'print-only-exam-value';
    valueSpan.textContent = r.value;

    row.appendChild(labelSpan);
    row.appendChild(valueSpan);
    container.appendChild(row);
  });
}

// Draft save/load
function saveDraft() {
  try {
    const draft = {
      questions: questions.map(q => ({ ...q })),
      sections: sections.map(s => ({ ...s })),
      currentSectionId,
      meta: Object.fromEntries(
        Object.entries(metaFields).map(([k, v]) => [k, v ? v.value : ''])
      ),
      timestamp: Date.now()
    };
    localStorage.setItem('qp-draft-v1', JSON.stringify(draft));
  } catch (e) {
    console.warn('Auto-save failed:', e);
  }
}

function loadDraft() {
  try {
    const draft = localStorage.getItem('qp-draft-v1');
    if (!draft) return false;

    const data = JSON.parse(draft);
    if (!data || !data.timestamp || Date.now() - data.timestamp > 24 * 60 * 60 * 1000) {
      localStorage.removeItem('qp-draft-v1');
      return false;
    }

    Object.entries(data.meta || {}).forEach(([key, value]) => {
      if (metaFields[key]) metaFields[key].value = value || '';
    });

    if (!metaFields.schoolName.value) metaFields.schoolName.value = 'Ved Home Classes';
    if (!metaFields.className.value) metaFields.className.value = 'IV';
    if (!metaFields.classSection.value) metaFields.classSection.value = 'A';

    questions = (data.questions || []).map(q => {
      const type = q.type || 'multiple';
      const base = {
        ...q,
        type,
        text: typeof sanitizeHtml === 'function' ? sanitizeHtml(q.text || '') : (q.text || '')
      };
      if (type === 'multiple') {
        base.options = Array.isArray(q.options) ? q.options.map(o => ({
          ...o,
          text: typeof sanitizeHtml === 'function' ? sanitizeHtml(o.text || '') : (o.text || '')
        })) : [];
      } else if (type === 'truefalse') {
        base.options = [{ text: 'True' }, { text: 'False' }];
      } else if (type === 'fillblank') {
        base.blanks = Array.isArray(q.blanks) ? q.blanks.map(b => ({
          ...b,
          answer: typeof sanitizeHtml === 'function' ? sanitizeHtml((b.answer || '').toString()) : (b.answer || '')
        })) : [{ id: 'b-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9), answer: '' }];
      } else if (type === 'short' || type === 'long') {
        base.answer = typeof sanitizeHtml === 'function' ? sanitizeHtml((q.answer || '').toString()) : (q.answer || '');
      }
      return base;
    });

    sections = (data.sections || []).map(s => ({
      ...s,
      questionIds: Array.isArray(s.questionIds) ? [...s.questionIds] : []
    }));
    currentSectionId = data.currentSectionId || (sections[0] && sections[0].id) || null;
    return true;
  } catch (e) {
    localStorage.removeItem('qp-draft-v1');
    return false;
  }
}

const debouncedSave = debounce(saveDraft, 1000);

// Meta inputs wiring
Object.values(metaFields).filter(input => input && input.addEventListener).forEach(input => {
  input.addEventListener('input', () => {
    updateSnapshotMeta();
    updatePrintExamDetails();
    if (input === maxMarksInput && typeof updateTotalMarks === 'function') {
      updateTotalMarks();
    }
    debouncedSave();
  });
});

metaFields.schoolName.addEventListener('change', () => {
  localStorage.setItem(SCHOOL_SELECTED_KEY, metaFields.schoolName.value);
  updateSnapshotMeta();
  updateSchoolDeleteVisibility();
  debouncedSave();
});

// Meta visibility for mobile
function updateMetaVisibilityForViewport() {
  const isMobile = window.innerWidth <= 768;
  if (!isMobile) {
    paperMetaBody.style.display = 'flex';
    metaToggleBtn.textContent = '▲ Hide';
    metaToggleBtn.style.display = 'none';
    metaCollapsedMobile = false;
    return;
  }
  metaToggleBtn.style.display = 'inline-flex';
  metaToggleBtn.textContent = metaCollapsedMobile ? '▼ Show' : '▲ Hide';
  paperMetaBody.style.display = metaCollapsedMobile ? 'none' : 'flex';
}

metaToggleBtn.addEventListener('click', () => {
  const isMobile = window.innerWidth <= 768;
  if (!isMobile) return;
  metaCollapsedMobile = !metaCollapsedMobile;
  updateMetaVisibilityForViewport();
});

window.addEventListener('resize', () => {
  updateMetaVisibilityForViewport();
});

window.addEventListener('scroll', () => {
  updateMarksInfoFloating();
});

// Defaults for date/maxMarks/duration + selected school (local date)
function setTodayDateAndDefaults() {
  const today = new Date();
  const year  = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day   = String(today.getDate()).padStart(2, '0');
  const isoLocal = `${year}-${month}-${day}`;

  metaFields.examDate.value = isoLocal;
  metaFields.maxMarks.value = 100;
  metaFields.duration.value = 90;

  const storedSelected = localStorage.getItem(SCHOOL_SELECTED_KEY);
  if (storedSelected) {
    metaFields.schoolName.value = storedSelected;
  } else {
    metaFields.schoolName.value = 'Ved Home Classes';
  }
}

// Version helpers

// Ver: DD.MM.YY - VVVV (hh:mm:ss AM/PM)
function formatVersionString(versionCode) {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  const v  = String(versionCode).padStart(4, '0');

  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const hh = String(hours).padStart(2, '0');

  const time12 = `${hh}:${minutes}:${seconds} ${ampm}`;
  return `Ver: ${dd}.${mm}.${yy} - ${v} (${time12})`;
}

function initVersion() {
  if (!versionInfo) return;

  let storedCode  = Number(localStorage.getItem(VERSION_CODE_KEY)) || 1001;
  let storedLabel = localStorage.getItem(VERSION_LABEL_KEY);

  // First time: generate once
  if (!storedLabel) {
    storedLabel = formatVersionString(storedCode);
    localStorage.setItem(VERSION_CODE_KEY, String(storedCode));
    localStorage.setItem(VERSION_LABEL_KEY, storedLabel);
  }

  versionInfo.textContent = storedLabel;
}

if (updateVersionBtn && versionInfo) {
  updateVersionBtn.addEventListener('click', () => {
    let currentCode = Number(localStorage.getItem(VERSION_CODE_KEY)) || 1001;
    currentCode += 1;

    const newLabel = formatVersionString(currentCode);

    localStorage.setItem(VERSION_CODE_KEY, String(currentCode));
    localStorage.setItem(VERSION_LABEL_KEY, newLabel);

    versionInfo.textContent = newLabel;
  });
}
const versionTooltip = document.getElementById('versionTooltip');
const versionTooltipShadow = document.getElementById('versionTooltipShadow');

if (versionInfo && versionTooltip && versionTooltipShadow) {
  versionInfo.addEventListener('mouseenter', () => {
    versionTooltip.textContent = versionInfo.textContent;

    versionTooltip.style.opacity = '0';
    versionTooltip.style.left = '-9999px';
    versionTooltip.style.top = '-9999px';
    versionTooltip.style.display = 'block';

    const rectInfo = versionInfo.getBoundingClientRect();
    const rectTip  = versionTooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;

    let centerX = rectInfo.left + rectInfo.width / 2;
    const halfWidth = rectTip.width / 2;
    const minX = halfWidth + 16;
    const maxX = viewportWidth - halfWidth - 16;
    centerX = Math.min(Math.max(centerX, minX), maxX);

    // Position ABOVE the footer text
    const topY = rectInfo.top - rectTip.height - 20; // 20px gap above

    // Tooltip box
    versionTooltip.style.left = (centerX - halfWidth) + 'px';
    versionTooltip.style.top  = topY + 'px';

    // Shadow: starts at tooltip’s bottom edge, goes down-right
    versionTooltipShadow.style.width = rectTip.width + 'px';
    versionTooltipShadow.style.left  = (centerX - halfWidth + 40) + 'px'; // shift right
    versionTooltipShadow.style.top   = (topY + rectTip.height) + 'px';    // just under tooltip

    versionTooltip.style.opacity = '1';
    versionTooltipShadow.style.opacity = '1';
  });

  versionInfo.addEventListener('mouseleave', () => {
    versionTooltip.style.opacity = '0';
    versionTooltipShadow.style.opacity = '0';
  });
}




// Public init for this core file
function initCore() {
  loadSchoolOptionsFromStorage();
  setTodayDateAndDefaults();
  updateMetaVisibilityForViewport();
  updateMarksInfoFloating();
  initVersion();
}
