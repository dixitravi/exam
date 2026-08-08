// ===== TOOLBAR.JS =====
// Depends on: questions, metaFields, questionsContainer,
// addQuestionBtn, exportBtn, importTrigger, importInput, printBtn,
// updateSnapshotMeta, updatePrintExamDetails, renderQuestions, updateTotalMarks, debouncedSave

// Top toolbar: Add Question
addQuestionBtn.onclick = () => {
  questions.push(createEmptyQuestion());
  renderQuestions();
  debouncedSave();
};

// Export
exportBtn.onclick = () => {
  const data = {
    meta: {
      schoolName: metaFields.schoolName.value,
      subject: metaFields.subject.value,
      className: metaFields.className.value,
      classSection: metaFields.classSection.value,
      examDate: metaFields.examDate.value
        ? formatDateDDMMYYYY(metaFields.examDate.value)
        : '',
      duration: metaFields.duration.value,
      maxMarks: metaFields.maxMarks.value
    },
    questions
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (metaFields.subject.value || 'question-paper') + '.ved';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

// Import
importTrigger.onclick = () => importInput.click();

importInput.onchange = e => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = evt => {
    try {
      const data = JSON.parse(evt.target.result);

      if (!data || typeof data !== 'object') {
        throw new Error('Invalid file structure');
      }

      if (data.meta) {
        Object.keys(data.meta).forEach(key => {
          if (metaFields[key]) {
            metaFields[key].value = data.meta[key] || '';
          }
        });
      }

      questions = (Array.isArray(data.questions) ? data.questions : []).map(q => ({
        id: q.id || Date.now() + Math.random(),
        text: sanitizeHtml((q.text || '').toString()),
        marks: Number(q.marks) || 0,
        options: Array.isArray(q.options)
          ? q.options.map(o => ({ text: sanitizeHtml((o.text || '').toString()) }))
          : []
      }));

      renderQuestions();
      updateSnapshotMeta();
      updateTotalMarks();
      alert('File imported successfully!');
    } catch (err) {
      alert('Invalid file: ' + (err.message || 'Corrupted file'));
    }
  };
  reader.onerror = () => alert('Failed to read file');
  reader.readAsText(file);
  e.target.value = '';
};

// Print
printBtn.onclick = () => {
  updatePrintExamDetails();
  updateSnapshotMeta();
  window.print();
};

// Bottom toolbar
const toolbarBottom = document.getElementById('toolbarBottom');
const addQuestionBtnBottom = document.getElementById('addQuestionBtnBottom');
const exportBtnBottom = document.getElementById('exportBtnBottom');
const importBtnBottom = document.getElementById('importBtnBottom');
const printBtnBottom = document.getElementById('printBtnBottom');

// Wire bottom toolbar to same actions (if present)
if (addQuestionBtnBottom) addQuestionBtnBottom.onclick = addQuestionBtn.onclick;
if (exportBtnBottom)     exportBtnBottom.onclick     = exportBtn.onclick;
if (importBtnBottom)     importBtnBottom.onclick     = () => importInput.click();
if (printBtnBottom)      printBtnBottom.onclick      = printBtn.onclick;

// Show/hide bottom toolbar based on question count
function toggleBottomToolbar() {
  if (!toolbarBottom) return;
  if (questions.length > 2) {
    toolbarBottom.style.display = 'flex';
  } else {
    toolbarBottom.style.display = 'none';
  }
}
