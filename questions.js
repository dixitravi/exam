// ===== QUESTIONS.JS =====
// Depends on: questions, questionsContainer, metaFields, marksInfo, maxMarksInput,
// snapTotal, debouncedSave, showConfirm, updateTotalMarks, toggleBottomToolbar (toolbar.js)

// Basic question factory
function createEmptyQuestion(type = 'multiple', targetSectionId) {
  const sectionId = targetSectionId || currentSectionId || (sections[0] && sections[0].id) || null;
  const base = { id: Date.now() + Math.random(), text: '', marks: 0, sectionId, type };
  if (type === 'multiple' || type === 'multiple_correct') {
    return { ...base, options: [] };
  }
  if (type === 'truefalse') {
    return { ...base, options: [{ text: 'True' }, { text: 'False' }] };
  }
  if (type === 'fillblank') {
    return { ...base, blanks: [{ id: 'b-' + Date.now() + '-1', answer: '' }] };
  }
  if (type === 'short' || type === 'long' || type === 'numeric') {
    return { ...base, answer: '' };
  }
  if (type === 'match') {
    return { ...base, pairs: [{ left: '', right: '' }] };
  }
  if (type === 'paragraph') {
    return { ...base, passage: '', subQuestions: [] };
  }
  return { ...base, options: [] };
}

function createEmptySubQuestion(type = 'short') {
  const base = { id: Date.now() + Math.random(), text: '', marks: 0, type };
  if (type === 'multiple') return { ...base, options: [] };
  if (type === 'short' || type === 'long') return { ...base, answer: '' };
  return { ...base, answer: '' };
}

const QUESTION_TYPE_LABELS = {
  multiple: 'Multiple Choice',
  multiple_correct: 'Multiple Correct Answers',
  truefalse: 'True / False',
  fillblank: 'Fill in the Blanks',
  short: 'Short Answer',
  long: 'Long Answer',
  numeric: 'Numeric Answer',
  match: 'Make a Match',
  paragraph: 'Paragraph Based'
};

function getQuestionTypeLabel(type) {
  return QUESTION_TYPE_LABELS[type] || 'Multiple Choice';
}

const QUESTION_TYPE_SHORT_LABELS = {
  multiple: 'MCQ',
  multiple_correct: 'MultiCorrect',
  truefalse: 'True/False',
  fillblank: 'FillBlanks',
  short: 'Short',
  long: 'Long',
  numeric: 'Numeric',
  match: 'Match',
  paragraph: 'Paragraph'
};

function getQuestionTypeShortLabel(type) {
  return QUESTION_TYPE_SHORT_LABELS[type] || 'MCQ';
}

function changeQuestionType(q, newType) {
  const base = createEmptyQuestion(newType, q.sectionId);
  base.id = q.id;
  base.text = q.text || '';
  base.marks = q.marks || 0;
  Object.assign(q, base);
}

let questionTypeSelectorResolve = null;
let marksOverAlertShown = false;

document.addEventListener('click', (e) => {
  if (!e.target.closest('.section-menu')) {
    document.querySelectorAll('.section-menu-dropdown').forEach(d => d.style.display = 'none');
  }
});

function showQuestionTypeSelector() {
  return new Promise((resolve) => {
    const existing = document.getElementById('questionTypeSelector');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'questionTypeSelector';
    overlay.className = 'type-selector-overlay';

    const modal = document.createElement('div');
    modal.className = 'type-selector-modal';

    const heading = document.createElement('h3');
    heading.textContent = 'Select question type';
    modal.appendChild(heading);

    const list = document.createElement('div');
    list.className = 'type-selector-list';

    Object.entries(QUESTION_TYPE_LABELS).forEach(([value, label]) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'type-selector-option';
      btn.textContent = label;
      btn.onclick = () => {
        overlay.remove();
        resolve(value);
      };
      list.appendChild(btn);
    });
    modal.appendChild(list);

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'type-selector-cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => {
      overlay.remove();
      resolve(null);
    };
    modal.appendChild(cancelBtn);

    overlay.onclick = (e) => {
      if (e.target === overlay) {
        overlay.remove();
        resolve(null);
      }
    };

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  });
}

async function addQuestionOfSelectedType(targetSectionId) {
  recordState("Add Question");
  const target = targetSectionId || (sections.length ? sections[sections.length - 1].id : null);
  if (!target) {
    showStatus('Please add a section first', 'error');
    return;
  }
  const type = await showQuestionTypeSelector();
  if (!type) return;
  const q = createEmptyQuestion(type, target);
  questions.push(q);
  renderQuestions();
  debouncedSave();
}

function sanitizeHtml(html) {
  if (typeof html !== 'string') return String(html || '');
  const temp = document.createElement('div');
  temp.innerHTML = html;
  temp.querySelectorAll('script').forEach(el => el.remove());
  const all = temp.querySelectorAll('*');
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    const attrs = Array.from(el.attributes);
    for (let a = 0; a < attrs.length; a++) {
      const name = attrs[a].name.toLowerCase();
      if (name.startsWith('on')) el.removeAttribute(attrs[a].name);
      if (name === 'href' && /^javascript:/i.test(attrs[a].value)) el.removeAttribute('href');
    }
  }
  return temp.innerHTML;
}

// Enable simple drag-resize on images inside any contenteditable
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

// Inserts an <img> at the current caret position inside a contentEditable
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
  range.setStartAfter(img);
  range.setEndAfter(img);
  selection.removeAllRanges();
  selection.addRange(range);
}

// Drag and drop reordering
function makeDraggable() {
  const cards = document.querySelectorAll('.question-card');

  let touchDrag = {
    active: false,
    fromIdx: null,
    ghostCard: null
  };

  cards.forEach((card) => {
    const idx = parseInt(card.dataset.questionIndex, 10);
    card.draggable = false;

    const header = card.querySelector('.question-header');
    const left = header.querySelector('div:first-child');

    const existingGrip = left.querySelector('.question-drag-grip');
    if (existingGrip) existingGrip.remove();

    const grip = document.createElement('span');
    grip.className = 'question-drag-grip';
    grip.innerHTML = '<svg width="10" height="14" viewBox="0 0 10 14" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="2" cy="2" r="1.5" fill="currentColor"/><circle cx="6" cy="2" r="1.5" fill="currentColor"/><circle cx="2" cy="6" r="1.5" fill="currentColor"/><circle cx="6" cy="6" r="1.5" fill="currentColor"/><circle cx="2" cy="10" r="1.5" fill="currentColor"/><circle cx="6" cy="10" r="1.5" fill="currentColor"/></svg>';
    grip.title = 'Drag to reorder (hold and drag)';
    grip.setAttribute('aria-label', 'Drag to reorder');
    grip.draggable = true;
    grip.dataset.questionIndex = idx;
    left.insertBefore(grip, left.firstChild);

    // Mouse drag
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

      const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
      const toIdx = idx;
      if (fromIdx !== toIdx && fromIdx >= 0 && toIdx >= 0 && fromIdx < questions.length) {
        recordState("Move Question");
        const [moved] = questions.splice(fromIdx, 1);
        questions.splice(toIdx, 0, moved);
        renderQuestions();
      }
    };

    // Touch drag
    grip.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      e.preventDefault();
      touchDrag.active = true;
      touchDrag.fromIdx = idx;
      document.body.classList.add('dragging-mode');
      card.classList.add('dragging');
    }, { passive: false });

    grip.addEventListener('touchend', () => {
      // drop is handled at container touchend
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
  }, { passive: false });

  container.addEventListener('touchend', (e) => {
    if (!touchDrag.active) return;
    e.preventDefault();

    const allCards = Array.from(container.querySelectorAll('.question-card'));
    let targetCardIdx = null;
    allCards.forEach((c, index) => {
      if (c.classList.contains('drag-over')) {
        targetCardIdx = index;
      }
      c.classList.remove('drag-over');
      c.classList.remove('dragging');
    });

    document.body.classList.remove('dragging-mode');

    const toIdx = targetCardIdx !== null ? parseInt(allCards[targetCardIdx].dataset.questionIndex, 10) : null;
    if (toIdx !== null &&
        toIdx !== touchDrag.fromIdx &&
        touchDrag.fromIdx >= 0 &&
        touchDrag.fromIdx < questions.length) {
      recordState("Move Question");
      const [moved] = questions.splice(touchDrag.fromIdx, 1);
      questions.splice(toIdx, 0, moved);
      renderQuestions();
    }

    touchDrag.active = false;
    touchDrag.fromIdx = null;
  }, { passive: false });
}

function makeSectionsDraggable() {
  const cards = document.querySelectorAll('.section-card');

  cards.forEach((card) => {
    const idx = parseInt(card.dataset.sectionIndex, 10);
    const grip = card.querySelector('.drag-grip');
    if (!grip) return;

    grip.draggable = true;
    grip.ondragstart = (e) => {
      document.body.classList.add('dragging-mode');
      e.dataTransfer.setData('text/plain', idx);
      card.classList.add('dragging');
    };

    grip.ondragend = () => {
      document.body.classList.remove('dragging-mode');
      card.classList.remove('dragging');
      document.querySelectorAll('.section-card').forEach(c => c.classList.remove('drag-over'));
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

      const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
      const toIdx = idx;
      if (fromIdx !== toIdx && fromIdx >= 0 && toIdx >= 0 && fromIdx < sections.length) {
        recordState("Move Section");
        const [moved] = sections.splice(fromIdx, 1);
        sections.splice(toIdx, 0, moved);
        renderQuestions();
        debouncedSave();
      }
    };
  });
}

// Total marks + snapshot total
function updateTotalMarks() {
  const total = questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);
  const max = Number(maxMarksInput.value) || 0;

  snapTotal.textContent = total;

  marksInfo.classList.remove('marks-ok', 'marks-warning');
  marksInfo.style.color = '';

  if (!max || total <= max) {
    marksInfo.textContent = 'Total: ' + total;
    marksInfo.classList.add('marks-ok');
    marksOverAlertShown = false;
  } else {
    const over = total - max;
    marksInfo.textContent = 'Total: ' + total + ' (exceeds max ' + max + ' by ' + over + ')';
    marksInfo.classList.add('marks-warning');
    if (!marksOverAlertShown) {
      marksOverAlertShown = true;
      if (typeof showConfirm === 'function') {
        showConfirm('Total marks (' + total + ') exceed the maximum marks (' + max + ') by ' + over + '. Please review your questions.', 'OK', null);
      }
    }
  }

  const runningTotalCard = document.getElementById('runningTotalCard');
  if (runningTotalCard) {
    runningTotalCard.innerHTML =
      '<span>Running Total</span>' +
      '<span class="running-total-right">' +
        '<span class="running-questions">' + questions.length + ' Question' + (questions.length === 1 ? '' : 's') + '</span>' +
        '<span class="running-marks"><b>' + total + '</b> / ' + max + ' Max Marks</span>' +
      '</span>';
  }

  if (typeof updatePaperInfoCard === 'function') updatePaperInfoCard();
}

// Question modal for add/edit
function openQuestionModal(question, sectionId) {
  const isEdit = !!question;
  const q = question || createEmptyQuestion('short', sectionId);

  const existing = document.getElementById('questionModal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'questionModal';
  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.remove();
  };

  const modal = document.createElement('div');
  modal.className = 'question-modal';

  const header = document.createElement('div');
  header.className = 'question-modal-header';

  const title = document.createElement('h3');
  title.className = 'question-modal-title';
  title.textContent = isEdit ? 'Edit Question' : 'Add Question';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'question-modal-close';
  closeBtn.innerHTML = '&times;';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.onclick = () => overlay.remove();

  header.appendChild(title);
  header.appendChild(closeBtn);
  modal.appendChild(header);

  const marksWrap = document.createElement('div');
  marksWrap.className = 'marks-weight';
  marksWrap.innerHTML = '<label>Marks Weight: <input type="number" min="0" value="' + (q.marks || 0) + '"></label>';

  const labelRow = document.createElement('div');
  labelRow.className = 'question-modal-label-row';
  const label = document.createElement('label');
  label.className = 'question-modal-label';
  label.textContent = 'QUESTION TEXT';
  labelRow.appendChild(label);
  labelRow.appendChild(marksWrap);
  modal.appendChild(labelRow);

  const editor = document.createElement('div');
  editor.id = 'questionModalEditor';
  editor.contentEditable = true;
  editor.setAttribute('data-placeholder', 'Type your question here...');
  editor.setAttribute('aria-label', 'Question text');
  editor.innerHTML = isEdit ? (q.text || '') : '';
  modal.appendChild(editor);

  const toolbar = document.createElement('div');
  toolbar.className = 'modal-toolbar';

  const commands = [
    { cmd: 'bold', icon: '<b>B</b>', label: 'Bold' },
    { cmd: 'italic', icon: '<i>I</i>', label: 'Italic' },
    { cmd: 'underline', icon: '<u>U</u>', label: 'Underline' },
    { cmd: 'insertUnorderedList', icon: '&bull;', label: 'Bullets' },
    { cmd: 'insertOrderedList', icon: '1.', label: 'Numbers' }
  ];
  commands.forEach(({ cmd, icon, label }) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = icon;
    b.title = label;
    b.setAttribute('aria-label', label);
    b.onclick = () => {
      editor.focus();
      document.execCommand('styleWithCSS', false, null);
      document.execCommand(cmd, false, null);
      editor.focus();
    };
    toolbar.appendChild(b);
  });

  const imgBtn = document.createElement('button');
  imgBtn.type = 'button';
  imgBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';
  imgBtn.title = 'Insert image';
  imgBtn.setAttribute('aria-label', 'Insert image');
  imgBtn.onclick = () => {
    const url = prompt('Image URL:');
    if (url) {
      editor.focus();
      document.execCommand('insertImage', false, url);
    }
  };
  toolbar.appendChild(imgBtn);
  modal.appendChild(toolbar);

  const footer = document.createElement('div');
  footer.className = 'question-modal-footer';

  const cancelAction = document.createElement('button');
  cancelAction.type = 'button';
  cancelAction.className = 'modal-btn modal-btn-cancel';
  cancelAction.textContent = 'Cancel';
  cancelAction.onclick = () => overlay.remove();

  const saveAction = document.createElement('button');
  saveAction.type = 'button';
  saveAction.className = 'modal-btn modal-btn-save';
  saveAction.textContent = isEdit ? 'Update' : 'Add Question';
  saveAction.onclick = () => {
    recordState(isEdit ? "Edit Question" : "Add Question");
    q.marks = parseFloat(marksWrap.querySelector('input').value) || 0;
    q.text = sanitizeHtml(editor.innerHTML);
    if (!isEdit) {
      questions.push(q);
    }
    overlay.remove();
    renderQuestions();
    debouncedSave();
  };

  footer.appendChild(cancelAction);
  footer.appendChild(saveAction);
  modal.appendChild(footer);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  editor.focus();
}

function makeMarksEditable(marksBadge, q) {
  const current = Number(q.marks) || 0;
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
  input.step = '0.5';
  input.value = current;
  input.className = 'question-card-marks-input';
  input.title = 'Press Enter or click outside to save';
  marksBadge.replaceWith(input);
  input.focus();
  input.select();

  const save = () => {
    recordState("Change Marks");
    const val = parseFloat(input.value);
    q.marks = isNaN(val) || val < 0 ? 0 : val;
    renderQuestions();
    debouncedSave();
  };

  input.addEventListener('blur', save);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      save();
    } else if (e.key === 'Escape') {
      renderQuestions();
    }
  });
}

function validateRender() {
  const rendered = questionsContainer.querySelectorAll('.question-card').length;
  if (rendered !== questions.length) {
    console.error('Render regression: expected ' + questions.length + ' question cards, found ' + rendered);
  }
}

function duplicateQuestion(id) {
  recordState("Duplicate Question");
  const idx = questions.findIndex(q => q.id === id);
  if (idx < 0) return;
  const clone = JSON.parse(JSON.stringify(questions[idx]));
  clone.id = Date.now() + Math.random();
  questions.splice(idx + 1, 0, clone);
  renderQuestions();
  debouncedSave();
}

// Section helpers
function generateSectionId() {
  return 'sec-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
}

function newUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return Date.now().toString(36);
}

function createSection(title, instructions) {
  recordState('Add Section');
  if (!title) return;
  if (!currentSectionId && sections.length) currentSectionId = sections[0].id;
  const activeIndex = Math.max(0, sections.findIndex(s => s.id === currentSectionId));
  const newSection = {
    id: newUUID(),
    name: title,
    type: 'Multiple Choice',
    instructions: instructions || '',
    collapsed: false,
    questionIds: []
  };
  sections.splice(activeIndex + 1, 0, newSection);
  currentSectionId = newSection.id;
  renderQuestions();
  updateTotalMarks();
  debouncedSave();
}

function openAddSectionModal() {
  const modal = document.getElementById('addSectionModal');
  const nameInput = document.getElementById('addSectionName');
  const instructionsInput = document.getElementById('addSectionInstructions');
  if (!modal) return;
  if (nameInput) nameInput.value = '';
  if (instructionsInput) instructionsInput.value = '';
  if (nameInput) nameInput.focus();
  modal.style.display = 'flex';
}

function closeAddSectionModal() {
  const modal = document.getElementById('addSectionModal');
  if (modal) modal.style.display = 'none';
}

function addSection() {
  openAddSectionModal();
}

function moveSection(id, direction) {
  recordState('Move Section');
  const idx = sections.findIndex(s => s.id === id);
  if (idx < 0) return;
  if (direction === 'up' && idx > 0) {
    [sections[idx], sections[idx - 1]] = [sections[idx - 1], sections[idx]];
  } else if (direction === 'down' && idx < sections.length - 1) {
    [sections[idx], sections[idx + 1]] = [sections[idx + 1], sections[idx]];
  }
  renderQuestions();
  debouncedSave();
}

function deleteSection(id) {
  recordState('Delete Section');
  const idx = sections.findIndex(s => s.id === id);
  if (idx < 0) return;
  const removed = sections.splice(idx, 1)[0];
  questions = questions.filter(q => q.sectionId !== removed.id);
  if (sections.length === 0) {
    sections = [];
    questions = [];
    currentSectionId = null;
  } else {
    const target = sections[Math.max(0, idx - 1)] || sections[0];
    currentSectionId = target.id;
  }
  renderQuestions();
  debouncedSave();
}

function createSectionHeader(section) {
  const header = document.createElement('div');
  header.className = 'section-header';
  header.dataset.sectionId = section.id;

  const sectionQuestions = questions.filter(q =>
    q.sectionId === section.id || (section.id === (sections[0] && sections[0].id) && !q.sectionId)
  );
  const questionCount = sectionQuestions.length;
  const totalMarks = sectionQuestions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);

  const printInfo = document.createElement('div');
  printInfo.className = 'section-print';
  const printHeader = document.createElement('div');
  printHeader.className = 'print-section-header';
  const printName = document.createElement('div');
  printName.className = 'print-section-name';
  printName.textContent = section.name || '';
  const printMarks = document.createElement('div');
  printMarks.className = 'print-section-marks';
  printMarks.textContent = '[' + totalMarks + ' Marks]';
  printHeader.appendChild(printName);
  printHeader.appendChild(printMarks);
  const printMeta = document.createElement('div');
  printMeta.className = 'print-section-instructions';
  printMeta.textContent = section.instructions || '';
  printInfo.appendChild(printHeader);
  printInfo.appendChild(printMeta);

  const controls = document.createElement('div');
  controls.className = 'section-controls';

  const headerTop = document.createElement('div');
  headerTop.className = 'section-header-top';

  const dragGrip = document.createElement('span');
  dragGrip.className = 'drag-grip';
  dragGrip.title = 'Drag to reorder';
  for (let i = 0; i < 6; i++) {
    const dot = document.createElement('span');
    dragGrip.appendChild(dot);
  }

  const downArrowSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>';
  const rightArrowSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';

  const collapseArrow = document.createElement('span');
  collapseArrow.className = 'section-collapse-arrow';
  collapseArrow.innerHTML = section.collapsed ? rightArrowSvg : downArrowSvg;
  collapseArrow.setAttribute('aria-label', section.collapsed ? 'Expand section' : 'Collapse section');
  collapseArrow.onclick = (e) => {
    e.stopPropagation();
    section.collapsed = !section.collapsed;
    renderQuestions();
    debouncedSave();
  };

  const titleSpan = document.createElement('span');
  titleSpan.className = 'section-title-text';
  titleSpan.textContent = section.name || '';

  const qBadge = document.createElement('span');
  qBadge.className = 'section-stat';
  qBadge.textContent = questionCount + (questionCount === 1 ? ' Question' : ' Questions');

  const mBadge = document.createElement('span');
  mBadge.className = 'section-stat';
  mBadge.textContent = totalMarks + (totalMarks === 1 ? ' Mark' : ' Marks');

  const menuWrap = document.createElement('div');
  menuWrap.className = 'section-menu';
  menuWrap.style.position = 'relative';

  const menuBtn = document.createElement('button');
  menuBtn.type = 'button';
  menuBtn.className = 'section-menu-btn';
  menuBtn.textContent = '⋮';
  menuBtn.setAttribute('aria-label', 'Section menu');

  const dropdown = document.createElement('div');
  dropdown.className = 'section-menu-dropdown';

  const renameAction = () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'section-title-input';
    input.value = section.name || '';
    input.onkeydown = (ev) => { if (ev.key === 'Enter') input.blur(); };
    input.onblur = () => {
      recordState('Rename Section');
      const newName = input.value.trim();
      if (newName) section.name = newName;
      titleSpan.textContent = section.name || '';
      printInfo.querySelector('.print-section-name').textContent = section.name || '';
      input.replaceWith(titleSpan);
      debouncedSave();
    };
    titleSpan.replaceWith(input);
    input.focus();
  };

  titleSpan.style.cursor = 'pointer';
  titleSpan.title = 'Click to edit section name';
  titleSpan.addEventListener('click', (e) => {
    e.stopPropagation();
    renameAction();
  });

  const duplicateAction = () => {
    recordState('Duplicate Section');
    const newSection = {
      id: generateSectionId(),
      name: (section.name || 'Section') + ' (Copy)',
      type: section.type || 'Multiple Choice',
      instructions: section.instructions || '',
      collapsed: false,
      questionIds: []
    };
    const idx = sections.findIndex(s => s.id === section.id);
    if (idx >= 0) {
      sections.splice(idx + 1, 0, newSection);
    } else {
      sections.push(newSection);
    }
    sectionQuestions.forEach(q => {
      const clone = JSON.parse(JSON.stringify(q));
      clone.id = Date.now() + Math.random();
      clone.sectionId = newSection.id;
      questions.push(clone);
    });
    currentSectionId = newSection.id;
    renderQuestions();
    debouncedSave();
  };

  const deleteAction = async () => {
    const safeName = (section.name || 'this section')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const ok = await showConfirm(
      'Delete Section<br><br>Are you sure you want to delete <strong>"' + safeName + '"</strong> and all questions inside it?',
      'Delete'
    );
    if (!ok) return;
    deleteSection(section.id);
  };

  const menuItems = [
    { label: 'Rename Section', action: renameAction },
    { label: 'Duplicate Section', action: duplicateAction },
    { label: 'Move Up', action: () => moveSection(section.id, 'up') },
    { label: 'Move Down', action: () => moveSection(section.id, 'down') },
    { label: 'Delete Section', action: deleteAction, danger: true }
  ];

  menuItems.forEach(({ label, action, danger }) => {
    const item = document.createElement('div');
    item.className = 'section-menu-item' + (danger ? ' section-menu-item-danger' : '');
    item.textContent = label;
    item.onclick = async (e) => {
      e.stopPropagation();
      dropdown.style.display = 'none';
      await action();
    };
    dropdown.appendChild(item);
  });

  menuBtn.onclick = (e) => {
    e.stopPropagation();
    document.querySelectorAll('.section-menu-dropdown').forEach(d => {
      if (d !== dropdown) d.style.display = 'none';
    });
    dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
  };

  dropdown.onclick = (e) => {
    e.stopPropagation();
  };

  menuWrap.appendChild(menuBtn);
  menuWrap.appendChild(dropdown);

  headerTop.appendChild(dragGrip);
  headerTop.appendChild(collapseArrow);
  headerTop.appendChild(titleSpan);

  const sectionStats = document.createElement('div');
  sectionStats.className = 'section-stats';
  sectionStats.appendChild(qBadge);
  sectionStats.appendChild(mBadge);
  sectionStats.appendChild(menuWrap);
  headerTop.appendChild(sectionStats);

  const instructionsLabel = document.createElement('label');
  instructionsLabel.className = 'section-instructions-label';
  instructionsLabel.textContent = 'INSTRUCTIONS (OPTIONAL)';

  const instructions = document.createElement('textarea');
  instructions.className = 'section-instructions';
  instructions.placeholder = 'Show all calculations clearly.';
  instructions.value = section.instructions || '';
  instructions.oninput = e => { section.instructions = e.target.value; };

  controls.appendChild(headerTop);
  controls.appendChild(instructionsLabel);
  controls.appendChild(instructions);

  header.appendChild(printInfo);
  header.appendChild(controls);

  header.addEventListener('click', (e) => {
    if (e.target.closest('button, input, select, textarea, .section-menu, .section-stats, .drag-grip')) return;
    section.collapsed = !section.collapsed;
    renderQuestions();
    debouncedSave();
  });

  return header;
}

// Print table/data helper
function renderPrintTable(q) {
  if (!q || !Array.isArray(q.table) || !q.table.length) return null;
  const table = document.createElement('table');
  table.className = 'print-data-table';
  q.table.forEach((row, rIdx) => {
    const tr = document.createElement('tr');
    const cells = Array.isArray(row) ? row : [row];
    cells.forEach((cell) => {
      const td = document.createElement(rIdx === 0 ? 'th' : 'td');
      td.textContent = cell == null ? '' : String(cell);
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });
  return table;
}

// Main renderer
function renderQuestions() {
  questionsContainer.innerHTML = '';

  if (sections.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-sections-card';
    empty.innerHTML = `
      <div class="empty-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg></div>
      <div class="empty-title">No sections yet</div>
      <p class="empty-sub">Add your first section to start building the paper. Each section represents a part of the test (e.g. Section A: Word Problems).</p>
      <button type="button" class="btn-add-section" id="emptyAddSectionBtn">+ Add Section</button>
    `;
    questionsContainer.appendChild(empty);
    empty.querySelector('#emptyAddSectionBtn').onclick = () => { addSection(); };
    return;
  }

  const validSectionIds = new Set(sections.map(s => s.id));
  let globalQuestionCount = 1;
  sections.forEach((section, sectionIndex) => {
    const sectionCard = document.createElement('div');
    sectionCard.className = 'section-card' + (section.collapsed ? ' collapsed' : '');
    sectionCard.dataset.sectionIndex = String(sectionIndex);

    const sectionHeader = createSectionHeader(section);
    sectionCard.appendChild(sectionHeader);

    const sectionBody = document.createElement('div');
    sectionBody.className = 'section-body';
    sectionCard.appendChild(sectionBody);

    let sectionQuestionCount = 0;

    if (!section.collapsed) {
      const hasQuestions = questions.some(q =>
        q.sectionId === section.id || (sectionIndex === 0 && !validSectionIds.has(q.sectionId))
      );
      if (hasQuestions) {
        const bodyHeader = document.createElement('div');
        bodyHeader.className = 'section-body-header';
        bodyHeader.innerHTML = '<span>Questions</span><span>Drag to reorder</span>';
        sectionBody.appendChild(bodyHeader);
      }
    }

    questions.forEach((q, idx) => {
      const belongsToSection = q.sectionId === section.id || (sectionIndex === 0 && !validSectionIds.has(q.sectionId));
      if (!belongsToSection) return;
      sectionQuestionCount++;

      const displayIndex = globalQuestionCount++;
      const card = document.createElement('div');
      card.className = 'question-card';
      card.dataset.questionIndex = String(idx);

      const header = document.createElement('div');
      header.className = 'question-header';

      const left = document.createElement('div');
      left.className = 'question-header-left';
      const qLabelText = 'Q' + displayIndex;

    const qLabelSpan = document.createElement('div');
    qLabelSpan.className = 'question-number-label';
    qLabelSpan.textContent = 'QUESTION ' + displayIndex;

    const contentEditable = document.createElement('div');
    contentEditable.className = 'question-text content-editable hidden';
    contentEditable.contentEditable = true;
    contentEditable.setAttribute('aria-label', 'Question text');
    contentEditable.innerHTML = q.text || '';

    const text = document.createElement('div');
    text.className = 'question-card-text';
    text.innerHTML = q.text || '';

    const typeSelect = document.createElement('select');
    typeSelect.className = 'question-type-select';
    Object.entries(QUESTION_TYPE_SHORT_LABELS).forEach(([value, label]) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      if ((q.type || 'multiple') === value) opt.selected = true;
      typeSelect.appendChild(opt);
    });
    typeSelect.onchange = e => {
      recordState("Change Question Type");
      changeQuestionType(q, e.target.value);
      renderQuestions();
      debouncedSave();
    };

    const expandBtn = document.createElement('img');
    expandBtn.src = 'expand.svg';
    expandBtn.alt = 'Expand question';
    expandBtn.className = 'expand-icon';
    expandBtn.onclick = () => openQuestionModal(q, section.id);

    const main = document.createElement('div');
    main.className = 'question-card-main';
    main.appendChild(qLabelSpan);
    main.appendChild(text);
    left.appendChild(main);
    left.appendChild(contentEditable);
    left.appendChild(typeSelect);
    left.appendChild(expandBtn);
    header.appendChild(left);
    makeImagesResizable(contentEditable);

    const right = document.createElement('div');
    right.className = 'question-header-right';

    const qMarks = Number(q.marks) || 0;
    const marksBadge = document.createElement('span');
    marksBadge.className = 'question-card-marks';
    marksBadge.textContent = qMarks + ' Mark' + (qMarks === 1 ? '' : 's');
    marksBadge.title = 'Click to edit marks';
    marksBadge.style.cursor = 'pointer';
    marksBadge.onclick = () => makeMarksEditable(marksBadge, q);
    right.appendChild(marksBadge);

    const cardActions = document.createElement('div');
    cardActions.className = 'question-card-actions';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'icon-btn';
    editBtn.title = 'Edit';
    editBtn.setAttribute('aria-label', 'Edit question');
    editBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>';
    editBtn.onclick = () => openQuestionModal(q, section.id);

    const dupBtn = document.createElement('button');
    dupBtn.type = 'button';
    dupBtn.className = 'icon-btn';
    dupBtn.title = 'Duplicate';
    dupBtn.setAttribute('aria-label', 'Duplicate question');
    dupBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
    dupBtn.onclick = () => duplicateQuestion(q.id);

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'icon-btn';
    delBtn.title = 'Delete';
    delBtn.setAttribute('aria-label', 'Delete question');
    delBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
    delBtn.onclick = async () => {
      const ok = await showConfirm(
        'Delete Question\n\nAre you sure you want to delete QUESTION ' + displayIndex + ' from "' + (section.name || 'SECTION') + '"?\n\nThis action cannot be undone.',
        'Delete'
      );
      if (!ok) return;
      recordState("Delete Question");
      questions = questions.filter(qq => qq.id !== q.id);
      renderQuestions();
      debouncedSave();
    };

    cardActions.appendChild(editBtn);
    cardActions.appendChild(dupBtn);
    cardActions.appendChild(delBtn);
    right.appendChild(cardActions);

    const marksWrap = document.createElement('span');
    marksWrap.className = 'question-marks-input-wrap hidden';
    marksWrap.innerHTML =
      'Marks: <input type="number" min="0" class="marks-input" value="' + (q.marks || 0) + '">';
    right.appendChild(marksWrap);

    const legacyActions = document.createElement('div');
    legacyActions.className = 'question-actions hidden';
    const legacyDelBtn = document.createElement('button');
    legacyDelBtn.innerHTML = '<img src="delete.svg" width="24" height="24" style="width:24px;height:24px;" alt="Delete">';
    legacyDelBtn.title = 'Delete question';
    legacyDelBtn.setAttribute('aria-label', 'Delete question');
    legacyDelBtn.onclick = delBtn.onclick;
    legacyActions.appendChild(legacyDelBtn);
    right.appendChild(legacyActions);
    header.appendChild(right);
    card.appendChild(header);

    // Rich text editor per question
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
    insertImageBtn.onclick = () => imageInput.click();
    toolbar.querySelectorAll('button[title]').forEach(b => b.setAttribute('aria-label', b.getAttribute('title')));

    editorWrap.appendChild(toolbar);
    card.appendChild(editorWrap);

    imageInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        contentEditable.focus();
        insertImageAtCursor(contentEditable, ev.target.result);
        syncQuestionText();
      };
      reader.readAsDataURL(file);
      imageInput.value = '';
    });

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

    toolbar.querySelectorAll('.format-btn:not(.clear-btn):not(.insert-image-btn)').forEach(btn => {
      btn.onclick = () => {
        const command = btn.dataset.command;
        const value = btn.dataset.value;
        handleFormat(command, value);
        updateToolbarState();
      };
    });

    toolbar.querySelector('.clear-btn').onclick = () => {
      contentEditable.focus();
      document.execCommand('selectAll', false, null);
      document.execCommand('removeFormat');
      document.execCommand('styleWithCSS', false, null);
      contentEditable.innerHTML = contentEditable.textContent || '';
      contentEditable.focus();
      updateToolbarState();
    };

    const syncQuestionText = () => {
      q.text = sanitizeHtml(contentEditable.innerHTML);
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

    contentEditable.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
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

    const qType = q.type || 'multiple';

    // Answer editing controls (hidden in print)
    const answerContainer = document.createElement('div');
    answerContainer.className = 'question-answer';

    if (qType === 'multiple') {
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

        const optionLabel = String.fromCharCode(65 + oIdx);
        const removeBtn = document.createElement('button');
        removeBtn.innerHTML = '<img src="delete.svg" width="24" height="24" style="width:24px;height:24px;" alt="Delete option">';
        removeBtn.setAttribute('aria-label', 'Remove option ' + optionLabel);
        removeBtn.onclick = async () => {
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
      addOptBtn.setAttribute('aria-label', 'Add option');
      addOptBtn.innerHTML = '<img src="add-answers.svg" alt="Add option">Add option';
      addOptBtn.onclick = () => {
        q.options.push({ text: '' });
        renderQuestions();
        setTimeout(() => {
          const thisCard = card;
          if (!thisCard) return;
          const inputs = thisCard.querySelectorAll('.option-row input[type="text"]');
          const lastInput = inputs[inputs.length - 1];
          if (lastInput) lastInput.focus();
        }, 0);
      };
      optionsDiv.appendChild(addOptBtn);
      answerContainer.appendChild(optionsDiv);
    } else if (qType === 'truefalse') {
      const tfWrap = document.createElement('div');
      tfWrap.className = 'truefalse-options';

      const trueLabel = document.createElement('label');
      trueLabel.className = 'truefalse-option';
      const trueRadio = document.createElement('input');
      trueRadio.type = 'radio';
      trueRadio.disabled = true;
      const trueText = document.createElement('span');
      trueText.textContent = 'True';
      trueLabel.appendChild(trueRadio);
      trueLabel.appendChild(trueText);
      tfWrap.appendChild(trueLabel);

      const falseLabel = document.createElement('label');
      falseLabel.className = 'truefalse-option';
      const falseRadio = document.createElement('input');
      falseRadio.type = 'radio';
      falseRadio.disabled = true;
      const falseText = document.createElement('span');
      falseText.textContent = 'False';
      falseLabel.appendChild(falseRadio);
      falseLabel.appendChild(falseText);
      tfWrap.appendChild(falseLabel);

      answerContainer.appendChild(tfWrap);
    } else if (qType === 'short') {
      const shortInput = document.createElement('input');
      shortInput.type = 'text';
      shortInput.className = 'short-answer-placeholder';
      shortInput.placeholder = 'Short answer';
      shortInput.disabled = true;
      answerContainer.appendChild(shortInput);
    } else if (qType === 'long') {
      const longTextarea = document.createElement('textarea');
      longTextarea.className = 'long-answer-placeholder';
      longTextarea.rows = 4;
      longTextarea.placeholder = 'Long answer';
      longTextarea.disabled = true;
      answerContainer.appendChild(longTextarea);
    } else if (qType === 'fillblank') {
      const blanksWrap = document.createElement('div');
      blanksWrap.className = 'fillblank-rows';

      const blanksTitle = document.createElement('div');
      blanksTitle.className = 'options-title';
      blanksTitle.textContent = 'Blanks';
      blanksWrap.appendChild(blanksTitle);

      if (!Array.isArray(q.blanks)) q.blanks = [{ id: 'b-' + Date.now() + '-1', answer: '' }];
      q.blanks.forEach((b, bIdx) => {
        const row = document.createElement('div');
        row.className = 'fillblank-row';

        const label = document.createElement('span');
        label.className = 'label';
        label.textContent = 'Blank ' + (bIdx + 1) + ':';
        row.appendChild(label);

        const answerInput = document.createElement('input');
        answerInput.type = 'text';
        answerInput.placeholder = 'Answer';
        answerInput.value = b.answer || '';
        answerInput.oninput = e => { b.answer = e.target.value; };
        row.appendChild(answerInput);

        const delBlankBtn = document.createElement('button');
        delBlankBtn.className = 'remove-blank';
        delBlankBtn.innerHTML = '<img src="delete.svg" width="24" height="24" style="width:24px;height:24px;" alt="Remove blank">';
        delBlankBtn.setAttribute('aria-label', 'Remove blank ' + (bIdx + 1));
        delBlankBtn.onclick = () => {
          q.blanks.splice(bIdx, 1);
          renderQuestions();
        };
        row.appendChild(delBlankBtn);

        blanksWrap.appendChild(row);
      });

      const addBlankBtn = document.createElement('button');
      addBlankBtn.type = 'button';
      addBlankBtn.className = 'btn-add-option add-blank-btn';
      addBlankBtn.setAttribute('aria-label', 'Add blank');
      addBlankBtn.innerHTML = '<img src="add-answers.svg" alt="Add blank">Add Blank';
      addBlankBtn.onclick = () => {
        const newId = 'b-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
        q.blanks.push({ id: newId, answer: '' });
        renderQuestions();
      };
      blanksWrap.appendChild(addBlankBtn);

      answerContainer.appendChild(blanksWrap);
    } else if (qType === 'multiple_correct') {
      const optionsDiv = document.createElement('div');
      optionsDiv.className = 'options multiple-correct-options';
      const optTitle = document.createElement('div');
      optTitle.className = 'options-title';
      optTitle.textContent = 'Options (check all that are correct)';
      optionsDiv.appendChild(optTitle);

      const optionsGrid = document.createElement('div');
      optionsGrid.className = 'options-grid';

      q.options.forEach((opt, oIdx) => {
        const row = document.createElement('div');
        row.className = 'option-row';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !!opt.isCorrect;
        cb.title = 'Correct option';
        cb.onchange = e => { opt.isCorrect = e.target.checked; };
        row.appendChild(cb);

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

        const optionLabel = String.fromCharCode(65 + oIdx);
        const removeBtn = document.createElement('button');
        removeBtn.innerHTML = '<img src="delete.svg" width="24" height="24" style="width:24px;height:24px;" alt="Delete option">';
        removeBtn.setAttribute('aria-label', 'Remove option ' + optionLabel);
        removeBtn.onclick = async () => {
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
      addOptBtn.setAttribute('aria-label', 'Add option');
      addOptBtn.innerHTML = '<img src="add-answers.svg" alt="Add option">Add option';
      addOptBtn.onclick = () => {
        q.options.push({ text: '', isCorrect: false });
        renderQuestions();
        setTimeout(() => {
          const thisCard = card;
          if (!thisCard) return;
          const inputs = thisCard.querySelectorAll('.option-row input[type="text"]');
          const lastInput = inputs[inputs.length - 1];
          if (lastInput) lastInput.focus();
        }, 0);
      };
      optionsDiv.appendChild(addOptBtn);
      answerContainer.appendChild(optionsDiv);
    } else if (qType === 'numeric') {
      const numericWrap = document.createElement('div');
      numericWrap.className = 'numeric-row';

      const label = document.createElement('span');
      label.className = 'options-title';
      label.textContent = 'Expected answer';
      numericWrap.appendChild(label);

      const numInput = document.createElement('input');
      numInput.type = 'number';
      numInput.className = 'numeric-input';
      numInput.placeholder = '0';
      numInput.value = q.answer !== undefined ? String(q.answer) : '';
      numInput.oninput = e => { q.answer = e.target.value; };
      numericWrap.appendChild(numInput);

      answerContainer.appendChild(numericWrap);
    } else if (qType === 'match') {
      const matchWrap = document.createElement('div');
      matchWrap.className = 'match-rows';

      const matchTitle = document.createElement('div');
      matchTitle.className = 'options-title';
      matchTitle.textContent = 'Matching pairs';
      matchWrap.appendChild(matchTitle);

      if (!Array.isArray(q.pairs)) q.pairs = [{ left: '', right: '' }];
      q.pairs.forEach((p, pIdx) => {
        const row = document.createElement('div');
        row.className = 'match-row';
        row.dataset.pairIndex = String(pIdx);

        const leftInput = document.createElement('input');
        leftInput.type = 'text';
        leftInput.placeholder = 'Left';
        leftInput.value = p.left || '';
        leftInput.oninput = e => { p.left = e.target.value; };
        row.appendChild(leftInput);

        const rightInput = document.createElement('input');
        rightInput.type = 'text';
        rightInput.placeholder = 'Right';
        rightInput.value = p.right || '';
        rightInput.oninput = e => { p.right = e.target.value; };
        row.appendChild(rightInput);

        const delBtn = document.createElement('button');
        delBtn.innerHTML = '<img src="delete.svg" width="24" height="24" style="width:24px;height:24px;" alt="Remove pair">';
        delBtn.setAttribute('aria-label', 'Remove pair ' + (pIdx + 1));
        delBtn.onclick = () => {
          q.pairs.splice(pIdx, 1);
          renderQuestions();
        };
        row.appendChild(delBtn);

        matchWrap.appendChild(row);
      });

      const addPairBtn = document.createElement('button');
      addPairBtn.type = 'button';
      addPairBtn.className = 'btn-add-option';
      addPairBtn.setAttribute('aria-label', 'Add pair');
      addPairBtn.innerHTML = '<img src="add-answers.svg" alt="Add pair">Add Pair';
      addPairBtn.onclick = () => {
        q.pairs.push({ left: '', right: '' });
        renderQuestions();
      };
      matchWrap.appendChild(addPairBtn);
      answerContainer.appendChild(matchWrap);
    } else if (qType === 'paragraph') {
      const paraWrap = document.createElement('div');
      paraWrap.className = 'paragraph-editor';

      const passageTitle = document.createElement('div');
      passageTitle.className = 'options-title';
      passageTitle.textContent = 'Passage';
      paraWrap.appendChild(passageTitle);

      const passage = document.createElement('textarea');
      passage.className = 'paragraph-passage';
      passage.placeholder = 'Enter the paragraph / passage here...';
      passage.value = q.passage || '';
      passage.oninput = e => { q.passage = e.target.value; };
      paraWrap.appendChild(passage);

      const subQsWrap = document.createElement('div');
      subQsWrap.className = 'sub-questions';

      if (!Array.isArray(q.subQuestions)) q.subQuestions = [];
      q.subQuestions.forEach((sq, sqIdx) => {
        const sqCard = document.createElement('div');
        sqCard.className = 'sub-question-card';

        const sqHeader = document.createElement('div');
        sqHeader.className = 'sub-question-header';
        sqHeader.textContent = 'Q' + (sqIdx + 1);

        const typeSelect = document.createElement('select');
        typeSelect.className = 'sub-question-type-select';
        ['short', 'long', 'multiple'].forEach(t => {
          const opt = document.createElement('option');
          opt.value = t;
          opt.textContent = getQuestionTypeLabel(t);
          if (sq.type === t) opt.selected = true;
          typeSelect.appendChild(opt);
        });
        typeSelect.onchange = e => {
          sq.type = e.target.value;
          const base = createEmptySubQuestion(sq.type);
          base.id = sq.id;
          base.text = sq.text || '';
          base.marks = sq.marks || 0;
          Object.assign(sq, base);
          renderQuestions();
        };
        sqHeader.appendChild(typeSelect);

        const delSqBtn = document.createElement('button');
        delSqBtn.innerHTML = '<img src="delete.svg" width="24" height="24" style="width:24px;height:24px;" alt="Delete sub-question">';
        delSqBtn.setAttribute('aria-label', 'Delete sub-question ' + (sqIdx + 1));
        delSqBtn.onclick = () => {
          q.subQuestions.splice(sqIdx, 1);
          renderQuestions();
        };
        sqHeader.appendChild(delSqBtn);
        sqCard.appendChild(sqHeader);

        const sqText = document.createElement('textarea');
        sqText.className = 'sub-question-text';
        sqText.placeholder = 'Sub-question text';
        sqText.value = sq.text || '';
        sqText.oninput = e => { sq.text = e.target.value; };
        sqCard.appendChild(sqText);

        if (sq.type === 'multiple') {
          const optsWrap = document.createElement('div');
          optsWrap.className = 'options-grid';
          (sq.options || []).forEach((o, oIdx) => {
            const row = document.createElement('div');
            row.className = 'option-row';
            const label = document.createElement('span');
            label.className = 'label';
            label.textContent = String.fromCharCode(65 + oIdx) + '.';
            row.appendChild(label);
            const inp = document.createElement('input');
            inp.type = 'text';
            inp.value = o.text || '';
            inp.oninput = e => { o.text = e.target.value; };
            row.appendChild(inp);
            const rem = document.createElement('button');
            rem.innerHTML = '<img src="delete.svg" width="24" height="24" style="width:24px;height:24px;" alt="Remove option">';
            rem.onclick = () => { sq.options.splice(oIdx, 1); renderQuestions(); };
            row.appendChild(rem);
            optsWrap.appendChild(row);
          });
          sqCard.appendChild(optsWrap);
          const addOpt = document.createElement('button');
          addOpt.className = 'btn-add-option';
          addOpt.type = 'button';
          addOpt.textContent = 'Add option';
          addOpt.onclick = () => { if (!sq.options) sq.options = []; sq.options.push({ text: '' }); renderQuestions(); };
          sqCard.appendChild(addOpt);
        } else if (sq.type === 'short' || sq.type === 'long') {
          const ansInput = document.createElement('textarea');
          ansInput.className = 'sub-question-text';
          ansInput.placeholder = 'Answer / key points';
          ansInput.value = sq.answer || '';
          ansInput.oninput = e => { sq.answer = e.target.value; };
          sqCard.appendChild(ansInput);
        }

        subQsWrap.appendChild(sqCard);
      });

      const addSubBtn = document.createElement('button');
      addSubBtn.type = 'button';
      addSubBtn.className = 'btn-add-option';
      addSubBtn.innerHTML = '<img src="add-answers.svg" alt="Add sub-question">Add Sub-question';
      addSubBtn.onclick = () => {
        q.subQuestions.push(createEmptySubQuestion('short'));
        renderQuestions();
      };
      subQsWrap.appendChild(addSubBtn);
      paraWrap.appendChild(subQsWrap);
      answerContainer.appendChild(paraWrap);
    }

    card.appendChild(answerContainer);

    // Print-only preview
    const printPreview = document.createElement('div');
    printPreview.className = 'print-preview';

    const heading = document.createElement('div');
    heading.className = 'print-question-heading';

    const number = document.createElement('span');
    number.className = 'print-q-number';
    number.textContent = 'Q' + displayIndex + '. ';

    const title = document.createElement('span');
    title.className = 'print-question-title';
    title.innerHTML = q.text || '';

    const marksSpan = document.createElement('span');
    marksSpan.className = 'print-marks';
    const m = Number(q.marks) || 0;
    marksSpan.textContent = '[' + m + ' Mark' + (m === 1 ? '' : 's') + ']';

    heading.appendChild(number);
    heading.appendChild(title);
    heading.appendChild(marksSpan);
    printPreview.appendChild(heading);

    if (q.table) {
      const table = renderPrintTable(q);
      if (table) printPreview.appendChild(table);
    }

    if (qType === 'multiple' || qType === 'multiple_correct' || qType === 'truefalse') {
      const options = qType === 'truefalse' ? [{ text: 'True' }, { text: 'False' }] : (q.options || []);
      const printOptions = document.createElement('div');
      printOptions.className = 'print-options';
      options.forEach((opt, oIdx) => {
        const row = document.createElement('div');
        row.className = 'print-option-row';

        const labelSpan = document.createElement('span');
        labelSpan.className = 'print-option-label';
        labelSpan.textContent = String.fromCharCode(65 + oIdx) + '.';

        const textSpan = document.createElement('span');
        textSpan.className = 'print-option-text';
        textSpan.textContent = ' ' + (opt.text || '');

        row.appendChild(labelSpan);
        row.appendChild(textSpan);
        printOptions.appendChild(row);
      });
      printPreview.appendChild(printOptions);
    } else if (qType === 'short' || qType === 'numeric') {
      const shortBlank = document.createElement('div');
      shortBlank.className = 'print-numeric-blank';
      shortBlank.textContent = '';
      printPreview.appendChild(shortBlank);
    } else if (qType === 'long') {
      const longBox = document.createElement('div');
      longBox.className = 'print-long-box';
      longBox.textContent = '';
      printPreview.appendChild(longBox);
    } else if (qType === 'fillblank') {
      const blanksBox = document.createElement('div');
      blanksBox.className = 'print-fillblank';
      const blanks = q.blanks || [];
      blanks.forEach(() => {
        const line = document.createElement('div');
        line.className = 'print-blank-line';
        blanksBox.appendChild(line);
      });
      printPreview.appendChild(blanksBox);
    } else if (qType === 'match') {
      const matchBox = document.createElement('div');
      matchBox.className = 'print-match';
      const leftCol = document.createElement('div');
      leftCol.className = 'print-match-column';
      const rightCol = document.createElement('div');
      rightCol.className = 'print-match-column';
      const pairs = q.pairs || [];
      pairs.forEach((p) => {
        const lRow = document.createElement('div');
        lRow.className = 'print-match-row';
        lRow.textContent = p.left || '';
        leftCol.appendChild(lRow);
        const rRow = document.createElement('div');
        rRow.className = 'print-match-row';
        rRow.textContent = p.right || '';
        rightCol.appendChild(rRow);
      });
      matchBox.appendChild(leftCol);
      matchBox.appendChild(rightCol);
      printPreview.appendChild(matchBox);
    } else if (qType === 'paragraph') {
      const passage = document.createElement('div');
      passage.className = 'print-paragraph-passage';
      passage.textContent = q.passage || '';
      printPreview.appendChild(passage);

      const subQs = q.subQuestions || [];
      if (subQs.length) {
        const subWrap = document.createElement('div');
        subWrap.className = 'print-sub-questions';
        subQs.forEach((sq, sqIdx) => {
          const row = document.createElement('div');
          row.className = 'print-sub-question';
          const num = document.createElement('span');
          num.className = 'print-sub-question-number';
          num.textContent = 'Q' + (sqIdx + 1) + '.';
          const text = document.createElement('span');
          text.textContent = sq.text || '';
          row.appendChild(num);
          row.appendChild(text);
          subWrap.appendChild(row);
        });
        printPreview.appendChild(subWrap);
      }
    }

    card.appendChild(printPreview);

    // Marks input behavior with grey 0
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
        e.target.style.color = '#A8A8A8';
        updateTotalMarks();
      }
    });

    marksInputEl.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value) || 0;
      q.marks = val;
      if (val === 0) {
        e.target.style.color = '#A8A8A8';
      } else {
        e.target.style.color = '';
      }
      updateTotalMarks();
    });

    // Initial marks color
    if (!q.marks || q.marks === 0) {
      marksInputEl.style.color = '#A8A8A8';
    }

    sectionBody.appendChild(card);
  });

    if (sectionQuestionCount === 0) {
      const emptyQuestions = document.createElement('div');
      emptyQuestions.className = 'empty-questions-area';
      emptyQuestions.innerHTML = '<div class="empty-questions-icon">+</div><div class="empty-questions-title">No questions in this section yet</div>';
      const addQuestionBtn = document.createElement('button');
      addQuestionBtn.type = 'button';
      addQuestionBtn.className = 'btn-add-question-outline';
      addQuestionBtn.innerHTML = '+ Add Question';
      addQuestionBtn.onclick = (e) => {
        e.stopPropagation();
        openQuestionModal(null, section.id);
      };
      emptyQuestions.appendChild(addQuestionBtn);
      sectionBody.appendChild(emptyQuestions);
    } else {
      const addQuestionBtn = document.createElement('button');
      addQuestionBtn.type = 'button';
      addQuestionBtn.className = 'add-question-row';
      addQuestionBtn.textContent = '+ Add Question';
      addQuestionBtn.onclick = (e) => {
        e.stopPropagation();
        openQuestionModal(null, section.id);
      };
      sectionBody.appendChild(addQuestionBtn);
    }

    questionsContainer.appendChild(sectionCard);
  });

  const endOfPaper = document.createElement('div');
  endOfPaper.className = 'end-of-paper';
  endOfPaper.textContent = '— End of Paper —';
  questionsContainer.appendChild(endOfPaper);

  updateTotalMarks();
  makeDraggable();
  makeSectionsDraggable();
  if (typeof toggleBottomToolbar === 'function') {
    toggleBottomToolbar();
  }

  validateRender();
}

// Keyboard shortcuts: Alt+Q, Alt+A
document.addEventListener('keydown', (e) => {
  if (!e.altKey) return;
  const key = e.key.toLowerCase();
  if (key === 'q') {
    e.preventDefault();
    addQuestionOfSelectedType();
  } else if (key === 'a') {
    e.preventDefault();
    if (questions.length === 0) return;
    const last = questions[questions.length - 1];
    const qType = last.type || 'multiple';
    if (qType !== 'multiple') return;
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

// Add section modal handlers
const addSectionModal = document.getElementById('addSectionModal');
const addSectionName = document.getElementById('addSectionName');
const addSectionInstructions = document.getElementById('addSectionInstructions');
const addSectionModalAdd = document.getElementById('addSectionModalAdd');
const addSectionModalCancel = document.getElementById('addSectionModalCancel');
const addSectionModalClose = document.getElementById('addSectionModalClose');

if (addSectionModal) {
  addSectionModal.addEventListener('click', (e) => { if (e.target === addSectionModal) closeAddSectionModal(); });
}

if (addSectionModalAdd) {
  addSectionModalAdd.onclick = () => {
    const title = (addSectionName && addSectionName.value || '').trim();
    if (!title) {
      if (addSectionName) addSectionName.focus();
      return;
    }
    createSection(title, (addSectionInstructions && addSectionInstructions.value || '').trim());
    closeAddSectionModal();
  };
}

if (addSectionModalCancel) addSectionModalCancel.onclick = closeAddSectionModal;
if (addSectionModalClose) addSectionModalClose.onclick = closeAddSectionModal;
