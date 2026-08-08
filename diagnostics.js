// ===== DIAGNOSTICS.JS =====
// Reusable developer diagnostics panel.
// Active only when the URL contains ?debug=1 or localStorage 'ved-debug' is '1'.

let logs = [];
let isSetup = false;

function isDebugMode() {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.has('debug') || localStorage.getItem('ved-debug') === '1';
  } catch (e) {
    return false;
  }
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function stringifyArg(arg) {
  try {
    if (arg instanceof Error) {
      return arg.message + (arg.stack ? '\n' + arg.stack : '');
    }
    if (typeof arg === 'object') {
      return JSON.stringify(arg);
    }
    return String(arg);
  } catch (e) {
    return '[unserializable]';
  }
}

function serializeArgs(args) {
  return Array.from(args).map(stringifyArg).join(' ');
}

function updateBadge() {
  const badge = document.getElementById('diagnosticsBadge');
  if (!badge) return;
  badge.textContent = logs.length;
  badge.style.display = logs.length > 0 ? 'flex' : 'none';
}

function addLog(type, message, source, line, col, stack, raw) {
  const entry = {
    type,
    message: message || '',
    source: source || '',
    line: line || '',
    col: col || '',
    stack: stack || '',
    raw: raw || message || '',
    timestamp: new Date().toISOString()
  };
  logs.push(entry);
  updateBadge();
  return entry;
}

function setupCapture() {
  if (isSetup) return;
  isSetup = true;

  window.addEventListener('error', (event) => {
    let stack = '';
    if (event.error && event.error.stack) stack = event.error.stack;
    addLog('error', event.message, event.filename, event.lineno, event.colno, stack);
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    let message = 'Unhandled promise rejection';
    let stack = '';
    if (reason instanceof Error) {
      message = 'Unhandled promise rejection: ' + reason.message;
      stack = reason.stack || '';
    } else if (reason !== undefined) {
      message = 'Unhandled promise rejection: ' + String(reason);
    }
    addLog('error', message, '', '', '', stack);
  });

  const originalError = console.error;
  console.error = function (...args) {
    originalError.apply(console, args);
    const message = serializeArgs(args);
    const errArg = args.find(a => a instanceof Error);
    addLog('error', message, '', '', '', errArg ? errArg.stack : '');
  };

  const originalWarn = console.warn;
  console.warn = function (...args) {
    originalWarn.apply(console, args);
    const message = serializeArgs(args);
    addLog('warning', message, '', '', '', '');
  };
}

function formatReport() {
  return logs.map((log) => {
    const time = new Date(log.timestamp).toISOString();
    const location = log.source
      ? `${log.source}${log.line ? ':' + log.line : ''}${log.col ? ':' + log.col : ''}`
      : 'N/A';
    return `[${log.type.toUpperCase()}] ${time}\nMessage: ${log.message}\nSource: ${location}\nStack:\n${log.stack || 'N/A'}`;
  }).join('\n\n---\n\n');
}

function openPanel() {
  const modal = document.getElementById('diagnosticsModal');
  const list = document.getElementById('diagnosticsList');
  if (!modal || !list) return;

  list.innerHTML = '';
  if (logs.length === 0) {
    list.innerHTML = '<div style="padding:12px;">No errors or warnings captured.</div>';
  } else {
    logs.forEach((log) => {
      const item = document.createElement('div');
      item.className = 'diagnostics-log diagnostics-log-' + log.type;

      const location = log.source
        ? `<div class="diagnostics-log-source">${escapeHtml(log.source)}${log.line ? ':' + log.line : ''}${log.col ? ':' + log.col : ''}</div>`
        : '';
      const stack = log.stack
        ? `<pre class="diagnostics-log-stack">${escapeHtml(log.stack)}</pre>`
        : '';

      item.innerHTML = `
        <div class="diagnostics-log-header">
          <span class="diagnostics-log-type">${log.type.toUpperCase()}</span>
          <span class="diagnostics-log-time">${new Date(log.timestamp).toLocaleTimeString()}</span>
        </div>
        <div class="diagnostics-log-message">${escapeHtml(log.message)}</div>
        ${location}
        ${stack}
      `;
      list.appendChild(item);
    });
  }

  modal.style.display = 'flex';
}

function closePanel() {
  const modal = document.getElementById('diagnosticsModal');
  if (modal) modal.style.display = 'none';
}

function copyDiagnostics() {
  const text = formatReport();
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      alert('Diagnostics copied to clipboard.');
    }).catch(() => {
      fallbackCopy(text);
    });
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
    alert('Diagnostics copied to clipboard.');
  } catch (e) {
    prompt('Copy the diagnostics below:', text);
  }
  document.body.removeChild(textarea);
}

function downloadReport() {
  const data = {
    url: window.location.href,
    userAgent: navigator.userAgent,
    generatedAt: new Date().toISOString(),
    logs
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'diagnostics-report-' + Date.now() + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function clearLog() {
  logs = [];
  updateBadge();
  openPanel();
}

function createUI() {
  if (!isDebugMode()) return;
  if (document.getElementById('diagnosticsBtn')) return;

  const btn = document.createElement('button');
  btn.id = 'diagnosticsBtn';
  btn.className = 'diagnostics-btn';
  btn.title = 'Open Developer Diagnostics';
  btn.innerHTML = 'Dev <span id="diagnosticsBadge" class="diagnostics-badge" style="display:none;">0</span>';
  btn.onclick = openPanel;
  document.body.appendChild(btn);

  const modal = document.createElement('div');
  modal.id = 'diagnosticsModal';
  modal.className = 'diagnostics-modal';
  modal.style.display = 'none';
  modal.innerHTML = `
    <div class="diagnostics-modal-content">
      <div class="diagnostics-modal-header">
        <h3>Developer Diagnostics</h3>
        <button id="diagnosticsClose" class="diagnostics-close" type="button">&times;</button>
      </div>
      <div id="diagnosticsList" class="diagnostics-list"></div>
      <div class="diagnostics-modal-actions">
        <button id="diagnosticsCopy" class="diagnostics-action-btn" type="button">Copy Diagnostics</button>
        <button id="diagnosticsDownload" class="diagnostics-action-btn" type="button">Download Report</button>
        <button id="diagnosticsClear" class="diagnostics-action-btn diagnostics-action-btn-danger" type="button">Clear Log</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('diagnosticsClose').onclick = closePanel;
  document.getElementById('diagnosticsCopy').onclick = copyDiagnostics;
  document.getElementById('diagnosticsDownload').onclick = downloadReport;
  document.getElementById('diagnosticsClear').onclick = clearLog;

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closePanel();
  });

  updateBadge();
}

function initDiagnostics() {
  setupCapture();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createUI);
  } else {
    createUI();
  }
}
