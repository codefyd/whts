// ============================================================
// app.js - Global helpers and utilities
// ============================================================

// ---- Toast Notifications ---- //

const toastContainer = document.createElement('div');
toastContainer.className = 'toast-container';
document.body.appendChild(toastContainer);

function showToast(message, type = 'info', duration = 3500) {
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${icons[type] || ''}</span><span>${message}</span>`;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity .3s';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ---- Query Params ---- //

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

// ---- Date Formatting ---- //

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ar-SA', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return 'الآن';
  if (mins < 60)  return `منذ ${mins} دقيقة`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `منذ ${hrs} ساعة`;
  const days = Math.floor(hrs / 24);
  return `منذ ${days} يوم`;
}

// ---- Status Helpers ---- //

function statusBadge(status) {
  const map = {
    queued:      ['badge-gray',   'في الانتظار'],
    sent:        ['badge-blue',   'مُرسل'],
    delivered:   ['badge-green',  'مُسلَّم'],
    read:        ['badge-purple', 'مقروء'],
    failed:      ['badge-red',    'فشل'],
    draft:       ['badge-gray',   'مسودة'],
    launching:   ['badge-orange', 'جارٍ الإطلاق'],
    active:      ['badge-blue',   'نشط'],
    completed:   ['badge-green',  'مكتمل'],
    subscribed:  ['badge-green',  'مشترك'],
    unsubscribed:['badge-red',    'غير مشترك'],
    pending:     ['badge-orange', 'معلق'],
  };
  const [cls, label] = map[status] || ['badge-gray', status];
  return `<span class="badge ${cls}">${label}</span>`;
}

// ---- DOM Helpers ---- //

function showEl(id)  { const el = document.getElementById(id); if (el) el.classList.remove('hidden'); }
function hideEl(id)  { const el = document.getElementById(id); if (el) el.classList.add('hidden'); }
function toggleEl(id){ const el = document.getElementById(id); if (el) el.classList.toggle('hidden'); }

function setLoading(btnId, loading, text = '') {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  if (loading) {
    btn._originalText = btn.innerHTML;
    btn.innerHTML = `<span class="loading-spinner" style="width:18px;height:18px;border-width:2px;"></span>${text ? ' ' + text : ''}`;
  } else {
    btn.innerHTML = btn._originalText || btn.innerHTML;
  }
}

// ---- Phone Helpers ---- //

function formatPhone(phone) {
  if (!phone) return '';
  // Keep E.164 format visible but readable
  return phone.replace(/(\+\d{3})(\d{2})(\d{3})(\d{4})/, '$1 $2 $3 $4');
}

// ---- Tags Input ---- //

function renderTagsInput(containerId, initialTags = []) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let tags = [...initialTags];

  function render() {
    container.innerHTML = `
      <div class="tags-display flex gap-8" style="flex-wrap:wrap;margin-bottom:8px;">
        ${tags.map((t, i) => `
          <span class="tag-pill">
            ${t}
            <span style="cursor:pointer;margin-right:4px;" data-remove="${i}">×</span>
          </span>
        `).join('')}
      </div>
      <input
        type="text"
        class="form-control form-control-sm"
        placeholder="أضف وسمًا واضغط Enter..."
        id="${containerId}-input"
        style="max-width:220px;"
      />
      <input type="hidden" id="${containerId}-value" value='${JSON.stringify(tags)}' />
    `;

    container.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        tags.splice(parseInt(btn.dataset.remove), 1);
        render();
      });
    });

    const input = document.getElementById(`${containerId}-input`);
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const val = input.value.trim();
        if (val && !tags.includes(val)) {
          tags.push(val);
          render();
        } else {
          input.value = '';
        }
      }
    });
  }

  render();

  return {
    getTags: () => {
      const hidden = document.getElementById(`${containerId}-value`);
      return hidden ? JSON.parse(hidden.value) : tags;
    }
  };
}

// Expose globally
window.showToast = showToast;
window.getQueryParam = getQueryParam;
window.formatDate = formatDate;
window.formatDateTime = formatDateTime;
window.timeAgo = timeAgo;
window.statusBadge = statusBadge;
window.showEl = showEl;
window.hideEl = hideEl;
window.toggleEl = toggleEl;
window.setLoading = setLoading;
window.formatPhone = formatPhone;
window.renderTagsInput = renderTagsInput;
