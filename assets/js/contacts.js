// ============================================================
// contacts.js - Contacts page logic
// ============================================================

let allContacts = [];
let currentUser = null;
let tagsInputRef = null;
let deleteTargetId = null;

// ---- Init ---- //

async function init() {
  renderSidebar();
  renderSidebarOverlay();
  AUTH.markActivePage();
  initLogout();
  initMobileSidebar();

  currentUser = await AUTH.requireAuth();
  if (!currentUser) return;

  await AUTH.populateSidebar();
  await loadContacts();
  bindEvents();
}

// ---- Load Contacts ---- //

async function loadContacts() {
  showEl('loading-state');
  hideEl('table-wrap');
  hideEl('empty-state');

  try {
    const { data, error } = await db
      .from('contacts')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    allContacts = data || [];
    renderContacts(allContacts);
    updateStats(allContacts);
  } catch (err) {
    showToast('خطأ في تحميل جهات الاتصال: ' + err.message, 'error');
  } finally {
    hideEl('loading-state');
  }
}

// ---- Render ---- //

function renderContacts(contacts) {
  const tbody = document.getElementById('contacts-tbody');
  const countEl = document.getElementById('contact-count');

  countEl.textContent = contacts.length;

  if (contacts.length === 0) {
    hideEl('table-wrap');
    showEl('empty-state');
    return;
  }

  showEl('table-wrap');
  hideEl('empty-state');

  tbody.innerHTML = contacts.map(c => `
    <tr>
      <td><input type="checkbox" class="row-check" data-id="${c.id}" /></td>
      <td>
        <div style="font-weight:600;">${escHtml(c.name)}</div>
      </td>
      <td>
        <span dir="ltr" style="font-family:monospace;font-size:13px;">${escHtml(c.phone_e164)}</span>
      </td>
      <td>
        <div class="flex gap-8" style="flex-wrap:wrap;">
          ${(c.tags || []).map(t => `<span class="tag-pill">${escHtml(t)}</span>`).join('') || '<span class="text-muted text-xs">—</span>'}
        </div>
      </td>
      <td>${statusBadge(c.opt_in_status)}</td>
      <td class="text-sm text-muted">${timeAgo(c.last_message_at)}</td>
      <td>
        <div class="flex gap-8">
          <button class="btn btn-ghost btn-icon btn-sm" onclick="openEditModal('${c.id}')" title="تعديل">✏️</button>
          <button class="btn btn-ghost btn-icon btn-sm" onclick="openDeleteModal('${c.id}', '${escHtml(c.name)}')" title="حذف">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function updateStats(contacts) {
  document.getElementById('stat-total').textContent = contacts.length;
  document.getElementById('stat-subscribed').textContent =
    contacts.filter(c => c.opt_in_status === 'subscribed').length;
  document.getElementById('stat-unsub').textContent =
    contacts.filter(c => c.opt_in_status === 'unsubscribed').length;
}

// ---- Search ---- //

function bindSearch() {
  const input = document.getElementById('search-input');
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (!q) {
      renderContacts(allContacts);
      return;
    }
    const filtered = allContacts.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.phone_e164.includes(q) ||
      (c.tags || []).some(t => t.toLowerCase().includes(q))
    );
    renderContacts(filtered);
  });
}

// ---- Modal ---- //

function openAddModal() {
  document.getElementById('contact-id').value   = '';
  document.getElementById('contact-name').value  = '';
  document.getElementById('contact-phone').value = '';
  document.getElementById('contact-notes').value = '';
  document.getElementById('contact-status').value = 'subscribed';
  document.getElementById('modal-title').textContent = 'إضافة جهة اتصال';
  document.getElementById('modal-icon').textContent  = '➕';

  tagsInputRef = renderTagsInput('tags-input-wrap', []);
  showModal('contact-modal');
}

function openEditModal(id) {
  const c = allContacts.find(x => x.id === id);
  if (!c) return;

  document.getElementById('contact-id').value    = c.id;
  document.getElementById('contact-name').value  = c.name;
  document.getElementById('contact-phone').value = c.phone_e164;
  document.getElementById('contact-notes').value = c.notes || '';
  document.getElementById('contact-status').value = c.opt_in_status;
  document.getElementById('modal-title').textContent = 'تعديل جهة الاتصال';
  document.getElementById('modal-icon').textContent  = '✏️';

  tagsInputRef = renderTagsInput('tags-input-wrap', c.tags || []);
  showModal('contact-modal');
}

function openDeleteModal(id, name) {
  deleteTargetId = id;
  document.getElementById('delete-name').textContent = name;
  showModal('delete-modal');
}

function showModal(id)  { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

// ---- Save Contact ---- //

async function saveContact() {
  const id     = document.getElementById('contact-id').value;
  const name   = document.getElementById('contact-name').value.trim();
  const phone  = document.getElementById('contact-phone').value.trim();
  const notes  = document.getElementById('contact-notes').value.trim();
  const status = document.getElementById('contact-status').value;
  const tags   = tagsInputRef ? tagsInputRef.getTags() : [];

  if (!name || !phone) {
    showToast('الاسم والجوال حقول مطلوبة', 'error');
    return;
  }

  // Basic E.164 validation
  if (!/^\+\d{7,15}$/.test(phone)) {
    showToast('صيغة الجوال غير صحيحة — استخدم E.164 مثل +966501234567', 'error');
    return;
  }

  setLoading('btn-save-contact', true, 'جارٍ الحفظ...');

  try {
    const payload = {
      name,
      phone_e164:     phone,
      notes:          notes || null,
      opt_in_status:  status,
      tags,
      user_id:        currentUser.id,
    };

    let error;
    if (id) {
      ({ error } = await db.from('contacts').update(payload).eq('id', id));
    } else {
      ({ error } = await db.from('contacts').insert(payload));
    }

    if (error) throw error;

    showToast(id ? 'تم التحديث بنجاح ✅' : 'تمت الإضافة بنجاح ✅', 'success');
    closeModal('contact-modal');
    await loadContacts();
  } catch (err) {
    const msg = err.code === '23505'
      ? 'هذا الرقم موجود بالفعل'
      : err.message;
    showToast('خطأ: ' + msg, 'error');
  } finally {
    setLoading('btn-save-contact', false);
  }
}

// ---- Delete Contact ---- //

async function deleteContact() {
  if (!deleteTargetId) return;
  setLoading('btn-confirm-delete', true, 'جارٍ الحذف...');

  try {
    const { error } = await db
      .from('contacts')
      .delete()
      .eq('id', deleteTargetId);

    if (error) throw error;

    showToast('تم الحذف بنجاح', 'success');
    closeModal('delete-modal');
    deleteTargetId = null;
    await loadContacts();
  } catch (err) {
    showToast('خطأ في الحذف: ' + err.message, 'error');
  } finally {
    setLoading('btn-confirm-delete', false);
  }
}

// ---- Event Binding ---- //

function bindEvents() {
  document.getElementById('btn-add-contact').addEventListener('click', openAddModal);
  document.getElementById('btn-add-first')?.addEventListener('click', openAddModal);

  document.getElementById('btn-save-contact').addEventListener('click', saveContact);
  document.getElementById('modal-close').addEventListener('click', () => closeModal('contact-modal'));
  document.getElementById('btn-cancel').addEventListener('click', () => closeModal('contact-modal'));

  document.getElementById('btn-confirm-delete').addEventListener('click', deleteContact);
  document.getElementById('delete-modal-close').addEventListener('click', () => closeModal('delete-modal'));
  document.getElementById('btn-cancel-delete').addEventListener('click', () => closeModal('delete-modal'));

  // Close modal on overlay click
  document.getElementById('contact-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal('contact-modal');
  });

  document.getElementById('delete-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal('delete-modal');
  });

  bindSearch();
}

// ---- Helper ---- //

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Expose for inline onclick
window.openEditModal = openEditModal;
window.openDeleteModal = openDeleteModal;

// Start
init();
