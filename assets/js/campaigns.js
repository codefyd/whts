// ============================================================
// campaigns.js - Campaigns page logic
// ============================================================

let currentUser = null;
let allContacts = [];
let allCampaigns = [];
let selectedAudienceType = 'all';

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
  await loadCampaigns();
  await loadContacts();
  bindEvents();
}

// ---- Load Campaigns ---- //

async function loadCampaigns() {
  showEl('loading-state');
  hideEl('campaigns-list');
  hideEl('empty-state');

  try {
    const { data, error } = await db
      .from('campaigns')
      .select(`
        *,
        campaign_recipients(status)
      `)
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    allCampaigns = data || [];
    renderCampaigns(allCampaigns);
    updateStats(allCampaigns);
  } catch (err) {
    showToast('خطأ في تحميل الحملات: ' + err.message, 'error');
  } finally {
    hideEl('loading-state');
  }
}

function renderCampaigns(campaigns) {
  const list = document.getElementById('campaigns-list');

  if (campaigns.length === 0) {
    showEl('empty-state');
    hideEl('campaigns-list');
    return;
  }

  showEl('campaigns-list');
  hideEl('empty-state');

  list.innerHTML = campaigns.map(c => {
    const recipients = c.campaign_recipients || [];
    const total      = recipients.length;
    const sent       = recipients.filter(r => ['sent','delivered','read'].includes(r.status)).length;
    const delivered  = recipients.filter(r => ['delivered','read'].includes(r.status)).length;
    const read       = recipients.filter(r => r.status === 'read').length;
    const failed     = recipients.filter(r => r.status === 'failed').length;
    const deliverPct = total > 0 ? Math.round((delivered / total) * 100) : 0;

    return `
      <div class="campaign-card" onclick="viewCampaign('${c.id}')">
        <div class="flex gap-12" style="align-items:flex-start;">
          <div style="flex:1;">
            <div class="campaign-name">${escHtml(c.name)}</div>
            <div class="text-sm text-muted">
              📋 ${escHtml(c.template_name)} &nbsp;·&nbsp; 🌐 ${escHtml(c.template_language)}
              &nbsp;·&nbsp; ${formatDate(c.created_at)}
            </div>
          </div>
          <div>${statusBadge(c.status)}</div>
        </div>

        ${total > 0 ? `
          <div style="margin-top:12px;">
            <div class="progress-bar" style="margin-bottom:8px;">
              <div class="progress-fill" style="width:${deliverPct}%;"></div>
            </div>
            <div class="campaign-stats">
              <span class="campaign-stat">📤 مُرسل: <strong>${sent}</strong></span>
              <span class="campaign-stat">✅ مُسلَّم: <strong>${delivered}</strong></span>
              <span class="campaign-stat">👁️ مقروء: <strong>${read}</strong></span>
              <span class="campaign-stat">❌ فشل: <strong>${failed}</strong></span>
              <span class="campaign-stat">👥 الإجمالي: <strong>${total}</strong></span>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

function updateStats(campaigns) {
  document.getElementById('stat-total').textContent     = campaigns.length;
  document.getElementById('stat-completed').textContent = campaigns.filter(c => c.status === 'completed').length;
  document.getElementById('stat-active').textContent    = campaigns.filter(c => ['launching','active'].includes(c.status)).length;
  document.getElementById('stat-draft').textContent     = campaigns.filter(c => c.status === 'draft').length;
}

// ---- Load Contacts for Modal ---- //

async function loadContacts() {
  try {
    const { data, error } = await db
      .from('contacts')
      .select('id, name, phone_e164, tags, opt_in_status')
      .eq('user_id', currentUser.id)
      .eq('opt_in_status', 'subscribed')
      .order('name');

    if (error) throw error;
    allContacts = data || [];

    // Populate tag selector
    const allTags = new Set(allContacts.flatMap(c => c.tags || []));
    const tagSelect = document.getElementById('audience-tag');
    tagSelect.innerHTML = '<option value="">-- اختر وسمًا --</option>' +
      [...allTags].map(t => `<option value="${t}">${t}</option>`).join('');

    // Populate checklist
    renderContactsChecklist(allContacts);
  } catch (err) {
    console.error('Error loading contacts:', err);
  }
}

function renderContactsChecklist(contacts) {
  const list = document.getElementById('contacts-checklist');
  if (contacts.length === 0) {
    list.innerHTML = '<p class="text-sm text-muted" style="padding:8px;">لا توجد جهات اتصال مشتركة</p>';
    return;
  }
  list.innerHTML = contacts.map(c => `
    <label class="checkbox-label" style="padding:6px 4px;border-bottom:1px solid var(--border);">
      <input type="checkbox" class="contact-check" value="${c.id}" />
      <span>${escHtml(c.name)}</span>
      <span class="text-muted text-xs" dir="ltr">${c.phone_e164}</span>
    </label>
  `).join('');
}

// ---- Audience Selector ---- //

function selectAudience(type, el) {
  selectedAudienceType = type;
  document.querySelectorAll('.audience-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');

  hideEl('tag-selector');
  hideEl('manual-selector');

  if (type === 'tag')    showEl('tag-selector');
  if (type === 'manual') showEl('manual-selector');

  updateAudiencePreview();
}

function updateAudiencePreview() {
  const previewEl = document.getElementById('audience-preview-text');

  if (selectedAudienceType === 'all') {
    previewEl.textContent = `سيتم الإرسال لجميع جهات الاتصال المشتركة (${allContacts.length} جهة)`;
  } else if (selectedAudienceType === 'tag') {
    const tag = document.getElementById('audience-tag').value;
    if (tag) {
      const count = allContacts.filter(c => (c.tags || []).includes(tag)).length;
      previewEl.textContent = `سيتم الإرسال لجهات الاتصال بوسم "${tag}" (${count} جهة)`;
    } else {
      previewEl.textContent = 'اختر وسمًا لمعرفة العدد';
    }
  } else if (selectedAudienceType === 'manual') {
    const checked = document.querySelectorAll('.contact-check:checked').length;
    previewEl.textContent = `تم اختيار ${checked} جهة اتصال`;
  }
}

// ---- Modal ---- //

function openNewCampaignModal() {
  document.getElementById('campaign-name').value = '';
  document.getElementById('template-name').value = '';
  document.getElementById('template-lang').value = 'ar';

  selectedAudienceType = 'all';
  document.querySelectorAll('.audience-option').forEach(o => o.classList.remove('selected'));
  document.querySelector('[data-type="all"]').classList.add('selected');
  hideEl('tag-selector');
  hideEl('manual-selector');
  updateAudiencePreview();

  document.getElementById('campaign-modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('campaign-modal').classList.add('hidden');
}

// ---- Build Recipients List ---- //

function getSelectedContactIds() {
  if (selectedAudienceType === 'all') {
    return allContacts.map(c => c.id);
  }

  if (selectedAudienceType === 'tag') {
    const tag = document.getElementById('audience-tag').value;
    if (!tag) return [];
    return allContacts.filter(c => (c.tags || []).includes(tag)).map(c => c.id);
  }

  if (selectedAudienceType === 'manual') {
    return [...document.querySelectorAll('.contact-check:checked')].map(el => el.value);
  }

  return [];
}

// ---- Save / Launch Campaign ---- //

async function saveCampaign(launch = false) {
  const name     = document.getElementById('campaign-name').value.trim();
  const template = document.getElementById('template-name').value.trim();
  const lang     = document.getElementById('template-lang').value;

  if (!name || !template) {
    showToast('اسم الحملة والقالب حقول مطلوبة', 'error');
    return;
  }

  const contactIds = getSelectedContactIds();

  if (launch && contactIds.length === 0) {
    showToast('لا توجد جهات اتصال مؤهلة للإرسال', 'error');
    return;
  }

  const btnId = launch ? 'btn-launch-campaign' : 'btn-save-draft';
  setLoading(btnId, true, launch ? 'جارٍ الإطلاق...' : 'جارٍ الحفظ...');

  try {
    // 1. Create campaign
    const { data: campaign, error: campErr } = await db
      .from('campaigns')
      .insert({
        user_id:           currentUser.id,
        name,
        template_name:     template,
        template_language: lang,
        status:            launch ? 'launching' : 'draft',
        audience_type:     selectedAudienceType,
        audience_tags:     selectedAudienceType === 'tag'
          ? [document.getElementById('audience-tag').value]
          : null,
      })
      .select()
      .single();

    if (campErr) throw campErr;

    if (contactIds.length > 0) {
      // 2. Insert recipients
      const recipients = contactIds.map(cid => ({
        campaign_id: campaign.id,
        contact_id:  cid,
        status:      'queued',
      }));

      const { error: recErr } = await db.from('campaign_recipients').insert(recipients);
      if (recErr) throw recErr;
    }

    if (launch) {
      // 3. Trigger Edge Function to send
      const { error: fnErr } = await db.functions.invoke('launch-campaign', {
        body: { campaign_id: campaign.id }
      });

      if (fnErr) {
        showToast('تم إنشاء الحملة لكن حدث خطأ في الإطلاق: ' + fnErr.message, 'error');
      } else {
        showToast('تم إطلاق الحملة بنجاح 🚀', 'success');
      }
    } else {
      showToast('تم حفظ المسودة ✅', 'success');
    }

    closeModal();
    await loadCampaigns();
  } catch (err) {
    showToast('خطأ: ' + err.message, 'error');
  } finally {
    setLoading(btnId, false);
  }
}

function viewCampaign(id) {
  window.location.href = `campaign-view.html?id=${id}`;
}

// ---- Events ---- //

function bindEvents() {
  document.getElementById('btn-new-campaign').addEventListener('click', openNewCampaignModal);
  document.getElementById('btn-add-first')?.addEventListener('click', openNewCampaignModal);
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('btn-cancel').addEventListener('click', closeModal);

  document.getElementById('btn-launch-campaign').addEventListener('click', () => saveCampaign(true));
  document.getElementById('btn-save-draft').addEventListener('click', () => saveCampaign(false));

  document.getElementById('campaign-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });

  document.getElementById('audience-tag')?.addEventListener('change', updateAudiencePreview);
  document.addEventListener('change', (e) => {
    if (e.target.classList.contains('contact-check')) updateAudiencePreview();
  });
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

window.selectAudience = selectAudience;
window.viewCampaign = viewCampaign;

init();
