// ============================================================
// campaign-view.js - Campaign detail page
// ============================================================

let currentUser = null;
let campaignId  = null;

async function init() {
  renderSidebar();
  renderSidebarOverlay();
  AUTH.markActivePage();
  initLogout();
  initMobileSidebar();

  currentUser = await AUTH.requireAuth();
  if (!currentUser) return;

  await AUTH.populateSidebar();

  campaignId = getQueryParam('id');
  if (!campaignId) {
    showToast('معرّف الحملة غير موجود', 'error');
    window.location.href = 'campaigns.html';
    return;
  }

  await loadCampaignDetails();

  document.getElementById('btn-refresh').addEventListener('click', loadCampaignDetails);
}

async function loadCampaignDetails() {
  showEl('loading-state');
  hideEl('page-content');

  try {
    // Load campaign
    const { data: campaign, error: campErr } = await db
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .eq('user_id', currentUser.id)
      .single();

    if (campErr) throw campErr;

    // Load recipients with contact info
    const { data: recipients, error: recErr } = await db
      .from('campaign_recipients')
      .select(`
        *,
        contacts(name, phone_e164)
      `)
      .eq('campaign_id', campaignId)
      .order('created_at');

    if (recErr) throw recErr;

    renderCampaignInfo(campaign);
    renderRecipients(recipients || []);
    renderStats(recipients || []);
    showEl('page-content');
  } catch (err) {
    showToast('خطأ في تحميل البيانات: ' + err.message, 'error');
  } finally {
    hideEl('loading-state');
  }
}

function renderCampaignInfo(c) {
  document.getElementById('page-title').textContent = c.name;
  document.getElementById('campaign-status-badge').innerHTML = statusBadge(c.status);

  document.getElementById('info-name').textContent     = c.name;
  document.getElementById('info-template').textContent = c.template_name;
  document.getElementById('info-lang').textContent     = c.template_language;
  document.getElementById('info-created').textContent  = formatDateTime(c.created_at);
  document.getElementById('info-launched').textContent = c.launched_at ? formatDateTime(c.launched_at) : '—';

  const audienceMap = { all: 'جميع جهات الاتصال', tag: 'حسب وسم', manual: 'اختيار يدوي' };
  document.getElementById('info-audience').textContent =
    (audienceMap[c.audience_type] || c.audience_type || '—') +
    (c.audience_tags?.length ? ` (${c.audience_tags.join(', ')})` : '');
}

function renderStats(recipients) {
  const count = (s) => recipients.filter(r => r.status === s).length;

  const queued    = count('queued');
  const sent      = count('sent');
  const delivered = count('delivered');
  const read      = count('read');
  const failed    = count('failed');
  const total     = recipients.length;
  const deliveredTotal = delivered + read;
  const pct = total > 0 ? Math.round((deliveredTotal / total) * 100) : 0;

  document.getElementById('s-queued').textContent    = queued;
  document.getElementById('s-sent').textContent      = sent;
  document.getElementById('s-delivered').textContent = delivered;
  document.getElementById('s-read').textContent      = read;
  document.getElementById('s-failed').textContent    = failed;

  document.getElementById('delivery-pct').textContent = pct + '%';
  document.getElementById('delivery-bar').style.width  = pct + '%';
  document.getElementById('recipients-count').textContent = total;
}

function renderRecipients(recipients) {
  const tbody = document.getElementById('recipients-tbody');

  if (recipients.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-muted" style="padding:32px;">لا توجد بيانات</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = recipients.map(r => `
    <tr>
      <td style="font-weight:600;">${escHtml(r.contacts?.name || '—')}</td>
      <td dir="ltr" style="font-family:monospace;font-size:13px;">${escHtml(r.contacts?.phone_e164 || '—')}</td>
      <td>${statusBadge(r.status)}</td>
      <td class="text-sm text-muted">${r.sent_at      ? formatDateTime(r.sent_at)      : '—'}</td>
      <td class="text-sm text-muted">${r.delivered_at ? formatDateTime(r.delivered_at) : '—'}</td>
      <td class="text-sm text-muted">${r.read_at      ? formatDateTime(r.read_at)      : '—'}</td>
      <td class="text-sm" style="color:var(--danger);">${r.error_message ? escHtml(r.error_message) : '—'}</td>
    </tr>
  `).join('');
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

init();
