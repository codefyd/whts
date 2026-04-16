// ============================================================
// auth.js - Authentication & session management
// ============================================================

const AUTH = {
  /** Check if user is logged in, redirect to login if not */
  async requireAuth() {
    const { data: { session } } = await db.auth.getSession();
    if (!session) {
      window.location.href = 'login.html';
      return null;
    }
    return session.user;
  },

  /** Redirect to dashboard if already logged in */
  async redirectIfAuth() {
    const { data: { session } } = await db.auth.getSession();
    if (session) {
      window.location.href = 'contacts.html';
    }
  },

  /** Sign in with email & password */
  async signIn(email, password) {
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  /** Sign out */
  async signOut() {
    await db.auth.signOut();
    window.location.href = 'login.html';
  },

  /** Get current user (synchronous from cache) */
  async getUser() {
    const { data: { user } } = await db.auth.getUser();
    return user;
  },

  /** Populate sidebar with user info */
  async populateSidebar() {
    const user = await this.getUser();
    if (!user) return;

    const emailEl = document.getElementById('user-email');
    const avatarEl = document.getElementById('user-avatar');

    if (emailEl) emailEl.textContent = user.email;
    if (avatarEl) avatarEl.textContent = user.email?.[0]?.toUpperCase() || 'U';
  },

  /** Mark active nav item based on current page */
  markActivePage() {
    const page = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
      if (item.dataset.page === page) item.classList.add('active');
    });
  }
};

/** Global logout button handler */
function initLogout() {
  const btn = document.getElementById('btn-logout');
  if (btn) btn.addEventListener('click', () => AUTH.signOut());
}

/** Mobile sidebar toggle */
function initMobileSidebar() {
  const hamburger = document.getElementById('hamburger-btn');
  const sidebar   = document.getElementById('sidebar');
  const overlay   = document.getElementById('sidebar-overlay');

  if (!hamburger) return;

  hamburger.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
  });

  overlay?.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
  });
}

window.AUTH = AUTH;
window.initLogout = initLogout;
window.initMobileSidebar = initMobileSidebar;
