// ===== CORE.JS =====

// Global state and main DOM references
let questions = [];
let sections = [];
let currentSectionId = null;
let paperTitle = 'Untitled Paper';
var lastSaved = null;

const questionsContainer = document.getElementById('questionsContainer');
const addQuestionBtn = document.getElementById('addQuestionBtn');
const exportBtn = document.getElementById('menuExport');
const importTrigger = document.getElementById('menuImport');
const importInput = document.getElementById('importInput');
const marksInfo = document.getElementById('marksInfo');
const maxMarksInput = document.getElementById('maxMarks');

const editorWorkspace = document.getElementById('editorWorkspace');
const savedPapersView = document.getElementById('savedPapersView');
let currentView = 'editor';

const metaFields = {
  schoolName: document.getElementById('schoolName'),
  paperTitle: document.getElementById('paperTitle'),
  subject: document.getElementById('subject'),
  className: document.getElementById('className'),
  classSection: document.getElementById('classSection'),
  dateOfExam: document.getElementById('dateOfExam'),
  duration: document.getElementById('duration'),
  maxMarks: maxMarksInput
};

const paperHeaderTitle = document.getElementById('paperHeaderTitle');
const paperHeaderCard = document.getElementById('paperHeaderCard');
const statSections = document.getElementById('statSections');
const statQuestions = document.getElementById('statQuestions');
const statMarks = document.getElementById('statMarks');
const statCreated = document.getElementById('statCreated');
const editPaperTitleBtn = document.getElementById('editPaperTitleBtn');
const clearMetaBtn = document.getElementById('clearMetaBtn');

// Print settings
const printSettingsModal = document.getElementById('printSettingsModal');
const printMenuBtn = document.getElementById('printMenuBtn');
const printDropdown = document.getElementById('printDropdown');
const printDropdownMenu = document.getElementById('printDropdownMenu');
const printSettingsClose = document.getElementById('printSettingsClose');
const printSettingsCancel = document.getElementById('printSettingsCancel');
const printMarginTop = document.getElementById('printMarginTop');
const printMarginBottom = document.getElementById('printMarginBottom');
const printMarginLeft = document.getElementById('printMarginLeft');
const printMarginRight = document.getElementById('printMarginRight');
const printSettingsApply = document.getElementById('printSettingsApply');
const printSettingsReset = document.getElementById('printSettingsReset');
const PRINT_SETTINGS_KEY = 'exam_print_settings';
const DEFAULT_PRINT_MARGINS = { top: 20, bottom: 20, left: 15, right: 15 };

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
const landingThemeToggle = document.getElementById('landingThemeToggle');
const themeIcon = document.getElementById('themeIcon');
const themeLabel = document.getElementById('themeLabel');

const landingScreen = document.getElementById('landingScreen');
const editorScreen = document.getElementById('editorScreen');

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

// Safe localStorage wrappers
function safeLocalStorageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore storage errors
  }
}

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
  const stored = safeLocalStorageGet(SCHOOL_KEY);
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
  safeLocalStorageSet(SCHOOL_KEY, JSON.stringify(names));
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

function showConfirm(message, okText = 'Delete', cancelText = 'Cancel') {
  confirmMessage.innerHTML = message;
  if (confirmOk) confirmOk.textContent = okText;
  if (confirmCancel) {
    confirmCancel.textContent = cancelText || 'Cancel';
    confirmCancel.style.display = (cancelText === null || cancelText === false) ? 'none' : 'inline-flex';
  }
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
  safeLocalStorageSet(SCHOOL_SELECTED_KEY, name);
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
  safeLocalStorageSet(SCHOOL_SELECTED_KEY, select.value);
  updateSnapshotMeta();
  updateSchoolDeleteVisibility();
};

function showEditor() {
  if (landingScreen) landingScreen.classList.add('hidden');
  if (editorScreen) editorScreen.classList.remove('hidden');
}

async function showLanding() {
  if (typeof hasUnsavedChanges === 'function' && hasUnsavedChanges()) {
    const ok = await showConfirm('You have unsaved changes. Leave without saving?', 'Leave');
    if (!ok) return;
  }
  if (landingScreen) landingScreen.classList.remove('hidden');
  if (editorScreen) editorScreen.classList.add('hidden');
}

// Theme handling
function applyTheme(theme) {
  if (theme === 'dark') {
    document.body.classList.add('theme-dark');
    document.querySelectorAll('.theme-icon').forEach(el => el.textContent = '🌙');
    document.querySelectorAll('.theme-label').forEach(el => el.textContent = 'Dark mode');
  } else {
    document.body.classList.remove('theme-dark');
    document.querySelectorAll('.theme-icon').forEach(el => el.textContent = '🌞');
    document.querySelectorAll('.theme-label').forEach(el => el.textContent = 'Light mode');
  }
  safeLocalStorageSet('qp-theme', theme);
}

const savedTheme = safeLocalStorageGet('qp-theme') || 'light';
applyTheme(savedTheme);

function onThemeToggle() {
  const isDark = document.body.classList.contains('theme-dark');
  applyTheme(isDark ? 'light' : 'dark');
}

themeToggleBtn.addEventListener('click', onThemeToggle);
if (landingThemeToggle) landingThemeToggle.addEventListener('click', onThemeToggle);

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
  snapDate.textContent = metaFields.dateOfExam.value
    ? formatDateDDMMYYYY(metaFields.dateOfExam.value)
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

function pluralizeStat(n, singular, plural) {
  return n + ' ' + (n === 1 ? singular : plural);
}

function formatTimeAgo(timestamp) {
  const diff = Date.now() - timestamp;
  if (diff < 60000) return 'just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins + ' min' + (mins === 1 ? '' : 's') + ' ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + ' hour' + (hrs === 1 ? '' : 's') + ' ago';
  const days = Math.floor(hrs / 24);
  if (days < 30) return days + ' day' + (days === 1 ? '' : 's') + ' ago';
  const d = new Date(timestamp);
  return 'on ' + d.toLocaleDateString();
}

function updatePaperInfoCard() {
  if (paperHeaderTitle) paperHeaderTitle.textContent = paperTitle || 'Untitled Paper';
  if (statSections) statSections.textContent = pluralizeStat(Array.isArray(sections) ? sections.length : 0, 'Section', 'Sections');
  if (statQuestions) statQuestions.textContent = pluralizeStat(Array.isArray(questions) ? questions.length : 0, 'Question', 'Questions');
  const total = Array.isArray(questions) ? questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0) : 0;
  const max = maxMarksInput ? Number(maxMarksInput.value) || 0 : 0;
  if (statMarks) {
    statMarks.textContent = pluralizeStat(total, 'Mark', 'Marks');
    statMarks.classList.toggle('stat-marks-excess', max > 0 && total > max);
  }
  if (statCreated) {
    if (lastSaved) {
      statCreated.textContent = 'Last saved ' + formatTimeAgo(lastSaved);
    } else {
      statCreated.textContent = 'Just created';
    }
  }
}

function updatePrintExamDetails() {
  if (typeof renderQuestions === 'function') renderQuestions();

  const container = document.getElementById('printExamDetails');
  if (!container) return;
  container.innerHTML = '';

  const school = (metaFields.schoolName && metaFields.schoolName.value) || 'VED Home Classes';
  const addressEl = document.querySelector('[data-school-address]');
  const address = (addressEl && addressEl.dataset.schoolAddress) || 'A1 - 203, Eros Sampoornam';
  const subject = (metaFields.subject && metaFields.subject.value) || 'Mathematics';
  const titleForPrint = paperTitle || ('Grade 5 ' + subject + ' — Term 1 Assessment');
  const durationVal = (metaFields.duration && metaFields.duration.value) || '';
  const durationText = durationVal ? durationVal + ' Minutes' : '60 Minutes';
  const totalMarks = questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);

  const studentNameInput = (metaFields.studentName && metaFields.studentName) || document.getElementById('studentName');
  const studentName = (studentNameInput && studentNameInput.value) || '';
  const dateVal = (metaFields.dateOfExam && metaFields.dateOfExam.value) ? formatDateDDMMYYYY(metaFields.dateOfExam.value) : '';

  const header = document.createElement('div');
  header.className = 'print-exam-header';

  const logo = document.createElement('div');
  logo.className = 'print-school-logo';
  logo.textContent = '🎓';
  header.appendChild(logo);

  const schoolNameEl = document.createElement('div');
  schoolNameEl.className = 'print-school-name';
  schoolNameEl.textContent = school;
  header.appendChild(schoolNameEl);

  const addressLine = document.createElement('div');
  addressLine.className = 'print-school-address';
  addressLine.textContent = address;
  header.appendChild(addressLine);

  const hr1 = document.createElement('hr');
  hr1.className = 'print-hr';
  header.appendChild(hr1);

  const titleEl = document.createElement('div');
  titleEl.className = 'print-exam-title';
  titleEl.textContent = titleForPrint;
  header.appendChild(titleEl);

  const details = document.createElement('div');
  details.className = 'print-exam-details';
  details.innerHTML =
    '<div>Student Name: ' + (studentName ? studentName : '____________________________________________') + '</div>' +
    '<div>Total Marks: ' + totalMarks + '</div>' +
    '<div>Date: ' + (dateVal ? dateVal : '____________________') + '</div>' +
    '<div>Duration: ' + durationText + '</div>';
  header.appendChild(details);

  const hr2 = document.createElement('hr');
  hr2.className = 'print-hr';
  header.appendChild(hr2);

  container.appendChild(header);

  const instructionsBox = document.createElement('div');
  instructionsBox.className = 'print-instructions-box';

  const instructionsTitle = document.createElement('div');
  instructionsTitle.className = 'print-instructions-title';
  instructionsTitle.textContent = 'General Instructions:';
  instructionsBox.appendChild(instructionsTitle);

  const instructionsList = document.createElement('ol');
  instructionsList.className = 'print-instructions-list';

  const giEl = document.getElementById('generalInstructions');
  if (giEl && giEl.value && giEl.value.trim()) {
    giEl.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean).forEach(line => {
      const li = document.createElement('li');
      li.textContent = line.replace(/^\d+[\.)]\s*/, '');
      instructionsList.appendChild(li);
    });
  } else {
    const fallback = [
      'Answer all questions.',
      'Show all working clearly.',
      'Marks are indicated next to each question.',
      'Use of calculators is not permitted.'
    ];
    fallback.forEach(text => {
      const li = document.createElement('li');
      li.textContent = text;
      instructionsList.appendChild(li);
    });
  }

  instructionsBox.appendChild(instructionsList);
  container.appendChild(instructionsBox);
  updatePrintPageStrings();
}

function updatePrintPageStrings() {
  const subject = ((metaFields.subject && metaFields.subject.value) || '').trim();
  const titleForPrint = (paperTitle || '').trim();
  const classSelect = metaFields.class || document.getElementById('className');
  const sectionSelect = metaFields.section || document.getElementById('classSection');
  const classOption = classSelect ? classSelect.options[classSelect.selectedIndex] : null;
  const sectionOption = sectionSelect ? sectionSelect.options[sectionSelect.selectedIndex] : null;
  const classValue = (classOption ? classOption.text : '').trim();
  const sectionValue = (sectionOption ? sectionOption.text : '').trim();

  let topLeft = titleForPrint || subject;
  if (titleForPrint && subject) {
    topLeft = subject + ' \u2014 ' + titleForPrint;
  }

  const parts = [];
  if (subject) parts.push(subject);
  if (classValue) parts.push('Class ' + classValue);
  if (sectionValue) parts.push('Section ' + sectionValue);
  const bottomRight = parts.join(' \u2014 ');

  const escapePageString = str => String(str)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');

  const topLeftEscaped = escapePageString(topLeft);
  const bottomRightEscaped = escapePageString(bottomRight);

  let style = document.getElementById('dynamic-page-strings');
  if (!style) {
    style = document.createElement('style');
    style.id = 'dynamic-page-strings';
    style.media = 'print';
    document.head.appendChild(style);
  }
  style.textContent = `@page {
  @top-left { content: "${topLeftEscaped}"; font-size: 9pt; color: #64748b; }
  @top-right { content: "Page " counter(page); font-size: 9pt; color: #64748b; }
  @bottom-left { content: "Generated by VED"; font-size: 9pt; color: #64748b; }
  @bottom-center { content: "\u2014 Page " counter(page) " \u2014"; font-size: 9pt; color: #64748b; }
  @bottom-right { content: "${bottomRightEscaped}"; font-size: 9pt; color: #64748b; }
}`;
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
    safeLocalStorageSet('qp-draft-v1', JSON.stringify(draft));
  } catch (e) {
    console.warn('Auto-save failed:', e);
  }
}

function loadDraft() {
  try {
    const draft = safeLocalStorageGet('qp-draft-v1');
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

    questions = (data.questions || []).map((q, i) => {
      const type = q.type || 'multiple';
      const base = {
        id: q.id || (Date.now() + Math.random() + i),
        text: typeof sanitizeHtml === 'function' ? sanitizeHtml(q.text || '') : (q.text || ''),
        marks: Number(q.marks) || 0,
        sectionId: q.sectionId || null,
        type
      };
      if (type === 'multiple') {
        base.options = Array.isArray(q.options) ? q.options.map(o => ({
          text: typeof sanitizeHtml === 'function' ? sanitizeHtml(o.text || '') : (o.text || '')
        })) : [];
      } else if (type === 'multiple_correct') {
        base.options = Array.isArray(q.options) ? q.options.map(o => ({
          text: typeof sanitizeHtml === 'function' ? sanitizeHtml(o.text || '') : (o.text || ''),
          isCorrect: !!o.isCorrect
        })) : [];
      } else if (type === 'truefalse') {
        base.options = [{ text: 'True' }, { text: 'False' }];
      } else if (type === 'fillblank') {
        base.blanks = Array.isArray(q.blanks) ? q.blanks.map(b => ({
          id: b.id || ('b-' + Date.now() + '-' + i + '-' + Math.random().toString(36).slice(2, 9)),
          answer: typeof sanitizeHtml === 'function' ? sanitizeHtml((b.answer || '').toString()) : (b.answer || '')
        })) : [{ id: 'b-' + Date.now() + '-' + i, answer: '' }];
      } else if (type === 'short' || type === 'long' || type === 'numeric') {
        base.answer = typeof sanitizeHtml === 'function' ? sanitizeHtml((q.answer !== undefined ? String(q.answer) : '').toString()) : (q.answer !== undefined ? String(q.answer) : '');
      } else if (type === 'match') {
        base.pairs = Array.isArray(q.pairs) ? q.pairs.map(p => ({
          left: typeof sanitizeHtml === 'function' ? sanitizeHtml((p.left || '').toString()) : (p.left || ''),
          right: typeof sanitizeHtml === 'function' ? sanitizeHtml((p.right || '').toString()) : (p.right || '')
        })) : [{ left: '', right: '' }];
      } else if (type === 'paragraph') {
        base.passage = typeof sanitizeHtml === 'function' ? sanitizeHtml((q.passage || '').toString()) : (q.passage || '');
        base.subQuestions = Array.isArray(q.subQuestions) ? q.subQuestions.map((sq, si) => {
          const st = sq.type || 'short';
          const sb = {
            id: sq.id || (Date.now() + Math.random() + si),
            text: typeof sanitizeHtml === 'function' ? sanitizeHtml(sq.text || '') : (sq.text || ''),
            marks: Number(sq.marks) || 0,
            type: st
          };
          if (st === 'multiple') {
            sb.options = Array.isArray(sq.options) ? sq.options.map(o => ({
              text: typeof sanitizeHtml === 'function' ? sanitizeHtml(o.text || '') : (o.text || '')
            })) : [];
          } else if (st === 'short' || st === 'long') {
            sb.answer = typeof sanitizeHtml === 'function' ? sanitizeHtml((sq.answer || '').toString()) : (sq.answer || '');
          }
          return sb;
        }) : [];
      }
      return base;
    });

    sections = (data.sections || []).map(s => ({
      ...s,
      collapsed: s.collapsed !== undefined ? !!s.collapsed : false,
      questionIds: Array.isArray(s.questionIds) ? [...s.questionIds] : []
    }));
    currentSectionId = data.currentSectionId || (sections[0] && sections[0].id) || null;
    paperTitle = (metaFields.paperTitle && metaFields.paperTitle.value) || 'Untitled Paper';
    lastSaved = data.timestamp || Date.now();
    updatePaperInfoCard();
    return true;
  } catch (e) {
    localStorage.removeItem('qp-draft-v1');
    return false;
  }
}

const debouncedSave = debounce(() => {
  lastSaved = Date.now();
  saveDraft();
  updatePaperInfoCard();
}, 1000);

// Meta inputs wiring
Object.values(metaFields).filter(input => input && input.addEventListener).forEach(input => {
  input.addEventListener('focus', () => recordState('Edit Metadata'));
  input.addEventListener('input', () => {
    updateSnapshotMeta();
    updatePrintExamDetails();
    if (input === maxMarksInput && typeof updateTotalMarks === 'function') {
      updateTotalMarks();
    }
    debouncedSave();
  });
});

[metaFields.subject, metaFields.className, metaFields.classSection, metaFields.paperTitle].forEach(field => {
  if (field && field.addEventListener) {
    field.addEventListener('input', updatePrintPageStrings);
    field.addEventListener('change', updatePrintPageStrings);
  }
});

metaFields.schoolName.addEventListener('change', () => {
  safeLocalStorageSet(SCHOOL_SELECTED_KEY, metaFields.schoolName.value);
  updateSnapshotMeta();
  updateSchoolDeleteVisibility();
  debouncedSave();
});

// Paper title edit
if (paperHeaderTitle) {
  function startEditPaperTitle(e) {
    if (e) e.stopPropagation();
    recordState('Edit Paper Title');
    const input = document.createElement('input');
    input.type = 'text';
    input.value = paperHeaderTitle.textContent || 'Untitled Paper';
    input.className = 'paper-title-input';
    input.style.cssText = 'font-size:20px;font-weight:700;color:#0f172a;border:1px solid #e2e8f0;border-radius:8px;padding:4px 8px;width:100%;';
    paperHeaderTitle.replaceWith(input);
    input.focus();
    const save = () => {
      paperTitle = input.value.trim() || 'Untitled Paper';
      paperHeaderTitle.textContent = paperTitle;
      input.replaceWith(paperHeaderTitle);
      if (metaFields.paperTitle) metaFields.paperTitle.value = paperTitle;
      updatePrintExamDetails();
      updatePrintPageStrings();
      updatePaperInfoCard();
      debouncedSave();
    };
    input.addEventListener('blur', save);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } });
  }
  paperHeaderTitle.addEventListener('click', startEditPaperTitle);
  if (editPaperTitleBtn) editPaperTitleBtn.addEventListener('click', startEditPaperTitle);
}

// Clear metadata fields
if (clearMetaBtn) {
  clearMetaBtn.addEventListener('click', () => {
    recordState('Clear Metadata');
    setTodayDateAndDefaults();
    metaFields.subject.value = '';
    metaFields.className.value = 'IV';
    metaFields.classSection.value = 'A';
    paperTitle = 'Untitled Paper';
    if (metaFields.paperTitle) metaFields.paperTitle.value = paperTitle;
    updateSnapshotMeta();
    updatePrintExamDetails();
    updatePaperInfoCard();
    debouncedSave();
  });
}

// Meta visibility for mobile
function updateMetaVisibilityForViewport() {
  if (!paperMetaBody || !metaToggleBtn) return;
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

if (metaToggleBtn) {
  metaToggleBtn.addEventListener('click', () => {
    const isMobile = window.innerWidth <= 768;
    if (!isMobile) return;
    metaCollapsedMobile = !metaCollapsedMobile;
    updateMetaVisibilityForViewport();
  });
}

function updatePaperHeaderSticky() {
  if (!paperHeaderCard) return;
  const rect = paperHeaderCard.getBoundingClientRect();
  paperHeaderCard.classList.toggle('is-stuck', rect.top <= 0);
}

window.addEventListener('resize', () => {
  updateMetaVisibilityForViewport();
});

window.addEventListener('scroll', () => {
  updateMarksInfoFloating();
  updatePaperHeaderSticky();
});

window.addEventListener('beforeprint', () => {
  document.body.classList.remove('theme-dark');
});

window.addEventListener('afterprint', () => {
  applyTheme(savedTheme);
});

// Defaults for date/maxMarks/duration + selected school (local date)
function setTodayDateAndDefaults() {
  const today = new Date();
  const year  = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day   = String(today.getDate()).padStart(2, '0');
  const isoLocal = `${year}-${month}-${day}`;

  metaFields.dateOfExam.value = isoLocal;
  metaFields.maxMarks.value = 100;
  metaFields.duration.value = 90;

  const storedSelected = safeLocalStorageGet(SCHOOL_SELECTED_KEY);
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

  let storedCode  = Number(safeLocalStorageGet(VERSION_CODE_KEY)) || 1001;
  let storedLabel = safeLocalStorageGet(VERSION_LABEL_KEY);

  // First time: generate once
  if (!storedLabel) {
    storedLabel = formatVersionString(storedCode);
    safeLocalStorageSet(VERSION_CODE_KEY, String(storedCode));
    safeLocalStorageSet(VERSION_LABEL_KEY, storedLabel);
  }

  versionInfo.textContent = storedLabel;
}

if (updateVersionBtn && versionInfo) {
  updateVersionBtn.addEventListener('click', () => {
    let currentCode = Number(safeLocalStorageGet(VERSION_CODE_KEY)) || 1001;
    currentCode += 1;

    const newLabel = formatVersionString(currentCode);

    safeLocalStorageSet(VERSION_CODE_KEY, String(currentCode));
    safeLocalStorageSet(VERSION_LABEL_KEY, newLabel);

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




function applyPrintMargins(values) {
  const root = document.documentElement;
  root.style.setProperty('--print-margin-top', values.top + 'mm');
  root.style.setProperty('--print-margin-bottom', values.bottom + 'mm');
  root.style.setProperty('--print-margin-left', values.left + 'mm');
  root.style.setProperty('--print-margin-right', values.right + 'mm');
}

function loadPrintSettings() {
  const stored = safeLocalStorageGet(PRINT_SETTINGS_KEY);
  if (!stored) return { ...DEFAULT_PRINT_MARGINS };
  try {
    const parsed = JSON.parse(stored);
    const out = { ...DEFAULT_PRINT_MARGINS };
    ['top', 'bottom', 'left', 'right'].forEach(k => {
      const v = Number(parsed[k]);
      if (!isNaN(v) && v >= 0 && v <= 50) out[k] = v;
    });
    return out;
  } catch {
    return { ...DEFAULT_PRINT_MARGINS };
  }
}

function setPrintInputs(values) {
  if (printMarginTop) printMarginTop.value = values.top;
  if (printMarginBottom) printMarginBottom.value = values.bottom;
  if (printMarginLeft) printMarginLeft.value = values.left;
  if (printMarginRight) printMarginRight.value = values.right;
}

function showPrintSettingsModal() {
  const values = loadPrintSettings();
  setPrintInputs(values);
  if (printSettingsModal) printSettingsModal.style.display = 'flex';
}

function closePrintSettingsModal() {
  if (printSettingsModal) printSettingsModal.style.display = 'none';
}

function initPrintSettings() {
  const values = loadPrintSettings();
  applyPrintMargins(values);
  setPrintInputs(values);

  if (printSettingsApply) {
    printSettingsApply.addEventListener('click', () => {
      const values = {
        top: Number(printMarginTop && printMarginTop.value),
        bottom: Number(printMarginBottom && printMarginBottom.value),
        left: Number(printMarginLeft && printMarginLeft.value),
        right: Number(printMarginRight && printMarginRight.value)
      };
      const bad = [];
      ['top', 'bottom', 'left', 'right'].forEach(k => {
        if (isNaN(values[k]) || values[k] < 0 || values[k] > 50) {
          bad.push(k);
          values[k] = DEFAULT_PRINT_MARGINS[k];
        }
      });
      if (bad.length) showStatus('Margins must be 0–50 mm', 'error');
      else {
        showStatus('Print margins applied', 'success');
        closePrintSettingsModal();
      }

      safeLocalStorageSet(PRINT_SETTINGS_KEY, JSON.stringify(values));
      applyPrintMargins(values);
      setPrintInputs(values);
    });
  }

  if (printSettingsReset) {
    printSettingsReset.addEventListener('click', () => {
      setPrintInputs(DEFAULT_PRINT_MARGINS);
      applyPrintMargins(DEFAULT_PRINT_MARGINS);
      safeLocalStorageSet(PRINT_SETTINGS_KEY, JSON.stringify(DEFAULT_PRINT_MARGINS));
      showStatus('Margins reset to default', 'success');
    });
  }

  if (printSettingsClose) {
    printSettingsClose.addEventListener('click', closePrintSettingsModal);
  }

  if (printSettingsCancel) {
    printSettingsCancel.addEventListener('click', closePrintSettingsModal);
  }

  if (printSettingsModal) {
    printSettingsModal.addEventListener('click', (e) => {
      if (e.target === printSettingsModal) closePrintSettingsModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && printSettingsModal && printSettingsModal.style.display !== 'none') {
      closePrintSettingsModal();
    }
  });
}

// Saved papers dashboard
const SAVED_EXAMS_KEY = 'savedExams';

function getSavedPapers() {
  const raw = safeLocalStorageGet(SAVED_EXAMS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setSavedPapers(list) {
  try {
    safeLocalStorageSet(SAVED_EXAMS_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

function recordSavedExam(paper) {
  if (!paper || typeof paper !== 'object') return;
  const list = getSavedPapers();
  const idx = list.findIndex(p => p.id === paper.id);
  const entry = JSON.parse(JSON.stringify(paper));
  entry.updatedAt = new Date().toISOString();
  if (idx >= 0) list[idx] = entry;
  else list.unshift(entry);
  setSavedPapers(list);
}

let savedPapersFilters = { school: 'Ved Home Classes', class: '', section: '', subject: 'all', date: 'all', from: '', to: '', search: '' };

function newId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return Date.now().toString(36);
}

function showEditorView() {
  currentView = 'editor';
  if (editorWorkspace) editorWorkspace.classList.remove('hidden');
  if (savedPapersView) savedPapersView.classList.add('hidden');
  if (typeof showEditor === 'function') showEditor();
}

async function showSavedPapersView() {
  if (typeof hasUnsavedChanges === 'function' && hasUnsavedChanges()) {
    const ok = await showConfirm('You have unsaved changes. Leave without saving?', 'Leave');
    if (!ok) return;
  }
  if (typeof showEditor === 'function') showEditor();
  currentView = 'open';
  if (editorWorkspace) editorWorkspace.classList.add('hidden');
  if (savedPapersView) {
    savedPapersView.classList.remove('hidden');
    renderSavedPapers();
  }
}

function formatSavedDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getPaperTitle(paper) {
  if (!paper || typeof paper !== 'object') return 'Untitled Paper';
  return (paper.meta && paper.meta.paperTitle) || paper.name || 'Untitled Paper';
}

function filterSavedPapers() {
  const list = getSavedPapers();
  const f = savedPapersFilters;
  const term = (f.search || '').toLowerCase();
  return list.filter(p => {
    if (!p || typeof p !== 'object') return false;
    const meta = p.meta || {};
    const title = getPaperTitle(p).toLowerCase();
    const subject = (meta.subject || '').toLowerCase();
    const cls = (meta.className || '').toLowerCase();
    if (term && !title.includes(term) && !subject.includes(term) && !cls.includes(term)) return false;
    if (f.class && meta.className !== f.class) return false;
    if (f.section && meta.classSection !== f.section) return false;
    if (f.school && meta.schoolName !== f.school) return false;
    if (f.subject && f.subject !== 'all' && (meta.subject || '').toLowerCase() !== f.subject.toLowerCase()) return false;
    if (f.date && f.date !== 'all') {
      const raw = p.updatedAt || p.createdAt || meta.dateOfExam;
      const d = raw ? new Date(raw) : null;
      if (d && !isNaN(d.getTime())) {
        const now = new Date();
        const diff = now - d;
        if (f.date === '7' && diff > 7 * 24 * 60 * 60 * 1000) return false;
        if (f.date === '30' && diff > 30 * 24 * 60 * 60 * 1000) return false;
        if (f.date === 'term' && d.getFullYear() !== now.getFullYear()) return false;
      }
    }
    return true;
  });
}

function renderSavedPapers() {
  const grid = document.getElementById('savedPapersGrid');
  const empty = document.getElementById('savedPapersEmpty');
  if (!grid) return;
  const papers = filterSavedPapers();
  grid.innerHTML = '';
  if (papers.length === 0) {
    if (empty) empty.style.display = 'flex';
    return;
  }
  if (empty) empty.style.display = 'none';
  papers.forEach(paper => {
    const meta = paper.meta || {};
    const date = formatSavedDate(paper.updatedAt || paper.createdAt || meta.dateOfExam) || '—';
    const title = getPaperTitle(paper);
    const subject = meta.subject || '—';
    const cls = meta.className || '—';
    const qCount = Array.isArray(paper.questions) ? paper.questions.length : 0;
    const marks = (Array.isArray(paper.questions) ? paper.questions.reduce((s, q) => s + (Number(q.marks) || 0), 0) : 0);
    const card = document.createElement('div');
    card.className = 'paper-card';
    card.innerHTML = `
      <div class="paper-card-date">${date}</div>
      <div class="paper-card-title" title="${title.replace(/"/g, '&quot;').replace(/'/g, '&apos;')}">${title}</div>
      <div class="paper-card-row">Subject: ${subject} • Class ${cls}</div>
      <div class="paper-card-stats">${qCount} Question${qCount === 1 ? '' : 's'} • ${marks} Marks</div>
      <div class="paper-card-divider"></div>
      <div class="paper-card-actions">
        <button type="button" class="paper-card-btn paper-card-open" data-id="${paper.id || ''}">Open <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></button>
        <button type="button" class="paper-card-btn paper-card-duplicate" data-id="${paper.id || ''}">Duplicate <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
        <button type="button" class="paper-card-btn paper-card-rename" data-id="${paper.id || ''}">Rename</button>
        <button type="button" class="paper-card-btn paper-card-delete" data-id="${paper.id || ''}">Delete</button>
      </div>
    `;
    grid.appendChild(card);
  });
  grid.querySelectorAll('.paper-card-open').forEach(btn => {
    btn.onclick = () => openSavedPaper(btn.dataset.id);
  });
  grid.querySelectorAll('.paper-card-duplicate').forEach(btn => {
    btn.onclick = () => duplicateSavedPaper(btn.dataset.id);
  });
  grid.querySelectorAll('.paper-card-rename').forEach(btn => {
    btn.onclick = () => renameSavedPaper(btn.dataset.id);
  });
  grid.querySelectorAll('.paper-card-delete').forEach(btn => {
    btn.onclick = () => deleteSavedPaper(btn.dataset.id);
  });
}

async function openSavedPaper(id) {
  const list = getSavedPapers();
  const paper = list.find(p => p.id === id);
  if (!paper) return;
  if (typeof hasUnsavedChanges === 'function' && hasUnsavedChanges()) {
    const ok = await showConfirm('Unsaved Changes. You have unsaved changes. Do you want to continue?', 'Continue');
    if (!ok) return;
  }
  if (typeof loadPaper === 'function') loadPaper(paper);
  showEditorView();
}

function duplicateSavedPaper(id) {
  const list = getSavedPapers();
  const idx = list.findIndex(p => p.id === id);
  if (idx < 0) return;
  const clone = JSON.parse(JSON.stringify(list[idx]));
  clone.id = newId();
  clone.name = (clone.name || getPaperTitle(clone)) + ' (Copy)';
  clone.createdAt = new Date().toISOString();
  clone.updatedAt = clone.createdAt;
  list.splice(idx + 1, 0, clone);
  setSavedPapers(list);
  renderSavedPapers();
}

function renameSavedPaper(id) {
  const list = getSavedPapers();
  const paper = list.find(p => p.id === id);
  if (!paper) return;
  const current = getPaperTitle(paper);
  const newName = prompt('Rename paper:', current);
  if (!newName || newName === current) return;
  paper.name = newName;
  if (!paper.meta) paper.meta = {};
  paper.meta.paperTitle = newName;
  paper.updatedAt = new Date().toISOString();
  setSavedPapers(list);
  renderSavedPapers();
}

async function deleteSavedPaper(id) {
  const ok = await showConfirm('Delete this saved paper? This cannot be undone.', 'Delete');
  if (!ok) return;
  const list = getSavedPapers().filter(p => p.id !== id);
  setSavedPapers(list);
  renderSavedPapers();
}

function initSavedPapersView() {
  if (!savedPapersView) return;
  const schoolSelect = document.getElementById('savedPapersSchool');
  const searchInput = document.getElementById('savedPapersSearch');
  if (schoolSelect) {
    schoolSelect.value = savedPapersFilters.school;
    schoolSelect.onchange = () => { savedPapersFilters.school = schoolSelect.value; renderSavedPapers(); };
  }
  if (searchInput) {
    searchInput.oninput = () => { savedPapersFilters.search = searchInput.value; renderSavedPapers(); };
  }
  savedPapersView.querySelectorAll('[data-filter-group]').forEach(group => {
    const groupName = group.dataset.filterGroup;
    group.querySelectorAll('[data-filter-value]').forEach(chip => {
      chip.onclick = () => {
        group.querySelectorAll('[data-filter-value]').forEach(c => c.classList.remove('chip-active'));
        chip.classList.add('chip-active');
        savedPapersFilters[groupName] = chip.dataset.filterValue;
        renderSavedPapers();
      };
    });
  });
  const fromInput = document.getElementById('savedPapersFrom');
  const toInput = document.getElementById('savedPapersTo');
  if (fromInput) fromInput.onchange = () => { savedPapersFilters.from = fromInput.value; renderSavedPapers(); };
  if (toInput) toInput.onchange = () => { savedPapersFilters.to = toInput.value; renderSavedPapers(); };
}

// Landing screen actions
const landingNewBtn = document.getElementById('landingNewBtn');
const landingCreateBtn = document.getElementById('landingCreateBtn');
const landingOpenBtn = document.getElementById('landingOpenBtn');
const landingOpenCardBtn = document.getElementById('landingOpenCardBtn');
const landingSaveBtn = document.getElementById('landingSaveBtn');
const landingRecentBtn = document.getElementById('landingRecentBtn');
const landingRecentCardBtn = document.getElementById('landingRecentCardBtn');
const landingPrintBtn = document.getElementById('landingPrintBtn');

function onLandingNew() {
  if (typeof onNewPaperRequested === 'function') {
    onNewPaperRequested();
  } else if (typeof newPaper === 'function') {
    newPaper();
  }
}
if (landingNewBtn) landingNewBtn.addEventListener('click', onLandingNew);
if (landingCreateBtn) landingCreateBtn.addEventListener('click', onLandingNew);

function onLandingOpen() {
  if (typeof openPaperFromPicker === 'function') {
    openPaperFromPicker();
  } else if (openPaperInput) {
    openPaperInput.click();
  }
}
if (landingOpenBtn) landingOpenBtn.addEventListener('click', onLandingOpen);
if (landingOpenCardBtn) landingOpenCardBtn.addEventListener('click', onLandingOpen);

if (landingSaveBtn) landingSaveBtn.addEventListener('click', () => alert('No paper is open. Create a new paper to save.'));

function onLandingRecent() {
  if (typeof showSavedPapersView === 'function') showSavedPapersView();
}
if (landingRecentBtn) landingRecentBtn.addEventListener('click', onLandingRecent);
if (landingRecentCardBtn) landingRecentCardBtn.addEventListener('click', onLandingRecent);

if (landingPrintBtn) landingPrintBtn.addEventListener('click', () => alert('There is no paper to print yet.'));

const editorRecentBtn = document.getElementById('editorRecentBtn');
const editorPrintBtn = document.getElementById('editorPrintBtn');
const editorPrintDropdownMenu = document.getElementById('editorPrintDropdownMenu');
if (editorRecentBtn) editorRecentBtn.addEventListener('click', onLandingRecent);
if (editorPrintBtn) {
  editorPrintBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (editorPrintDropdownMenu) editorPrintDropdownMenu.style.display = editorPrintDropdownMenu.style.display === 'none' ? 'flex' : 'none';
  });
}
if (editorPrintDropdownMenu) {
  editorPrintDropdownMenu.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      editorPrintDropdownMenu.style.display = 'none';
      const action = btn.dataset.action;
      if (action === 'print' && typeof doPrint === 'function') doPrint();
      if (action === 'settings' && typeof showPrintSettingsModal === 'function') showPrintSettingsModal();
    });
  });
}
document.addEventListener('click', () => { if (editorPrintDropdownMenu) editorPrintDropdownMenu.style.display = 'none'; });

// Public init for this core file
function initCore() {
  try { loadSchoolOptionsFromStorage(); } catch (e) { console.warn('loadSchoolOptionsFromStorage failed', e); }
  try { setTodayDateAndDefaults(); } catch (e) { console.warn('setTodayDateAndDefaults failed', e); }
  try { updateMetaVisibilityForViewport(); } catch (e) { console.warn('updateMetaVisibilityForViewport failed', e); }
  try { updateMarksInfoFloating(); } catch (e) { console.warn('updateMarksInfoFloating failed', e); }
  try { initVersion(); } catch (e) { console.warn('initVersion failed', e); }
  try { initPrintSettings(); } catch (e) { console.warn('initPrintSettings failed', e); }
  try { initSavedPapersView(); } catch (e) { console.warn('initSavedPapersView failed', e); }
}
