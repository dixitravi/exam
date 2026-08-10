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

let questionTypeSelectorResolve = null;

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

    const existingGrip = left.querySelector('.drag-grip');
    if (existingGrip) existingGrip.remove();

    const grip = document.createElement('span');
    grip.className = 'drag-grip';
    grip.innerHTML = '⋮⋮';
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
      const [moved] = questions.splice(touchDrag.fromIdx, 1);
      questions.splice(toIdx, 0, moved);
      renderQuestions();
    }

    touchDrag.active = false;
    touchDrag.fromIdx = null;
  }, { passive: false });
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
  } else {
    const over = total - max;
    marksInfo.textContent = 'Total: ' + total + ' (exceeds max ' + max + ' by ' + over + ')';
    marksInfo.classList.add('marks-warning');
  }
}

// Question modal for big editor
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

  // Toolbar
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
  toolbar.querySelectorAll('button[title]').forEach(b => b.setAttribute('aria-label', b.getAttribute('title')));

  // Editor
  const editor = document.createElement('div');
  editor.className = 'question-modal-editor content-editable';
  editor.contentEditable = true;
  editor.setAttribute('aria-label', 'Question editor');
  editor.innerHTML = question.text || '';
  modal.appendChild(editor);
  makeImagesResizable(editor);

  // Image upload for modal
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
  modalInsertImageBtn.onclick = () => modalImageInput.click();

  modalImageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      editor.focus();
      insertImageAtCursor(editor, ev.target.result);
    };
    reader.readAsDataURL(file);
    modalImageInput.value = '';
  });

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

  // Modal buttons
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
    question.text = sanitizeHtml(editor.innerHTML);
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

function validateRender() {
  const rendered = questionsContainer.querySelectorAll('.question-card').length;
  if (rendered !== questions.length) {
    console.error('Render regression: expected ' + questions.length + ' question cards, found ' + rendered);
  }
}

// Section helpers
function generateSectionId() {
  return 'sec-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
}

function addSection() {
  if (!currentSectionId && sections.length) currentSectionId = sections[0].id;
  const activeIndex = Math.max(0, sections.findIndex(s => s.id === currentSectionId));
  const nextLetter = String.fromCharCode(65 + sections.length);
  const newSection = {
    id: generateSectionId(),
    name: 'SECTION ' + nextLetter,
    type: 'Multiple Choice',
    instructions: '',
    collapsed: false,
    questionIds: []
  };
  sections.splice(activeIndex + 1, 0, newSection);
  currentSectionId = newSection.id;
  renderQuestions();
  debouncedSave();
}

function moveSection(id, direction) {
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
  const idx = sections.findIndex(s => s.id === id);
  if (idx < 0) return;
  if (sections.length <= 1) return;
  const target = sections[idx - 1] || sections[idx + 1];
  const removed = sections.splice(idx, 1)[0];
  questions.forEach(q => {
    if (q.sectionId === removed.id) q.sectionId = target.id;
  });
  if (currentSectionId === removed.id) currentSectionId = target.id;
  renderQuestions();
  debouncedSave();
}

function createSectionHeader(section) {
  const header = document.createElement('div');
  header.className = 'section-header';
  header.dataset.sectionId = section.id;

  const printInfo = document.createElement('div');
  printInfo.className = 'section-print';
  printInfo.innerHTML = '<div class="section-print-name">' + (section.name || '') + '</div>' +
    '<div class="section-print-meta">Type: ' + (section.type || '') +
    (section.instructions ? ' | ' + section.instructions : '') + '</div>';

  const controls = document.createElement('div');
  controls.className = 'section-controls';

  const collapseToggle = document.createElement('span');
  collapseToggle.className = 'section-collapse-toggle';
  collapseToggle.textContent = section.collapsed ? '▲' : '▼';
  collapseToggle.setAttribute('aria-label', section.collapsed ? 'Expand section' : 'Collapse section');

  const top = document.createElement('div');
  top.className = 'section-controls-top';

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'section-name-input';
  nameInput.value = section.name || '';
  nameInput.placeholder = 'Section name';
  nameInput.oninput = e => { section.name = e.target.value; };

  const typeSelect = document.createElement('select');
  typeSelect.className = 'section-type-select';
  ['Multiple Choice', 'Short Answer', 'Long Answer', 'Fill in the Blanks', 'True/False', 'Match the Following'].forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    if (section.type === t) opt.selected = true;
    typeSelect.appendChild(opt);
  });
  typeSelect.onchange = e => { section.type = e.target.value; };

  const instructions = document.createElement('textarea');
  instructions.className = 'section-instructions';
  instructions.placeholder = 'Instructions for this section...';
  instructions.value = section.instructions || '';
  instructions.oninput = e => { section.instructions = e.target.value; };

  top.appendChild(nameInput);
  top.appendChild(typeSelect);

  const actions = document.createElement('div');
  actions.className = 'section-actions';

  const addQBtn = document.createElement('button');
  addQBtn.type = 'button';
  addQBtn.className = 'section-action-btn';
  addQBtn.textContent = '+ Add Question';
  addQBtn.title = 'Add question to this section';
  addQBtn.onclick = (e) => {
    e.stopPropagation();
    addQuestionOfSelectedType(section.id);
  };

  const upBtn = document.createElement('button');
  upBtn.type = 'button';
  upBtn.className = 'section-action-btn';
  upBtn.textContent = '↑';
  upBtn.title = 'Move section up';
  upBtn.onclick = (e) => { e.stopPropagation(); moveSection(section.id, 'up'); };

  const downBtn = document.createElement('button');
  downBtn.type = 'button';
  downBtn.className = 'section-action-btn';
  downBtn.textContent = '↓';
  downBtn.title = 'Move section down';
  downBtn.onclick = (e) => { e.stopPropagation(); moveSection(section.id, 'down'); };

  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'section-action-btn section-delete-btn';
  delBtn.textContent = '×';
  delBtn.title = 'Delete section';
  delBtn.onclick = (e) => { e.stopPropagation(); deleteSection(section.id); };


  actions.appendChild(addQBtn);
  actions.appendChild(upBtn);
  actions.appendChild(downBtn);
  actions.appendChild(delBtn);

  controls.appendChild(top);
  controls.appendChild(instructions);
  controls.appendChild(actions);

  header.appendChild(printInfo);
  header.appendChild(collapseToggle);
  header.appendChild(controls);

  header.addEventListener('click', (e) => {
    if (e.target.closest('input, select, textarea, button')) return;
    section.collapsed = !section.collapsed;
    renderQuestions();
    debouncedSave();
  });

  return header;
}

// Main renderer
function renderQuestions() {
  questionsContainer.innerHTML = '';
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

    questions.forEach((q, idx) => {
      const belongsToSection = q.sectionId === section.id || (sectionIndex === 0 && !validSectionIds.has(q.sectionId));
      if (!belongsToSection) return;

      const displayIndex = globalQuestionCount++;
      const card = document.createElement('div');
      card.className = 'question-card';
      card.dataset.questionIndex = String(idx);

      const header = document.createElement('div');
      header.className = 'question-header';

      const left = document.createElement('div');
      const qLabelText = 'Q' + displayIndex;

    const qLabelSpan = document.createElement('span');
    qLabelSpan.className = 'q-label';
    qLabelSpan.textContent = qLabelText + '.';

    const typeBadge = document.createElement('span');
    typeBadge.className = 'question-type-badge';
    typeBadge.textContent = getQuestionTypeLabel(q.type || 'multiple');

    const expandBtn = document.createElement('img');
    expandBtn.src = 'expand.svg';
    expandBtn.alt = 'Expand question';
    expandBtn.className = 'expand-icon';
    expandBtn.onclick = () => openQuestionModal(q, displayIndex - 1);

    left.appendChild(qLabelSpan);
    left.appendChild(typeBadge);
    left.appendChild(expandBtn);
    header.appendChild(left);

    const right = document.createElement('div');
    right.className = 'question-header-right';

    const marksWrap = document.createElement('span');
    marksWrap.innerHTML =
      'Marks: <input type="number" min="0" class="marks-input" value="' + (q.marks || 0) + '">';
    right.appendChild(marksWrap);

    const actions = document.createElement('div');
    actions.className = 'question-actions';
    const delBtn = document.createElement('button');
    delBtn.innerHTML = '<img src="delete.svg" alt="Delete">';
    delBtn.title = 'Delete question';
    delBtn.setAttribute('aria-label', 'Delete question');
    delBtn.onclick = async () => {
      const ok = await showConfirm('Are you sure you want to delete "' + qLabelText + '" ?');
      if (!ok) return;
      questions = questions.filter(qq => qq.id !== q.id);
      renderQuestions();
    };
    actions.appendChild(delBtn);
    right.appendChild(actions);
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

    const contentEditable = document.createElement('div');
    contentEditable.className = 'question-text content-editable';
    contentEditable.contentEditable = true;
    contentEditable.setAttribute('aria-label', 'Question text');
    contentEditable.innerHTML = q.text || '';
    editorWrap.appendChild(contentEditable);
    card.appendChild(editorWrap);
    makeImagesResizable(contentEditable);

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
        removeBtn.innerHTML = '<img src="delete.svg" alt="Delete option">';
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
        delBlankBtn.innerHTML = '<img src="delete.svg" alt="Remove blank">';
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
        removeBtn.innerHTML = '<img src="delete.svg" alt="Delete option">';
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
        delBtn.innerHTML = '<img src="delete.svg" alt="Remove pair">';
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
        delSqBtn.innerHTML = '<img src="delete.svg" alt="Delete sub-question">';
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
            rem.innerHTML = '<img src="delete.svg" alt="Remove option">';
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

    const printQuestionLine = document.createElement('div');
    printQuestionLine.className = 'print-question-line';

    const qNum = document.createElement('strong');
    qNum.className = 'print-q-number';
    qNum.textContent = 'Q' + displayIndex + '. ';

    const printText = document.createElement('span');
    printText.className = 'print-question-text';
    printText.innerHTML = q.text || '';

    const marksSpan = document.createElement('span');
    marksSpan.className = 'print-marks';
    const m = Number(q.marks) || 0;
    marksSpan.textContent = '(' + m + ' Mark' + (m === 1 ? '' : 's') + ')';

    printQuestionLine.appendChild(qNum);
    printQuestionLine.appendChild(printText);
    printQuestionLine.appendChild(marksSpan);
    printPreview.appendChild(printQuestionLine);

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
      blanks.forEach((b, i) => {
        const line = document.createElement('div');
        line.className = 'print-blank-line';
        line.textContent = '_______';
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
      pairs.forEach((p, i) => {
        const lRow = document.createElement('div');
        lRow.className = 'print-match-row';
        lRow.textContent = (i + 1) + '. ' + (p.left || '');
        leftCol.appendChild(lRow);
        const rRow = document.createElement('div');
        rRow.className = 'print-match-row';
        const rText = document.createElement('span');
        rText.textContent = (p.right || '');
        const spacer = document.createElement('span');
        spacer.className = 'print-match-spacer';
        rRow.appendChild(spacer);
        rRow.appendChild(rText);
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
    questionsContainer.appendChild(sectionCard);
  });

  updateTotalMarks();
  makeDraggable();
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
