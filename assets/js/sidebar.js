// ============================================================
// sidebar.js - Shared sidebar HTML injector
// ============================================================

function renderSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  sidebar.innerHTML = `
    <div class="sidebar-logo">
      <div class="logo-icon">💬</div>
      <div class="logo-text">
        واتساب منصة
        <small>لوحة التحكم</small>
      </div>
    </div>

    <nav class="sidebar-nav">
      <span class="nav-section-label">الرئيسية</span>

      <a href="contacts.html" class="nav-item" data-page="contacts.html">
        <span class="nav-icon">👥</span>
        جهات الاتصال
      </a>

      <a href="campaigns.html" class="nav-item" data-page="campaigns.html">
        <span class="nav-icon">📣</span>
        الحملات
      </a>

      <span class="nav-section-label" style="margin-top:8px;">الإعدادات</span>

      <a href="settings.html" class="nav-item" data-page="settings.html">
        <span class="nav-icon">⚙️</span>
        إعدادات الربط
      </a>
    </nav>

    <div class="sidebar-footer">
      <div class="user-info">
        <div class="user-avatar" id="user-avatar">U</div>
        <span class="user-email truncate" id="user-email">...</span>
      </div>
      <button id="btn-logout" class="btn-logout">
        <span>🚪</span> تسجيل الخروج
      </button>
    </div>
  `;
}

// Overlay for mobile
function renderSidebarOverlay() {
  const overlay = document.getElementById('sidebar-overlay');
  if (overlay) return; // already exists

  const div = document.createElement('div');
  div.id = 'sidebar-overlay';
  div.className = 'sidebar-overlay';
  document.body.appendChild(div);
}

window.renderSidebar = renderSidebar;
window.renderSidebarOverlay = renderSidebarOverlay;
