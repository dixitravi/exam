// ===== HISTORY.JS =====
// Snapshot-based undo/redo for the Exam Paper Designer.
// Depends on: paperTitle, sections, questions, currentSectionId,
// renderQuestions, updatePaperInfoCard, updateTotalMarks, showStatus.

const MAX_HISTORY = 10;
let undoStack = [];
let redoStack = [];
let isApplying = false;

const META_IDS = [
  'paperTitle', 'schoolName', 'subject', 'className', 'classSection',
  'dateOfExam', 'duration', 'maxMarks'
];

function getMetaValues() {
  const meta = {};
  META_IDS.forEach(id => {
    const el = document.getElementById(id);
    meta[id] = el ? el.value : '';
  });
  return meta;
}

function setMetaValues(meta) {
  META_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el && meta[id] !== undefined) el.value = meta[id];
  });
}

function getCurrentSnapshot() {
  return {
    paperTitle: typeof paperTitle !== 'undefined' ? paperTitle : 'Untitled Paper',
    meta: getMetaValues(),
    sections: JSON.parse(JSON.stringify(Array.isArray(sections) ? sections : [])),
    questions: JSON.parse(JSON.stringify(Array.isArray(questions) ? questions : [])),
    currentSectionId: typeof currentSectionId !== 'undefined' ? currentSectionId : null,
    actionName: ''
  };
}

function recordState(actionName) {
  if (isApplying) return;
  const snapshot = getCurrentSnapshot();
  snapshot.actionName = actionName || '';
  undoStack.push(snapshot);
  redoStack = [];
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  updateHistoryButtons();
}

function canUndo() { return undoStack.length > 0; }
function canRedo() { return redoStack.length > 0; }

function updateHistoryButtons() {
  const undoBtn = document.getElementById('undoBtn');
  const redoBtn = document.getElementById('redoBtn');
  if (undoBtn) undoBtn.disabled = !canUndo();
  if (redoBtn) redoBtn.disabled = !canRedo();
}

function applyState(snapshot) {
  if (!snapshot) return;
  isApplying = true;

  if (typeof paperTitle !== 'undefined') paperTitle = snapshot.paperTitle || 'Untitled Paper';
  setMetaValues(snapshot.meta || {});

  if (typeof sections !== 'undefined') sections = JSON.parse(JSON.stringify(snapshot.sections || []));
  if (typeof questions !== 'undefined') questions = JSON.parse(JSON.stringify(snapshot.questions || []));
  if (typeof currentSectionId !== 'undefined') currentSectionId = snapshot.currentSectionId || null;

  if (typeof renderQuestions === 'function') renderQuestions();
  if (typeof updateTotalMarks === 'function') updateTotalMarks();
  if (typeof updatePaperInfoCard === 'function') updatePaperInfoCard();

  updateHistoryButtons();
  isApplying = false;
}

function showHistoryMessage(message, type) {
  if (typeof showStatus === 'function') {
    showStatus(message, type);
  } else {
    try { alert(message); } catch {}
  }
}

function undo() {
  if (!canUndo()) return;
  const current = getCurrentSnapshot();
  const snapshot = undoStack.pop();
  redoStack.push(current);
  applyState(snapshot);
  showHistoryMessage('Undid ' + (snapshot.actionName || 'action'), 'success');
}

function redo() {
  if (!canRedo()) return;
  const current = getCurrentSnapshot();
  const snapshot = redoStack.pop();
  undoStack.push(current);
  applyState(snapshot);
  showHistoryMessage('Redid ' + (snapshot.actionName || 'action'), 'success');
}

function resetHistory() {
  undoStack = [];
  redoStack = [];
  updateHistoryButtons();
}

window.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return;
  const k = e.key.toLowerCase();

  if (k === 'z' && e.shiftKey) {
    e.preventDefault();
    redo();
  } else if (k === 'z') {
    e.preventDefault();
    undo();
  } else if (k === 'y') {
    e.preventDefault();
    redo();
  }
});

window.recordState = recordState;
window.undo = undo;
window.redo = redo;
window.canUndo = canUndo;
window.canRedo = canRedo;
window.updateHistoryButtons = updateHistoryButtons;
window.resetHistory = resetHistory;
