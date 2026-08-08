// ===== PAPER.JS =====
// New / Open / Save workflow for question papers.
// Depends on: metaFields, questions, createEmptyQuestion, renderQuestions,
// updateSnapshotMeta, updatePrintExamDetails, updateTotalMarks, sanitizeHtml,
// setTodayDateAndDefaults (core.js)

let currentPaper = {
  id: null,
  name: '',
  createdAt: null,
  updatedAt: null,
  version: null,
  filename: ''
};

function sanitizeFilename(name) {
  return name
    .replace(/[\\/?:*"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim() || 'question-paper';
}

function formatDateLocal() {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

function generateBaseName() {
  const subject = (metaFields.subject.value || '').trim().replace(/\s+/g, '_') || 'ExamPaper';
  const className = (metaFields.className.value || '').trim();
  const rawDate = metaFields.examDate.value;
  const date = rawDate ? rawDate : formatDateLocal();
  let base = subject;
  if (className) base += '_' + className;
  base += '_' + date;
  return sanitizeFilename(base);
}

function showStatus(message, type) {
  const el = document.getElementById('statusMessage');
  if (!el) return;
  el.textContent = message;
  el.className = 'status-message' + (type ? ' status-' + type : '');
  if (el._timeout) clearTimeout(el._timeout);
  el._timeout = setTimeout(() => {
    el.textContent = '';
    el.className = 'status-message';
  }, 4000);
}

function normalizeQuestions(rawQuestions) {
  if (!Array.isArray(rawQuestions)) return [];
  return rawQuestions.map(q => ({
    id: q.id || (Date.now() + Math.random()),
    text: sanitizeHtml((q.text || '').toString()),
    marks: Number(q.marks) || 0,
    options: Array.isArray(q.options)
      ? q.options.map(o => ({ text: sanitizeHtml((o.text || '').toString()) }))
      : []
  }));
}

function validateAndNormalize(fileName, data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { valid: false, error: 'Invalid file: not a valid JSON object.' };
  }

  if (data.version !== undefined && typeof data.version !== 'number') {
    return { valid: false, error: 'Invalid file: version must be a number.' };
  }

  if (data.version !== undefined && data.version > 1) {
    return { valid: false, error: 'This file was created with a newer version of the app and cannot be opened here.' };
  }

  const meta = data.meta || {};
  const rawQuestions = Array.isArray(data.questions) ? data.questions : [];

  if (Object.keys(meta).length === 0 && rawQuestions.length === 0) {
    return { valid: false, error: 'Invalid file: missing paper metadata and questions.' };
  }

  for (let i = 0; i < rawQuestions.length; i++) {
    const q = rawQuestions[i];
    if (!q || typeof q !== 'object') {
      return { valid: false, error: 'Invalid question at index ' + (i + 1) + '.' };
    }
    if (typeof q.text !== 'string' || (typeof q.marks !== 'number' && isNaN(Number(q.marks)))) {
      return { valid: false, error: 'Invalid question at index ' + (i + 1) + ': missing text or marks.' };
    }
  }

  const now = new Date().toISOString();
  const baseName = fileName.replace(/\.(json|ved)$/i, '').trim() || 'Untitled paper';

  return {
    valid: true,
    paper: {
      id: data.id || (Date.now() + Math.random()).toString(),
      name: data.name || baseName,
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now,
      meta: {
        schoolName: meta.schoolName || '',
        subject: meta.subject || '',
        className: meta.className || '',
        classSection: meta.classSection || '',
        examDate: meta.examDate || '',
        duration: meta.duration !== undefined ? String(meta.duration) : '',
        maxMarks: meta.maxMarks !== undefined ? String(meta.maxMarks) : ''
      },
      questions: normalizeQuestions(rawQuestions)
    }
  };
}

function loadPaper(paper) {
  currentPaper = {
    id: paper.id || null,
    name: paper.name || '',
    createdAt: paper.createdAt || null,
    updatedAt: paper.updatedAt || null,
    version: paper.version || null,
    filename: paper.filename || ''
  };

  Object.keys(metaFields).forEach(key => {
    metaFields[key].value = (paper.meta && paper.meta[key]) ? paper.meta[key] : '';
  });

  questions = paper.questions || [];
  renderQuestions();
  updateSnapshotMeta();
  updatePrintExamDetails();
  updateTotalMarks();
  showStatus('Opened: ' + currentPaper.name, 'success');
  markSaved();
}

function newPaper() {
  currentPaper = {
    id: null,
    name: '',
    createdAt: null,
    updatedAt: null,
    version: null,
    filename: ''
  };

  questions = [];

  if (typeof setTodayDateAndDefaults === 'function') {
    setTodayDateAndDefaults();
  }
  metaFields.schoolName.value = 'Ved Home Classes';
  metaFields.subject.value = '';
  metaFields.className.value = 'IV';
  metaFields.classSection.value = 'A';

  questions.push(createEmptyQuestion());
  renderQuestions();
  updateSnapshotMeta();
  updatePrintExamDetails();
  updateTotalMarks();
  showStatus('New paper created', 'success');
  markSaved();
}

function downloadPaper(paper, filename) {
  const blob = new Blob([JSON.stringify(paper, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function savePaper() {
  const name = currentPaper.name || window.prompt('Save paper as:', 'Untitled paper');
  if (name === null || name.trim() === '') return;

  currentPaper.name = name.trim();
  if (!currentPaper.id) currentPaper.id = (Date.now() + Math.random()).toString();

  const now = new Date().toISOString();
  if (!currentPaper.createdAt) currentPaper.createdAt = now;
  currentPaper.updatedAt = now;

  const meta = Object.fromEntries(
    Object.entries(metaFields).map(([k, v]) => [k, v.value])
  );

  const paper = {
    version: 1,
    id: currentPaper.id,
    name: currentPaper.name,
    createdAt: currentPaper.createdAt,
    updatedAt: currentPaper.updatedAt,
    meta,
    questions: questions.map(q => ({ ...q }))
  };

  const filename = sanitizeFilename(currentPaper.name) + '.json';
  downloadPaper(paper, filename);
  showStatus('Saved: ' + filename, 'success');
  markSaved();
}

function openPaper(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = evt => {
    try {
      const data = JSON.parse(evt.target.result);
      const result = validateAndNormalize(file.name, data);
      if (!result.valid) {
        showStatus(result.error, 'error');
        return;
      }
      loadPaper(result.paper);
    } catch (err) {
      showStatus('Invalid file: ' + (err.message || 'Could not parse JSON.'), 'error');
    }
  };
  reader.onerror = () => showStatus('Failed to read file.', 'error');
  reader.readAsText(file);
}

let savedSnapshot = null;

function getCurrentState() {
  const meta = {};
  Object.keys(metaFields).forEach(key => {
    meta[key] = metaFields[key] ? metaFields[key].value : '';
  });
  return { meta, questions };
}

function markSaved() {
  savedSnapshot = JSON.parse(JSON.stringify(getCurrentState()));
  updateSaveButtonState();
}

function hasUnsavedChanges() {
  if (!savedSnapshot) return false;
  return JSON.stringify(getCurrentState()) !== JSON.stringify(savedSnapshot);
}

function updateSaveButtonState() {
  const btn = document.getElementById('savePaperBtn');
  if (!btn) return;
  if (hasUnsavedChanges()) {
    btn.innerHTML = '<span class=\"icon\">🔴</span><span>Save</span>';
  } else {
    btn.innerHTML = '<span class=\"icon\">💾</span><span>Save</span>';
  }
}

async function onNewPaperRequested() {
  if (hasUnsavedChanges()) {
    const ok = await showConfirm('Unsaved Changes. You have unsaved changes. Do you want to continue?', 'Continue');
    if (!ok) return;
  }
  newPaper();
}

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
    e.preventDefault();
    savePaper();
  }
});

document.addEventListener('input', updateSaveButtonState);
document.addEventListener('change', updateSaveButtonState);
