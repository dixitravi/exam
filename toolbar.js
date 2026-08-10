// ===== TOOLBAR.JS =====
// Depends on: questions, addQuestionBtn, printBtn,
// newPaper, openPaper, savePaper,
// renderQuestions, debouncedSave

const newPaperBtn = document.getElementById('newPaperBtn');
const openPaperBtn = document.getElementById('openPaperBtn');
const savePaperBtn = document.getElementById('savePaperBtn');
const openPaperInput = document.getElementById('openPaperInput');
const addSectionBtn = document.getElementById('addSectionBtn');

const newPaperBtnBottom = document.getElementById('newPaperBtnBottom');
const openPaperBtnBottom = document.getElementById('openPaperBtnBottom');
const savePaperBtnBottom = document.getElementById('savePaperBtnBottom');
const printBtnBottom = document.getElementById('printBtnBottom');

// Top toolbar: Add Question / Section
if (addQuestionBtn) addQuestionBtn.onclick = () => {
  addQuestionOfSelectedType();
};

if (addSectionBtn) addSectionBtn.onclick = () => {
  addSection();
  renderQuestions();
};

// New / Open / Save
if (newPaperBtn) newPaperBtn.onclick = onNewPaperRequested;
if (openPaperBtn) openPaperBtn.onclick = async () => {
  if (typeof hasUnsavedChanges === 'function' && hasUnsavedChanges()) {
    const ok = await showConfirm('Unsaved Changes. You have unsaved changes. Do you want to continue?', 'Continue');
    if (!ok) return;
  }
  if ('showOpenFilePicker' in window) {
    await openPaperFromPicker();
  } else {
    openPaperInput.click();
  }
};
if (savePaperBtn) savePaperBtn.onclick = savePaper;
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
    e.preventDefault();
    if (printBtn && printBtn.click) printBtn.click();
  }
});

if (openPaperInput) {
  openPaperInput.onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    if (typeof hasUnsavedChanges === 'function' && hasUnsavedChanges()) {
      const ok = await showConfirm('Unsaved Changes. You have unsaved changes. Do you want to continue?', 'Continue');
      if (!ok) { e.target.value = ''; return; }
    }
    openPaper(file);
    e.target.value = '';
  };
}

// Print
if (printBtn) printBtn.onclick = () => {
  updatePrintExamDetails();
  updateSnapshotMeta();
  window.print();
};

// Print settings panel toggle
if (printSettingsBtn) {
  printSettingsBtn.onclick = () => {
    if (!printSettingsPanel) return;
    printSettingsPanel.style.display = printSettingsPanel.style.display === 'none' ? 'block' : 'none';
  };
}

// Bottom toolbar
const toolbarBottom = document.getElementById('toolbarBottom');

// Wire bottom toolbar to same actions (if present)
if (addQuestionBtnBottom) addQuestionBtnBottom.onclick = addQuestionBtn.onclick;
if (newPaperBtnBottom)     newPaperBtnBottom.onclick     = newPaper;
if (openPaperBtnBottom)    openPaperBtnBottom.onclick    = () => openPaperInput.click();
if (savePaperBtnBottom)    savePaperBtnBottom.onclick    = savePaper;
if (printBtnBottom)        printBtnBottom.onclick        = printBtn.onclick;

// Show/hide bottom toolbar based on question count
function toggleBottomToolbar() {
  if (!toolbarBottom) return;
  if (questions.length > 2) {
    toolbarBottom.style.display = 'flex';
  } else {
    toolbarBottom.style.display = 'none';
  }
}
