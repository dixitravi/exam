// ===== QUESTIONS.JS =====
// Depends on: questions, questionsContainer, metaFields, marksInfo, maxMarksInput,
// snapTotal, debouncedSave, showConfirm, updateTotalMarks, toggleBottomToolbar (toolbar.js)

// Basic question factory
function createEmptyQuestion() {
  return { id: Date.now() + Math.random(), text: '', marks: 0, options: [] };
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
    let toIdx = null;
    allCards.forEach((c, index) => {
      if (c.classList.contains('drag-over')) {
        toIdx = index;
      }
      c.classList.remove('drag-over');
      c.classList.remove('dragging');
    });

    document.body.classList.remove('dragging-mode');

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

  marksInfo.textContent = 'Total: ' + total;
  snapTotal.textContent = total;

  marksInfo.classList.remove('marks-ok', 'marks-warning');
  marksInfo.style.color = '';

  if (!max || total <= max) {
    marksInfo.classList.add('marks-ok');
  } else {
    marksInfo.classList.add('marks-warning');
    marksInfo.style.color = 'red';
    alert('Total marks (' + total + ') exceed maximum marks (' + max + '). Please correct the marks.');
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

  // Editor
  const editor = document.createElement('div');
  editor.className = 'question-modal-editor content-editable';
  editor.contentEditable = true;
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

// Main renderer
function renderQuestions() {
  questionsContainer.innerHTML = '';
  questions.forEach((q, idx) => {
    const card = document.createElement('div');
    card.className = 'question-card';

    const header = document.createElement('div');
    header.className = 'question-header';

    const left = document.createElement('div');
    const qLabelText = 'Q' + (idx + 1);

    const qLabelSpan = document.createElement('span');
    qLabelSpan.className = 'q-label';
    qLabelSpan.textContent = qLabelText + '.';

    const expandBtn = document.createElement('img');
    expandBtn.src = 'expand.svg';
    expandBtn.alt = 'Expand question';
    expandBtn.className = 'expand-icon';
    expandBtn.onclick = () => openQuestionModal(q, idx);

    left.appendChild(qLabelSpan);
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

    editorWrap.appendChild(toolbar);

    const contentEditable = document.createElement('div');
    contentEditable.className = 'question-text content-editable';
    contentEditable.contentEditable = true;
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

    // Options
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
        const optionLabel = String.fromCharCode(65 + oIdx);
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

    questionsContainer.appendChild(card);
  });

  updateTotalMarks();
  makeDraggable();
  if (typeof toggleBottomToolbar === 'function') {
    toggleBottomToolbar();
  }
}

// Keyboard shortcuts: Alt+Q, Alt+A
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
