// ============================================================
// settings.js - Settings page logic
// ============================================================

let currentUser = null;
let settingsId = null;

async function init() {
  renderSidebar();
  renderSidebarOverlay();
  AUTH.markActivePage();
  initLogout();
  initMobileSidebar();

  currentUser = await AUTH.requireAuth();
  if (!currentUser) return;

  await AUTH.populateSidebar();

  // Set webhook URL
  const webhookUrl = `${SUPABASE_URL}/functions/v1/receive-whatsapp-webhook`;
  document.getElementById('webhook-url').value = webhookUrl;

  await loadSettings();
  await loadWebhookLogs();
  bindEvents();
}

// ---- Load Settings ---- //

async function loadSettings() {
  try {
    const { data, error } = await db
      .from('integration_settings')
      .select('*')
      .eq('user_id', currentUser.id)
      .maybeSingle();

    if (error) throw error;

    if (data) {
      settingsId = data.id;
      document.getElementById('business-name').value   = data.business_display_name || '';
      document.getElementById('phone-number-id').value = data.phone_number_id || '';
      document.getElementById('waba-id').value          = data.waba_id || '';
      document.getElementById('api-version').value      = data.api_version || 'v19.0';

      // Webhook status
      updateWebhookStatus(data.webhook_verified, data.last_webhook_at);
    }
  } catch (err) {
    showToast('خطأ في تحميل الإعدادات: ' + err.message, 'error');
  }
}

function updateWebhookStatus(verified, lastAt) {
  const el = document.getElementById('webhook-verified-status');
  const lastEl = document.getElementById('last-webhook');

  el.innerHTML = verified
    ? '<span class="badge badge-green">✅ تم التحقق</span>'
    : '<span class="badge badge-orange">⏳ لم يتم التحقق بعد</span>';

  if (lastAt) lastEl.textContent = formatDateTime(lastAt);
}

// ---- Save Settings ---- //

async function saveSettings() {
  const payload = {
    user_id:              currentUser.id,
    business_display_name: document.getElementById('business-name').value.trim() || null,
    phone_number_id:       document.getElementById('phone-number-id').value.trim() || null,
    waba_id:               document.getElementById('waba-id').value.trim() || null,
    api_version:           document.getElementById('api-version').value,
  };

  setLoading('btn-save-settings', true, 'جارٍ الحفظ...');

  try {
    let error;
    if (settingsId) {
      ({ error } = await db.from('integration_settings').update(payload).eq('id', settingsId));
    } else {
      const result = await db.from('integration_settings').insert(payload).select().single();
      error = result.error;
      if (result.data) settingsId = result.data.id;
    }

    if (error) throw error;
    showToast('تم حفظ الإعدادات ✅', 'success');
  } catch (err) {
    showToast('خطأ في الحفظ: ' + err.message, 'error');
  } finally {
    setLoading('btn-save-settings', false);
  }
}

// ---- Test Connection ---- //

async function testConnection() {
  const phoneNumberId = document.getElementById('phone-number-id').value.trim();

  if (!phoneNumberId) {
    showToast('يرجى إدخال Phone Number ID أولًا', 'error');
    return;
  }

  setLoading('btn-test-connection', true, 'جارٍ الاختبار...');

  try {
    const { data, error } = await db.functions.invoke('send-test-message', {
      body: { test_only: true, phone_number_id: phoneNumberId }
    });

    if (error) throw error;

    if (data?.ok) {
      setConnectionStatus('connected', 'متصل ✅');
      showToast('الاتصال يعمل بشكل صحيح ✅', 'success');
    } else {
      setConnectionStatus('disconnected', 'غير متصل ❌');
      showToast('فشل الاتصال: ' + (data?.error || 'خطأ غير معروف'), 'error');
    }
  } catch (err) {
    setConnectionStatus('disconnected', 'خطأ في الاتصال');
    showToast('خطأ: ' + err.message, 'error');
  } finally {
    setLoading('btn-test-connection', false);
  }
}

function setConnectionStatus(type, label) {
  const box = document.getElementById('connection-status-box');
  const dot = document.getElementById('connection-dot');
  const lbl = document.getElementById('connection-label');

  box.className = `connection-status ${type}`;
  dot.className = `status-dot ${type === 'connected' ? 'green' : 'red'}`;
  lbl.textContent = label;
}

// ---- Send Test Message ---- //

async function sendTestMessage() {
  const phone = document.getElementById('test-phone').value.trim();
  const resultEl = document.getElementById('test-result');

  if (!phone) {
    showToast('يرجى إدخال رقم الجوال', 'error');
    return;
  }

  if (!/^\+\d{7,15}$/.test(phone)) {
    showToast('صيغة الجوال غير صحيحة — استخدم مثل +966501234567', 'error');
    return;
  }

  setLoading('btn-send-test', true, 'جارٍ الإرسال...');
  resultEl.classList.add('hidden');

  try {
    const { data, error } = await db.functions.invoke('send-test-message', {
      body: { phone }
    });

    if (error) throw error;

    if (data?.success) {
      resultEl.className = 'alert alert-success mt-16';
      resultEl.innerHTML = `<span>✅</span><span>تم الإرسال بنجاح! Message ID: <code>${data.message_id || '—'}</code></span>`;
    } else {
      resultEl.className = 'alert alert-error mt-16';
      resultEl.innerHTML = `<span>❌</span><span>فشل الإرسال: ${data?.error || 'خطأ غير معروف'}</span>`;
    }
    resultEl.classList.remove('hidden');
  } catch (err) {
    resultEl.className = 'alert alert-error mt-16';
    resultEl.innerHTML = `<span>❌</span><span>${err.message}</span>`;
    resultEl.classList.remove('hidden');
  } finally {
    setLoading('btn-send-test', false);
  }
}

// ---- Webhook Logs ---- //

async function loadWebhookLogs() {
  const body = document.getElementById('webhook-logs-body');
  showEl('logs-loading');

  try {
    const { data, error } = await db
      .from('webhook_logs')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('received_at', { ascending: false })
      .limit(5);

    if (error) throw error;

    if (!data || data.length === 0) {
      body.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><p>لا توجد سجلات بعد</p></div>`;
      return;
    }

    body.innerHTML = data.map(log => `
      <div style="border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;margin-bottom:10px;">
        <div class="flex gap-12" style="margin-bottom:8px;">
          <span class="badge badge-blue">${log.event_type || 'webhook'}</span>
          <span class="text-sm text-muted">${formatDateTime(log.received_at)}</span>
        </div>
        <pre style="font-size:11px;overflow:auto;max-height:120px;background:var(--surface-2);padding:8px;border-radius:4px;direction:ltr;">${JSON.stringify(log.payload, null, 2)}</pre>
      </div>
    `).join('');
  } catch (err) {
    body.innerHTML = `<div class="alert alert-error">خطأ في تحميل السجلات</div>`;
  } finally {
    hideEl('logs-loading');
  }
}

// ---- Copy Webhook URL ---- //

function copyWebhookUrl() {
  const url = document.getElementById('webhook-url').value;
  navigator.clipboard.writeText(url)
    .then(() => showToast('تم نسخ الرابط ✅', 'success'))
    .catch(() => showToast('تعذّر النسخ', 'error'));
}

// ---- Events ---- //

function bindEvents() {
  document.getElementById('btn-save-settings').addEventListener('click', saveSettings);
  document.getElementById('btn-test-connection').addEventListener('click', testConnection);
  document.getElementById('btn-send-test').addEventListener('click', sendTestMessage);
  document.getElementById('btn-refresh-logs').addEventListener('click', loadWebhookLogs);
}

window.copyWebhookUrl = copyWebhookUrl;
init();
