let questions = [];

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
  subject: document.getElementById('subject'),
  className: document.getElementById('className'),
  classSection: document.getElementById('classSection'),
  examDate: document.getElementById('examDate'),
  duration: document.getElementById('duration'),
  maxMarks: maxMarksInput
};
// Add input validation for max limits
function validateMaxLimits() {
  const maxMarksVal = Number(metaFields.maxMarks.value) || 0;
  if (maxMarksVal > 100) {
    metaFields.maxMarks.value = '100';
  }
  
  const durationVal = Number(metaFields.duration.value) || 0;
  if (durationVal > 180) {
    metaFields.duration.value = '180';
  }
}
const snapSchool = document.getElementById('snapSchool');
const snapSubject = document.getElementById('snapSubject');
const snapClass = document.getElementById('snapClass');
const snapSection = document.getElementById('snapSection');
const snapDate = document.getElementById('snapDate');
const snapDuration = document.getElementById('snapDuration');
const snapMaxMarks = document.getElementById('snapMaxMarks');
const snapTotal = document.getElementById('snapTotal');

const themeToggleBtn = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
const themeLabel = document.getElementById('themeLabel');

const burgerBtn = document.getElementById('burgerBtn');
const burgerMenu = document.getElementById('burgerMenu');

const metaToggleBtn = document.getElementById('metaToggleBtn');
const paperMetaBody = document.getElementById('paperMetaBody');
let metaCollapsedMobile = false;

const defaultSchools = ["Ved Home Classes","Pacific Word School"];
const SCHOOL_KEY = "ved-school-options-v1";
const SCHOOL_SELECTED_KEY = "ved-school-selected-v1";

function debounce(fn, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

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
  } catch {}
}

// Enable simple drag-resize on images inside any contenteditable [web:76][web:77][web:90]

function makeImagesResizable(root) {
  let tooltip = null;

  const ensureTooltip = () => {
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.className = 'img-size-tooltip';
      document.body.appendChild(tooltip);
    }
    return tooltip;
  };

  const updateTooltip = (img, clientX, clientY) => {
    const tip = ensureTooltip();
    const w = img.offsetWidth;
    const h = img.offsetHeight;
    tip.textContent = w + ' × ' + h;
    tip.style.left = clientX + 'px';
    tip.style.top = clientY + 'px';
    tip.style.display = 'block';
  };

  const hideTooltip = () => {
    if (tooltip) tooltip.style.display = 'none';
  };

  const startResize = (img, startX, startY) => {
    img.classList.add('resizing');

    const startWidth = img.offsetWidth;
    const startHeight = img.offsetHeight || startWidth;
    const baseSize = Math.max(startWidth, startHeight);

    const doResize = (clientX, clientY) => {
      const dx = clientX - startX;
      const dy = clientY - startY;
      const delta = Math.max(dx, dy);
      const newSize = Math.max(30, baseSize + delta);
      img.style.width = newSize + 'px';
      img.style.height = newSize + 'px';
      updateTooltip(img, clientX, clientY);
    };

    const onMouseMove = (e) => {
      doResize(e.clientX, e.clientY);
    };

    const onMouseUp = () => {
      img.classList.remove('resizing');
      hideTooltip();
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    const onTouchMove = (e) => {
      const t = e.touches[0];
      doResize(t.clientX, t.clientY);
    };

    const onTouchEnd = () => {
      img.classList.remove('resizing');
      hideTooltip();
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchEnd);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
    document.addEventListener('touchcancel', onTouchEnd);
  };

  // Mouse support
  root.addEventListener('mousedown', (e) => {
    const img = e.target.closest('img');
    if (!img) return;
    e.preventDefault();
    startResize(img, e.clientX, e.clientY);
  });

  // Touch support (mobile/tablet)
  root.addEventListener('touchstart', (e) => {
    const img = e.target.closest('img');
    if (!img) return;
    const t = e.touches[0];
    e.preventDefault();
    startResize(img, t.clientX, t.clientY);
  }, { passive: false });
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

// confirm modal helper
let confirmResolve = null;
const confirmModal = document.getElementById('confirmModal');
const confirmMessage = document.getElementById('confirmMessage');
document.getElementById('confirmCancel').onclick = () => {
  confirmModal.style.display = 'none';
  if (confirmResolve) confirmResolve(false);
};
document.getElementById('confirmOk').onclick = () => {
  confirmModal.style.display = 'none';
  if (confirmResolve) confirmResolve(true);
};
function showConfirm(message) {
  confirmMessage.textContent = message;
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
  select.value = "Ved Home Classes";
  localStorage.setItem(SCHOOL_SELECTED_KEY, select.value);
  updateSnapshotMeta();
  updateSchoolDeleteVisibility();
};

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

burgerBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  burgerMenu.classList.toggle('open');
});
document.addEventListener('click', () => burgerMenu.classList.remove('open'));
burgerMenu.addEventListener('click', (e) => e.stopPropagation());

function createEmptyQuestion() {
  return { id: Date.now() + Math.random(), text: '', marks: 0, options: [] };
}

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

function makeDraggable() {
  const cards = document.querySelectorAll('.question-card');

  let touchDrag = {
    active: false,
    fromIdx: null,
    ghostCard: null
  };

  cards.forEach((card, idx) => {
    card.draggable = false;

    const header = card.querySelector('.question-header');
    const left = header.querySelector('div:first-child');

    const existingGrip = left.querySelector('.drag-grip');
    if (existingGrip) existingGrip.remove();

    const grip = document.createElement('span');
    grip.className = 'drag-grip';
    grip.innerHTML = '⋮⋮';
    grip.title = 'Drag to reorder (hold and drag)';
    grip.draggable = true;
    grip.dataset.questionIndex = idx;
    left.insertBefore(grip, left.firstChild);

    // ==== MOUSE DRAG (unchanged) ====
    grip.ondragstart = (e) => {
      document.body.classList.add('dragging-mode');
      e.dataTransfer.setData('text/plain', idx);
      card.classList.add('dragging');
    };

    grip.ondragend = () => {
      document.body.classList.remove('dragging-mode');
      card.classList.remove('dragging');
      document.querySelectorAll('.question-card')
        .forEach(c => c.classList.remove('drag-over'));
    };

    card.ondragover = (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (!card.classList.contains('drag-over')) {
        card.classList.add('drag-over');
      }
    };

    card.ondragleave = (e) => {
      if (!card.contains(e.relatedTarget)) {
        card.classList.remove('drag-over');
      }
    };

    card.ondrop = (e) => {
      e.preventDefault();
      card.classList.remove('drag-over');

      const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
      const toIdx = idx;
      if (fromIdx !== toIdx && fromIdx >= 0 && toIdx >= 0 && fromIdx < questions.length) {
        const [moved] = questions.splice(fromIdx, 1);
        questions.splice(toIdx, 0, moved);
        renderQuestions();
      }
    };

    // ==== TOUCH DRAG (mobile / tablet) ====
    grip.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      e.preventDefault();
      touchDrag.active = true;
      touchDrag.fromIdx = idx;
      document.body.classList.add('dragging-mode');
      card.classList.add('dragging');
    }, { passive: false });

    grip.addEventListener('touchend', () => {
      // drop will be handled in touchend on container
    }, { passive: false });
  });

  // Handle touchmove / touchend at container level
  const container = questionsContainer;

  container.addEventListener('touchmove', (e) => {
    if (!touchDrag.active) return;
    const touch = e.touches[0];
    const y = touch.clientY;

    const allCards = Array.from(container.querySelectorAll('.question-card'));
    let targetIdx = null;

    allCards.forEach((c, index) => {
      const rect = c.getBoundingClientRect();
      c.classList.remove('drag-over');
      if (y > rect.top && y < rect.bottom) {
        targetIdx = index;
        c.classList.add('drag-over');
      }
    });

    // visual only; actual reorder happens on touchend
  }, { passive: false });

  container.addEventListener('touchend', (e) => {
    if (!touchDrag.active) return;
    e.preventDefault();

    const allCards = Array.from(container.querySelectorAll('.question-card'));
    let toIdx = null;
    allCards.forEach((c, index) => {
      if (c.classList.contains('drag-over')) {
        toIdx = index;
      }
      c.classList.remove('drag-over');
      c.classList.remove('dragging');
    });

    document.body.classList.remove('dragging-mode');

    if (toIdx !== null && toIdx !== touchDrag.fromIdx &&
        touchDrag.fromIdx >= 0 && touchDrag.fromIdx < questions.length) {
      const [moved] = questions.splice(touchDrag.fromIdx, 1);
      questions.splice(toIdx, 0, moved);
      renderQuestions();
    }

    touchDrag.active = false;
    touchDrag.fromIdx = null;
  }, { passive: false });
}
function updateSnapshotMeta() {
  snapSchool.textContent = metaFields.schoolName.value || '-';
  // ...existing lines...
  const printHeader = document.getElementById('printSchoolHeader');
  if (printHeader) {
    printHeader.textContent = metaFields.schoolName.value || '';
  }
}

function updatePrintExamDetails() {
  const container = document.getElementById('printExamDetails');
  if (!container) return;
  container.innerHTML = '';

  const rows = [
    { label: 'Subject', value: metaFields.subject.value },
    { label: 'Class', value: metaFields.className.value },
    { label: 'Section', value: metaFields.classSection.value },
    { label: 'Exam Date', value: metaFields.examDate.value ? formatDateDDMMYYYY(metaFields.examDate.value) : '' },
    { label: 'Duration', value: metaFields.duration.value ? metaFields.duration.value + ' min' : '' },
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


// ADD THESE TWO FUNCTIONS HERE (after makeDraggable() ends)
function updateSnapshotMeta() {
  snapSchool.textContent = metaFields.schoolName.value || '-';
  snapSubject.textContent = metaFields.subject.value || '-';
  snapClass.textContent = metaFields.className.value || '-';
  snapSection.textContent = metaFields.classSection.value || '-';
  snapDate.textContent = metaFields.examDate.value ? formatDateDDMMYYYY(metaFields.examDate.value) : '-';
  snapDuration.textContent = metaFields.duration.value ? metaFields.duration.value + ' min' : '-';
  snapMaxMarks.textContent = metaFields.maxMarks.value || '-';
}

// Inserts an <img> at the current caret position inside a contentEditable [web:22][web:23][web:10][web:27]
function insertImageAtCursor(editableEl, dataUrl) {
  editableEl.focus();
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    const img = document.createElement('img');
    img.src = dataUrl;
    editableEl.appendChild(img);
    return;
  }
  const range = selection.getRangeAt(0);
  const img = document.createElement('img');
  img.src = dataUrl;
  range.insertNode(img);
  // move caret after the image
  range.setStartAfter(img);
  range.setEndAfter(img);
  selection.removeAllRanges();
  selection.addRange(range);
}


// Open modal popup for questions
function openQuestionModal(question, index) {
  const existing = document.getElementById('questionModal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'questionModal';
  overlay.className = 'question-modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'question-modal';

  const title = document.createElement('h3');
  title.textContent = 'Edit Q' + (index + 1);
  modal.appendChild(title);

  // ---- RICH TEXT TOOLBAR ----
  const toolbar = document.createElement('div');
  toolbar.className = 'editor-toolbar modal-editor-toolbar';
  toolbar.innerHTML = `
    <button type="button" class="format-btn" data-command="bold" title="Bold (Ctrl+B)"><b>B</b></button>
    <button type="button" class="format-btn" data-command="italic" title="Italic (Ctrl+I)"><i>I</i></button>
    <button type="button" class="format-btn" data-command="underline" title="Underline (Ctrl+U)"><u>U</u></button>
    <button type="button" class="format-btn" data-command="insertUnorderedList" title="Bullets (Ctrl+L)">•</button>
    <button type="button" class="format-btn" data-command="insertOrderedList" title="Numbers (Ctrl+O)">1.</button>
    
	<button type="button" class="format-btn insert-image-btn" title="Insert image">Img</button>
    <button type="button" class="format-btn clear-btn" title="Clear formatting (Ctrl+Shift+C)">Clear</button>
  `;
  modal.appendChild(toolbar);

  // ---- RICH TEXT AREA ----
  const editor = document.createElement('div');
  editor.className = 'question-modal-editor content-editable';
  editor.contentEditable = true;
  editor.innerHTML = question.text || '';
  modal.appendChild(editor);
  makeImagesResizable(editor); 	

  // Image upload for modal editor
	const modalImageInput = document.createElement('input');
	modalImageInput.type = 'file';
	modalImageInput.accept = 'image/*';
	modalImageInput.style.opacity = '0';
	modalImageInput.style.position = 'absolute';
	modalImageInput.style.pointerEvents = 'none';
	modalImageInput.style.width = '0';
	modalImageInput.style.height = '0';

	toolbar.appendChild(modalImageInput);

	const modalInsertImageBtn = toolbar.querySelector('.insert-image-btn');

	modalInsertImageBtn.onclick = () => {
	  modalImageInput.click();
	};

	modalImageInput.addEventListener('change', (e) => {
	  const file = e.target.files[0];
	  if (!file) return;

	  const reader = new FileReader();
	  reader.onload = (ev) => {
		editor.focus();
		 insertImageAtCursor(editor, ev.target.result);  // in renderQuestions
 // insert image at caret [web:22][web:23][web:10][web:27]
	  };
	  reader.readAsDataURL(file);
	  modalImageInput.value = '';
	});

  // FORMAT LOGIC
  const handleFormat = (command, value = null) => {
    editor.focus();
    document.execCommand('styleWithCSS', false, null);
    document.execCommand(command, false, value);
    editor.focus();
    updateToolbarState();
  };

  const updateToolbarState = () => {
    const boldBtn = toolbar.querySelector('[data-command="bold"]');
    const italicBtn = toolbar.querySelector('[data-command="italic"]');
    const underlineBtn = toolbar.querySelector('[data-command="underline"]');
    if (boldBtn) boldBtn.classList.toggle('active', document.queryCommandState('bold'));
    if (italicBtn) italicBtn.classList.toggle('active', document.queryCommandState('italic'));
    if (underlineBtn) underlineBtn.classList.toggle('active', document.queryCommandState('underline'));
  };

  toolbar.querySelectorAll('.format-btn:not(.clear-btn):not(.insert-image-btn)').forEach(btn => {
    btn.onclick = () => {
      const command = btn.dataset.command;
      const value = btn.dataset.value;
      handleFormat(command, value);
    };
  });

  // Clear formatting in modal
  toolbar.querySelector('.clear-btn').onclick = () => {
    editor.focus();
    document.execCommand('selectAll', false, null);
    document.execCommand('removeFormat');
    document.execCommand('styleWithCSS', false, null);
    editor.innerHTML = editor.textContent || '';
    editor.focus();
    updateToolbarState();
  };

  editor.addEventListener('keyup', updateToolbarState);
  editor.addEventListener('mouseup', updateToolbarState);
  editor.addEventListener('input', updateToolbarState);

  editor.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'b': e.preventDefault(); handleFormat('bold'); break;
        case 'i': e.preventDefault(); handleFormat('italic'); break;
        case 'u': e.preventDefault(); handleFormat('underline'); break;
        case 'l': e.preventDefault(); handleFormat('insertUnorderedList'); break;
        case 'o': e.preventDefault(); handleFormat('insertOrderedList'); break;
      }
      return;
    }
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      toolbar.querySelector('.clear-btn').click();
    }
  });

  // ---- BUTTONS ----
  const btnRow = document.createElement('div');
  btnRow.className = 'question-modal-actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.className = 'modal-btn modal-cancel';
  cancelBtn.onclick = () => overlay.remove();

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.textContent = 'Save';
  saveBtn.className = 'modal-btn modal-save';
  saveBtn.onclick = () => {
    question.text = editor.innerHTML;
    renderQuestions();
    overlay.remove();
  };

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(saveBtn);
  modal.appendChild(btnRow);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  editor.focus();
}



function updateTotalMarks() {
  const total = questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);
  const max = Number(maxMarksInput.value) || 0;
  marksInfo.textContent = 'Total: ' + total;
  snapTotal.textContent = total;
  marksInfo.classList.remove('marks-ok','marks-warning');
  marksInfo.style.color = '';
  if (!max || total <= max) {
    marksInfo.classList.add('marks-ok');
  } else {
    marksInfo.classList.add('marks-warning');
    marksInfo.style.color = 'red';
    alert('Total marks (' + total + ') exceed maximum marks (' + max + '). Please correct the marks.');
  }
}


function renderQuestions() {
  questionsContainer.innerHTML = '';
  questions.forEach((q, idx) => {
    const card = document.createElement('div');
    card.className = 'question-card';

    const header = document.createElement('div');
    header.className = 'question-header';

	const left = document.createElement('div');
	const qLabelText = 'Q' + (idx + 1);

	// Q label
	const qLabelSpan = document.createElement('span');
	qLabelSpan.className = 'q-label';
	qLabelSpan.textContent = qLabelText + '.';

	// Expand icon
	const expandBtn = document.createElement('img');
	expandBtn.src = 'expand.svg';        // make sure expand.svg is in the same folder
	expandBtn.alt = 'Expand question';
	expandBtn.className = 'expand-icon';

	expandBtn.onclick = () => openQuestionModal(q, idx);

	left.appendChild(qLabelSpan);
	left.appendChild(expandBtn);
	header.appendChild(left);


    const right = document.createElement('div');
    right.className = 'question-header-right';

    const marksWrap = document.createElement('span');
    marksWrap.innerHTML = 'Marks: <input type="number" min="0" class="marks-input" value="' + (q.marks || 0) + '">';
    right.appendChild(marksWrap);

    const actions = document.createElement('div');
    actions.className = 'question-actions';
    const delBtn = document.createElement('button');
    delBtn.innerHTML = '<img src="delete.svg" alt="Delete">';
    delBtn.title = 'Delete question';
    delBtn.onclick = async () => {
      const ok = await showConfirm('Are you sure you want to delete ' + '"'+qLabelText+'"' + ' ?');
      if (!ok) return;
      questions = questions.filter(qq => qq.id !== q.id);
      renderQuestions();
    };
    actions.appendChild(delBtn);
    right.appendChild(actions);
    header.appendChild(right);
    card.appendChild(header);

 // 🆙 PERFECT RICH TEXT EDITOR - FIXED
const editorWrap = document.createElement('div');
editorWrap.className = 'question-editor';

const toolbar = document.createElement('div');
toolbar.className = 'editor-toolbar';
toolbar.innerHTML = `
  <button type="button" class="format-btn" data-command="bold" title="Bold (Ctrl+B)"><b>B</b></button>
  <button type="button" class="format-btn" data-command="italic" title="Italic (Ctrl+I)"><i>I</i></button>
  <button type="button" class="format-btn" data-command="underline" title="Underline (Ctrl+U)"><u>U</u></button>
  <button type="button" class="format-btn" data-command="insertUnorderedList" title="Bullets (Ctrl+L)">•</button>
  <button type="button" class="format-btn" data-command="insertOrderedList" title="Numbers (Ctrl+O)">1.</button>
  
  <button type="button" class="format-btn insert-image-btn" title="Insert image">Img</button>
  <button type="button" class="format-btn clear-btn" title="Clear formatting (Ctrl+Shift+C)">Clear</button>
`;
// Hidden file input for image upload (per editor)
const imageInput = document.createElement('input');
imageInput.type = 'file';
imageInput.accept = 'image/*';
imageInput.style.opacity = '0';
imageInput.style.position = 'absolute';
imageInput.style.pointerEvents = 'none';
imageInput.style.width = '0';
imageInput.style.height = '0';

toolbar.appendChild(imageInput);

const insertImageBtn = toolbar.querySelector('.insert-image-btn');

insertImageBtn.onclick = () => {
  imageInput.click();
};

imageInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    contentEditable.focus();
    insertImageAtCursor(contentEditable, ev.target.result);
    syncQuestionText();          // ensure q.text gets the <img>
  };
  reader.readAsDataURL(file);
  imageInput.value = '';
});

editorWrap.appendChild(toolbar);

const contentEditable = document.createElement('div');
contentEditable.className = 'question-text content-editable';
contentEditable.contentEditable = true;
contentEditable.innerHTML = q.text || '';
editorWrap.appendChild(contentEditable);
card.appendChild(editorWrap);
makeImagesResizable(contentEditable);

// 🆙 1. DEFINE FUNCTIONS FIRST
const handleFormat = (command, value = null) => {
  contentEditable.focus();
  document.execCommand('styleWithCSS', false, null);
  document.execCommand(command, false, value);
  contentEditable.focus();
};

const updateToolbarState = () => {
  const boldBtn = toolbar.querySelector('[data-command="bold"]');
  const italicBtn = toolbar.querySelector('[data-command="italic"]');
  const underlineBtn = toolbar.querySelector('[data-command="underline"]');
  
  if (boldBtn) boldBtn.classList.toggle('active', document.queryCommandState('bold'));
  if (italicBtn) italicBtn.classList.toggle('active', document.queryCommandState('italic'));
  if (underlineBtn) underlineBtn.classList.toggle('active', document.queryCommandState('underline'));
};

// 🆙 2. TOOLBAR BUTTONS
toolbar.querySelectorAll('.format-btn:not(.clear-btn):not(.insert-image-btn)').forEach(btn => {
  btn.onclick = () => {
    const command = btn.dataset.command;
    const value = btn.dataset.value;
    handleFormat(command, value);
    updateToolbarState();
  };
});

// 🆙 3. PERFECT CLEAR BUTTON
toolbar.querySelector('.clear-btn').onclick = () => {
  contentEditable.focus();
  document.execCommand('selectAll', false, null);
  document.execCommand('removeFormat');
  document.execCommand('styleWithCSS', false, null);
  contentEditable.innerHTML = contentEditable.textContent || '';
  contentEditable.focus();
  updateToolbarState();
};

// 🆙 4. EVENT LISTENERS (SINGLE SET)
const syncQuestionText = () => {
  q.text = contentEditable.innerHTML;
};

contentEditable.addEventListener('input', () => {
  syncQuestionText();
  updateToolbarState();
});

contentEditable.addEventListener('keyup', () => {
  syncQuestionText();
  updateToolbarState();
});

contentEditable.addEventListener('mouseup', () => {
  syncQuestionText();
  updateToolbarState();
});

// When formatting buttons or Img are used, also resync
toolbar.querySelectorAll('.format-btn:not(.clear-btn):not(.insert-image-btn)')
  .forEach(btn => {
    btn.onclick = () => {
      const command = btn.dataset.command;
      const value = btn.dataset.value;
      handleFormat(command, value);
      syncQuestionText();
      updateToolbarState();
    };
  });


// 🆙 5. KEYBOARD SHORTCUTS
contentEditable.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey) {
    switch(e.key.toLowerCase()) {
      case 'b': e.preventDefault(); handleFormat('bold'); break;
      case 'i': e.preventDefault(); handleFormat('italic'); break;
      case 'u': e.preventDefault(); handleFormat('underline'); break;
      case 'l': e.preventDefault(); handleFormat('insertUnorderedList'); break;
      case 'o': e.preventDefault(); handleFormat('insertOrderedList'); break;
    }
    updateToolbarState();
    return;
  }
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'c') {
    e.preventDefault();
    toolbar.querySelector('.clear-btn').click();
  }
});

    const optionsDiv = document.createElement('div');
    optionsDiv.className = 'options';
    const optTitle = document.createElement('div');
    optTitle.className = 'options-title';
    optTitle.textContent = 'Options (optional)';
    optionsDiv.appendChild(optTitle);

    const optionsGrid = document.createElement('div');
    optionsGrid.className = 'options-grid';

    q.options.forEach((opt, oIdx) => {
      const row = document.createElement('div');
      row.className = 'option-row';

      const label = document.createElement('span');
      label.className = 'label';
      label.textContent = String.fromCharCode(65 + oIdx) + '.';
      row.appendChild(label);

      const optInput = document.createElement('input');
      optInput.type = 'text';
      optInput.placeholder = 'Option text';
      optInput.value = opt.text || '';
      optInput.oninput = e => { opt.text = e.target.value; };
      row.appendChild(optInput);

		const removeBtn = document.createElement('button');
		removeBtn.innerHTML = '<img src="delete.svg" alt="Delete option">';

		removeBtn.onclick = async () => {
		  const optionLabel = String.fromCharCode(65 + oIdx); // A, B, C...
		  const ok = await showConfirm('Are you sure you want to delete option "' + optionLabel + '"?');
		  if (!ok) return;
		  q.options.splice(oIdx, 1);
		  renderQuestions();
		};

		row.appendChild(removeBtn);

      optionsGrid.appendChild(row);
    });

    optionsDiv.appendChild(optionsGrid);

    const addOptBtn = document.createElement('button');
    addOptBtn.className = 'btn-add-option';
    addOptBtn.type = 'button';
    addOptBtn.innerHTML = '<img src="add-answers.svg" alt="Add option">Add option';
    addOptBtn.onclick = () => {
      q.options.push({ text: '' });
      renderQuestions();
      setTimeout(() => {
        const allCards = document.querySelectorAll('.question-card');
        const thisCard = allCards[idx];
        if (!thisCard) return;
        const inputs = thisCard.querySelectorAll('.option-row input[type="text"]');
        const lastInput = inputs[inputs.length - 1];
        if (lastInput) lastInput.focus();
      }, 0);
    };
    optionsDiv.appendChild(addOptBtn);

    card.appendChild(optionsDiv);

    const marksInputEl = card.querySelector('.marks-input');

    marksInputEl.addEventListener('focus', (e) => {
      if (e.target.value === '0') {
        e.target.value = '';
      }
    });

    marksInputEl.addEventListener('blur', (e) => {
      if (!e.target.value) {
        e.target.value = '0';
        q.marks = 0;
        updateTotalMarks();
      }
    });

marksInputEl.addEventListener('input', (e) => {
  const val = parseFloat(e.target.value) || 0;
  q.marks = val;
  // Update color for 0 marks
  if (val === 0) {
    e.target.style.color = '#A8A8A8';
  } else {
    e.target.style.color = '';
  }
  updateTotalMarks();
});

    questionsContainer.appendChild(card);
  });
  updateTotalMarks();
  makeDraggable();
}

function formatDateDDMMYYYY(isoStr) {
  if (!isoStr) return '';
  const [y, m, d] = isoStr.split('-');
  if (!y || !m || !d) return isoStr;
  return `${d}/${m}/${y}`;
}

function updateSnapshotMeta() {
  snapSchool.textContent = metaFields.schoolName.value || '-';
  snapSubject.textContent = metaFields.subject.value || '-';
  snapClass.textContent = metaFields.className.options[metaFields.className.selectedIndex]?.textContent || '-';
  snapSection.textContent = metaFields.classSection.value || '-';
  snapDate.textContent = metaFields.examDate.value ? formatDateDDMMYYYY(metaFields.examDate.value) : '-';
  snapDuration.textContent = metaFields.duration.value ? metaFields.duration.value + ' min' : '-';
  snapMaxMarks.textContent = metaFields.maxMarks.value || '-';
}

function saveDraft() {
  try {
    const draft = {
      questions: questions.map(q => ({...q})),
      meta: Object.fromEntries(
        Object.entries(metaFields).map(([k, v]) => [k, v.value])
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
    if (!data || !data.timestamp || Date.now() - data.timestamp > 24*60*60*1000) {
      localStorage.removeItem('qp-draft-v1');
      return false;
    }
    
    Object.entries(data.meta || {}).forEach(([key, value]) => {
      if (metaFields[key]) metaFields[key].value = value || '';
    });
    
    questions = data.questions || [];
    
    renderQuestions();
    updateSnapshotMeta();
    updateTotalMarks();
    return true;
  } catch (e) {
    localStorage.removeItem('qp-draft-v1');
    return false;
  }
}

const debouncedSave = debounce(saveDraft, 1000);

Object.values(metaFields).forEach(input => {
  input.addEventListener('input', () => {
    validateMaxLimits();  // ADD THIS LINE
    updateSnapshotMeta();
    updatePrintExamDetails();
    if (input === maxMarksInput) updateTotalMarks();
    debouncedSave();
  });
});

metaFields.schoolName.addEventListener('change', () => {
  localStorage.setItem(SCHOOL_SELECTED_KEY, metaFields.schoolName.value);
  updateSnapshotMeta();
  updateSchoolDeleteVisibility();
  debouncedSave();
});

function updateTotalMarks() {
  const total = questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);
  const max = Number(maxMarksInput.value) || 0;

  marksInfo.textContent = 'Total: ' + total;
  snapTotal.textContent = total;

  marksInfo.classList.remove('marks-ok','marks-warning');
  marksInfo.style.color = '';

  if (!max || total <= max) {
    marksInfo.classList.add('marks-ok');
  } else {
    marksInfo.classList.add('marks-warning');
    marksInfo.style.color = 'red';
    alert('Total marks (' + total + ') exceed maximum marks (' + max + '). Please correct the marks.');
  }
}

addQuestionBtn.onclick = () => {
  questions.push(createEmptyQuestion());
  renderQuestions();
  debouncedSave();
};

exportBtn.onclick = () => {
  const data = {
    meta: {
      schoolName: metaFields.schoolName.value,
      subject: metaFields.subject.value,
      className: metaFields.className.value,
      classSection: metaFields.classSection.value,
      examDate: metaFields.examDate.value ? formatDateDDMMYYYY(metaFields.examDate.value) : '',
      duration: metaFields.duration.value,
      maxMarks: metaFields.maxMarks.value
    },
    questions
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (metaFields.subject.value || 'question-paper') + '.ved';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

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
        text: (q.text || '').toString(),
        marks: Number(q.marks) || 0,
        options: Array.isArray(q.options) ? q.options.map(o => ({ 
          text: (o.text || '').toString() 
        })) : []
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

printBtn.onclick = () => {
  updatePrintExamDetails();  // Populates exam details
  updateSnapshotMeta();      // Updates school header
  window.print();
};

document.addEventListener('keydown', (e) => {
  if (!e.altKey) return;
  const key = e.key.toLowerCase();
  if (key === 'q') {
    e.preventDefault();
    questions.push(createEmptyQuestion());
    renderQuestions();
    debouncedSave();
  } else if (key === 'a') {
    e.preventDefault();
    if (questions.length === 0) return;
    const last = questions[questions.length - 1];
    if (!last.options) last.options = [];
    last.options.push({ text: '' });
    renderQuestions();
    const cards = document.querySelectorAll('.question-card');
    const lastCard = cards[cards.length - 1];
    if (lastCard) {
      setTimeout(() => {
        const allOptionInputs = lastCard.querySelectorAll('.option-row input[type="text"]');
        const lastInput = allOptionInputs[allOptionInputs.length - 1];
        if (lastInput) lastInput.focus();
      }, 0);
    }
    debouncedSave();
  }
});

function updateMetaVisibilityForViewport() {
  const isMobile = window.innerWidth <= 768;
  if (!isMobile) {
    paperMetaBody.style.display = '';
    metaToggleBtn.textContent = '';
    metaToggleBtn.style.display = 'none';
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
  updateMarksInfoFloating();
});
window.addEventListener('scroll', () => {
  updateMarksInfoFloating();
});

loadSchoolOptionsFromStorage();

function setTodayDateAndDefaults() {
  const today = new Date();
  const iso = today.toISOString().slice(0,10);
  metaFields.examDate.value = iso;
  metaFields.maxMarks.value = 100;
  metaFields.duration.value = 90;
  const storedSelected = localStorage.getItem(SCHOOL_SELECTED_KEY);
  if (storedSelected) {
    metaFields.schoolName.value = storedSelected;
  } else {
    metaFields.schoolName.value = "Ved Home Classes";
  }
}

setTodayDateAndDefaults();
if (!loadDraft()) {
  questions.push(createEmptyQuestion());
}
updateSchoolDeleteVisibility();
renderQuestions();
updateSnapshotMeta();
updateMetaVisibilityForViewport();
updateMarksInfoFloating();

// Auto-save every 30 seconds
setInterval(saveDraft, 30000);
window.addEventListener('beforeunload', saveDraft);
