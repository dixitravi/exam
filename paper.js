// ===== PAPER.JS =====
// New / Open / Save workflow for question papers.
// Depends on: metaFields, questions, createEmptyQuestion, renderQuestions,
// updateSnapshotMeta, updatePrintExamDetails, updateTotalMarks, sanitizeHtml,
// setTodayDateAndDefaults (core.js)

let fileHandle = null;

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
  return rawQuestions.map((q, i) => {
    const type = (q && q.type) ? q.type : 'multiple';
    const base = {
      id: q.id || (Date.now() + Math.random() + i),
      text: sanitizeHtml((q.text || '').toString()),
      marks: Number(q.marks) || 0,
      sectionId: q.sectionId || null,
      type
    };
    if (type === 'multiple') {
      base.options = Array.isArray(q.options)
        ? q.options.map(o => ({ text: sanitizeHtml((o.text || '').toString()) }))
        : [];
    } else if (type === 'multiple_correct') {
      base.options = Array.isArray(q.options)
        ? q.options.map(o => ({
            text: sanitizeHtml((o.text || '').toString()),
            isCorrect: !!o.isCorrect
          }))
        : [];
    } else if (type === 'truefalse') {
      base.options = [{ text: 'True' }, { text: 'False' }];
    } else if (type === 'fillblank') {
      base.blanks = Array.isArray(q.blanks)
        ? q.blanks.map(b => ({
            id: b.id || ('b-' + Date.now() + '-' + i + '-' + Math.random().toString(36).slice(2, 9)),
            answer: typeof b.answer === 'string' ? sanitizeHtml(b.answer) : ''
          }))
        : [{ id: 'b-' + Date.now() + '-' + i, answer: '' }];
    } else if (type === 'short' || type === 'long' || type === 'numeric') {
      base.answer = typeof q.answer === 'string' ? sanitizeHtml(q.answer) : (q.answer !== undefined ? String(q.answer) : '');
    } else if (type === 'match') {
      base.pairs = Array.isArray(q.pairs)
        ? q.pairs.map(p => ({ left: sanitizeHtml((p.left || '').toString()), right: sanitizeHtml((p.right || '').toString()) }))
        : [{ left: '', right: '' }];
    } else if (type === 'paragraph') {
      base.passage = typeof q.passage === 'string' ? sanitizeHtml(q.passage) : '';
      base.subQuestions = Array.isArray(q.subQuestions)
        ? normalizeSubQuestions(q.subQuestions)
        : [];
    }
    return base;
  });
}

function normalizeSubQuestions(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((q, i) => {
    const type = q && q.type ? q.type : 'short';
    const base = {
      id: q.id || (Date.now() + Math.random() + i),
      text: sanitizeHtml((q.text || '').toString()),
      marks: Number(q.marks) || 0,
      type
    };
    if (type === 'multiple') {
      base.options = Array.isArray(q.options)
        ? q.options.map(o => ({ text: sanitizeHtml((o.text || '').toString()) }))
        : [];
    } else if (type === 'short' || type === 'long') {
      base.answer = typeof q.answer === 'string' ? sanitizeHtml(q.answer) : '';
    }
    return base;
  });
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
      sections: Array.isArray(data.sections) ? data.sections : undefined,
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

  if (Array.isArray(paper.sections) && paper.sections.length > 0) {
    sections = paper.sections.map(s => ({
      id: s.id || generateSectionId(),
      name: s.name || 'SECTION',
      type: s.type || 'Multiple Choice',
      instructions: s.instructions || '',
      collapsed: s.collapsed !== undefined ? !!s.collapsed : false,
      questionIds: Array.isArray(s.questionIds) ? [...s.questionIds] : []
    }));
  } else {
    const defaultSectionId = generateSectionId();
    sections = [{
      id: defaultSectionId,
      name: 'SECTION A',
      type: 'Multiple Choice',
      instructions: '',
      collapsed: false,
      questionIds: (paper.questions || []).map(q => q.id)
    }];
  }
  currentSectionId = sections[0].id;

  questions = normalizeQuestions(paper.questions || []);

  const validSectionIds = new Set(sections.map(s => s.id));
  questions.forEach(q => {
    if (!q.sectionId || !validSectionIds.has(q.sectionId)) q.sectionId = currentSectionId;
  });

  renderQuestions();
  updateSnapshotMeta();
  updatePrintExamDetails();
  updateTotalMarks();
  showStatus('Opened: ' + currentPaper.name, 'success');
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
  const defaultSectionId = generateSectionId();
  sections = [{
    id: defaultSectionId,
    name: 'SECTION A',
    type: 'Multiple Choice',
    instructions: '',
    collapsed: false,
    questionIds: []
  }];
  currentSectionId = defaultSectionId;

  if (typeof setTodayDateAndDefaults === 'function') {
    setTodayDateAndDefaults();
  }
  metaFields.schoolName.value = 'Ved Home Classes';
  metaFields.subject.value = '';
  metaFields.className.value = 'IV';
  metaFields.classSection.value = 'A';
  metaFields.paperTitle.value = '';

  const firstQuestion = createEmptyQuestion();
  firstQuestion.sectionId = defaultSectionId;
  sections[0].questionIds.push(firstQuestion.id);
  questions.push(firstQuestion);
  renderQuestions();
  updateSnapshotMeta();
  updatePrintExamDetails();
  updateTotalMarks();
  fileHandle = null;
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

async function savePaper() {
  const meta = Object.fromEntries(
    Object.entries(metaFields).map(([k, v]) => [k, v ? v.value : ''])
  );

  const sectionQuestionIds = {};
  sections.forEach(s => { sectionQuestionIds[s.id] = []; });
  questions.forEach(q => {
    if (sectionQuestionIds[q.sectionId] !== undefined) {
      sectionQuestionIds[q.sectionId].push(q.id);
    } else if (sections[0]) {
      sectionQuestionIds[sections[0].id].push(q.id);
    }
  });

  const paper = {
    version: 1,
    id: currentPaper.id || (Date.now() + Math.random()).toString(),
    name: currentPaper.name || generateBaseName(),
    createdAt: currentPaper.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    filename: currentPaper.filename,
    meta,
    sections: sections.map(s => ({ ...s, questionIds: sectionQuestionIds[s.id] || [] })),
    questions: questions.map(q => ({ ...q }))
  };

  if (fileHandle) {
    const granted = await verifyFilePermission(fileHandle, true);
    if (!granted) {
      showStatus('Write permission denied', 'error');
      return;
    }
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(paper, null, 2));
    await writable.close();
    currentPaper.id = paper.id;
    currentPaper.name = paper.name;
    currentPaper.createdAt = paper.createdAt;
    currentPaper.updatedAt = paper.updatedAt;
    showStatus('Saved: ' + currentPaper.filename, 'success');
    markSaved();
    return;
  }

  if ('showSaveFilePicker' in window) {
    const suggested = currentPaper.filename || (generateBaseName() + '.json');
    try {
      const newHandle = await window.showSaveFilePicker({
        suggestedName: suggested,
        types: [{
          description: 'JSON Paper Files',
          accept: { 'application/json': ['.json', '.ved'] }
        }]
      });
      fileHandle = newHandle;
      currentPaper.filename = newHandle.name;
      currentPaper.name = newHandle.name;
      const writable = await newHandle.createWritable();
      await writable.write(JSON.stringify(paper, null, 2));
      await writable.close();
      currentPaper.id = paper.id;
      currentPaper.createdAt = paper.createdAt;
      currentPaper.updatedAt = paper.updatedAt;
      showStatus('Saved: ' + currentPaper.filename, 'success');
      markSaved();
    } catch (err) {
      if (err.name !== 'AbortError') {
        showStatus('Save failed: ' + err.message, 'error');
      }
    }
    return;
  }

  const filename = currentPaper.filename || (generateBaseName() + '.json');
  currentPaper.filename = filename;
  currentPaper.name = currentPaper.name || generateBaseName();
  currentPaper.id = paper.id;
  currentPaper.createdAt = paper.createdAt;
  currentPaper.updatedAt = paper.updatedAt;
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
      fileHandle = null;
      currentPaper.filename = file.name;
      markSaved();
    } catch (err) {
      showStatus('Invalid file: ' + (err.message || 'Could not parse JSON.'), 'error');
    }
  };
  reader.onerror = () => showStatus('Failed to read file.', 'error');
  reader.readAsText(file);
}

async function verifyFilePermission(handle, readWrite) {
  const options = {};
  if (readWrite) options.mode = 'readwrite';
  if ((await handle.queryPermission(options)) === 'granted') return true;
  if ((await handle.requestPermission(options)) === 'granted') return true;
  return false;
}

async function openPaperFromPicker() {
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{
        description: 'JSON Paper Files',
        accept: { 'application/json': ['.json', '.ved'] }
      }]
    });
    const file = await handle.getFile();
    const data = JSON.parse(await file.text());
    const result = validateAndNormalize(handle.name, data);
    if (!result.valid) {
      showStatus(result.error, 'error');
      return;
    }
    loadPaper(result.paper);
    fileHandle = handle;
    currentPaper.filename = handle.name;
    markSaved();
  } catch (err) {
    if (err.name !== 'AbortError') {
      showStatus('Open failed: ' + err.message, 'error');
    }
  }
}

function updateCurrentFileInfo() {
  const el = document.getElementById('currentFileInfo');
  if (!el) return;
  const filename = currentPaper.filename || 'Untitled paper';
  const dirty = hasUnsavedChanges() ? ' *' : '';
  el.innerHTML = '📄 ' + filename + dirty;
}

let savedSnapshot = null;

function getCurrentState() {
  const meta = {};
  Object.keys(metaFields).forEach(key => {
    meta[key] = metaFields[key] ? metaFields[key].value : '';
  });
  return { meta, questions, sections, currentSectionId };
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
  if (btn) {
    btn.innerHTML = hasUnsavedChanges() ? '<span class="icon">🔴</span><span>Save</span>' : '<span class="icon">💾</span><span>Save</span>';
  }
  updateCurrentFileInfo();
}

async function onNewPaperRequested() {
  if (hasUnsavedChanges()) {
    const ok = await showConfirm('Unsaved Changes. You have unsaved changes. Do you want to continue?', 'Continue');
    if (!ok) return;
  }
  newPaper();
}

async function autoSave() {
  if (!hasUnsavedChanges()) return;

  const meta = Object.fromEntries(
    Object.entries(metaFields).map(([k, v]) => [k, v ? v.value : ''])
  );

  const sectionQuestionIds = {};
  sections.forEach(s => { sectionQuestionIds[s.id] = []; });
  questions.forEach(q => {
    if (sectionQuestionIds[q.sectionId] !== undefined) {
      sectionQuestionIds[q.sectionId].push(q.id);
    } else if (sections[0]) {
      sectionQuestionIds[sections[0].id].push(q.id);
    }
  });

  const paper = {
    version: 1,
    id: currentPaper.id || (Date.now() + Math.random()).toString(),
    name: currentPaper.name || generateBaseName(),
    createdAt: currentPaper.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    filename: currentPaper.filename,
    meta,
    sections: sections.map(s => ({ ...s, questionIds: sectionQuestionIds[s.id] || [] })),
    questions: questions.map(q => ({ ...q }))
  };

  if (fileHandle) {
    const granted = await verifyFilePermission(fileHandle, true);
    if (!granted) return;
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(paper, null, 2));
    await writable.close();
    currentPaper.updatedAt = paper.updatedAt;
    markSaved();
    showStatus('Auto Saved', 'success');
    return;
  }

  try {
    localStorage.setItem('exam_autosave_draft', JSON.stringify({ paper, savedAt: new Date().toISOString() }));
    markSaved();
    showStatus('Auto Saved', 'success');
  } catch (err) {
    // storage full or unavailable
  }
}
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
    e.preventDefault();
    savePaper();
  }
});

document.addEventListener('input', updateSaveButtonState);
document.addEventListener('change', updateSaveButtonState);
setInterval(autoSave, 10000);
