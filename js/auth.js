/**
 * Authentication Service & State Manager for Nexus AI
 * Powered by Supabase Authentication (Email & Password)
 * Palette: Navy (#1F2A44), Warm Beige (#E8DCC8), Soft Gold (#C6A75E)
 */

import { API } from './api.js';
import { UI } from './ui.js';

export const Auth = {
  currentUser: null,
  token: null,
  pendingAction: null,

  /**
   * Initialize Auth state on app load
   */
  async init() {
    this.token = localStorage.getItem('nexus_auth_token') || null;
    const cachedUser = localStorage.getItem('nexus_auth_user');

    if (cachedUser) {
      try {
        this.currentUser = JSON.parse(cachedUser);
      } catch (e) {
        this.currentUser = null;
      }
    }

    this.updateProfileUI();

    // Verify session token with backend if present
    if (this.token) {
      try {
        const res = await API.getMe();
        if (res.success && res.user) {
          this.currentUser = res.user;
          localStorage.setItem('nexus_auth_user', JSON.stringify(res.user));
          this.updateProfileUI();
        } else {
          // Token expired or invalid
          this.clearSession();
          this.updateProfileUI();
        }
      } catch (err) {
        console.warn('Could not verify auth session on boot:', err);
      }
    }
  },

  /**
   * Check if active session is authenticated
   */
  isAuthenticated() {
    return Boolean(this.currentUser && this.token);
  },

  /**
   * Get auth token for API headers
   */
  getToken() {
    return this.token || localStorage.getItem('nexus_auth_token') || null;
  },

  /**
   * Require authentication wrapper.
   * If authenticated -> returns true.
   * If guest -> stores action, prompts Login/Signup modal, and returns false.
   * @param {Function} actionCallback The callback to execute when later authenticated
   */
  requireAuth(actionCallback = null) {
    if (this.isAuthenticated()) {
      return true;
    }

    // Save pending action to resume after login
    this.pendingAction = actionCallback;
    this.openAuthModal('Please login or create an account to start chatting with Nexus AI.');
    return false;
  },

  /**
   * Open the Auth Modal with a custom banner message
   */
  openAuthModal(noticeMessage = 'Please login or create an account to start chatting with Nexus AI.') {
    const noticeElem = document.getElementById('authModalNotice');
    if (noticeElem) {
      noticeElem.textContent = noticeMessage;
    }

    // Reset error box
    this.hideAuthError();
    UI.openModal('authModal');
  },

  /**
   * Close Auth Modal
   */
  closeAuthModal() {
    UI.closeModal('authModal');
    this.hideAuthError();
  },

  /**
   * Show error inside Auth modal
   */
  showAuthError(message) {
    const errorBox = document.getElementById('authModalError');
    if (errorBox) {
      errorBox.textContent = message;
      errorBox.classList.remove('hidden');
    }
  },

  /**
   * Hide error inside Auth modal
   */
  hideAuthError() {
    const errorBox = document.getElementById('authModalError');
    if (errorBox) {
      errorBox.textContent = '';
      errorBox.classList.add('hidden');
    }
  },

  /**
   * Sign In user with Email & Password
   */
  async login(email, password) {
    this.hideAuthError();
    this.setSubmitLoading(true, 'Signing in...');

    const res = await API.login(email, password);
    this.setSubmitLoading(false);

    if (res.success && res.session?.access_token) {
      this.saveSession(res.user, res.session.access_token);
      this.closeAuthModal();
      this.updateProfileUI();
      UI.showToast(`Welcome back, ${this.currentUser.fullName}!`, '✨');

      // Refresh chat engine
      if (window.NexusChatEngine) {
        await window.NexusChatEngine.refreshConversations();
      }

      // Resume pending action if any
      if (typeof this.pendingAction === 'function') {
        const action = this.pendingAction;
        this.pendingAction = null;
        action();
      }
      return true;
    } else {
      this.showAuthError(res.error || 'Failed to sign in. Please verify your credentials.');
      return false;
    }
  },

  /**
   * Sign Up user with Email, Password & Full Name
   */
  async signup(email, password, fullName) {
    this.hideAuthError();
    this.setSubmitLoading(true, 'Creating account...');

    const res = await API.signup(email, password, fullName);
    this.setSubmitLoading(false);

    if (res.success) {
      if (res.session?.access_token) {
        this.saveSession(res.user, res.session.access_token);
        this.closeAuthModal();
        this.updateProfileUI();
        UI.showToast(`Welcome to Nexus AI, ${this.currentUser.fullName}!`, '✨');

        if (window.NexusChatEngine) {
          await window.NexusChatEngine.refreshConversations();
        }

        if (typeof this.pendingAction === 'function') {
          const action = this.pendingAction;
          this.pendingAction = null;
          action();
        }
      } else {
        // Confirmation email might be required
        this.showAuthError('Account created! Please check your email inbox to confirm your account, then sign in.');
      }
      return true;
    } else {
      this.showAuthError(res.error || 'Failed to create account. Please try again.');
      return false;
    }
  },

  /**
   * Sign Out user session
   */
  async logout() {
    try {
      await API.logout();
    } catch (e) {
      // Ignore network errors on logout
    }

    this.clearSession();
    this.updateProfileUI();

    if (window.NexusChatEngine) {
      window.NexusChatEngine.activeChatId = null;
      window.NexusChatEngine.activeMessages = [];
      window.NexusChatEngine.conversations = [];
      window.NexusChatEngine.renderSidebarHistory();
      window.NexusChatEngine.startNewChat();
    }

    UI.closeModal('settingsModal');
    UI.showToast('Logged out successfully', '👋');
  },

  /**
   * Save session to storage
   */
  saveSession(user, token) {
    this.currentUser = user;
    this.token = token;
    localStorage.setItem('nexus_auth_token', token);
    localStorage.setItem('nexus_auth_user', JSON.stringify(user));
  },

  /**
   * Clear session from storage
   */
  clearSession() {
    this.currentUser = null;
    this.token = null;
    localStorage.removeItem('nexus_auth_token');
    localStorage.removeItem('nexus_auth_user');
  },

  /**
   * Set loading button spinner state in Auth modal
   */
  setSubmitLoading(loading, label = 'Submit') {
    const btnSubmit = document.getElementById('btnAuthSubmit');
    if (!btnSubmit) return;

    btnSubmit.disabled = loading;
    if (loading) {
      btnSubmit.innerHTML = `
        <span class="auth-btn-spinner"></span>
        <span>${label}</span>
      `;
    } else {
      const mode = document.getElementById('authModal')?.dataset.mode || 'login';
      btnSubmit.innerHTML = mode === 'login' ? 'Sign In to Nexus AI' : 'Create Nexus AI Account';
    }
  },

  /**
   * Update Sidebar and Settings UI with real user name, initials and email
   */
  updateProfileUI() {
    const avatarElem = document.getElementById('userAvatarInitials');
    const nameElem = document.getElementById('userProfileName');
    const planElem = document.getElementById('userProfilePlan');
    const btnLogoutSidebar = document.getElementById('btnLogoutSidebar');
    const settingsAccountSection = document.getElementById('settingsAccountSection');

    if (this.isAuthenticated()) {
      const name = this.currentUser.fullName || this.currentUser.email.split('@')[0];
      const initials = this.getInitials(name);

      if (avatarElem) avatarElem.textContent = initials;
      if (nameElem) nameElem.textContent = name;
      if (planElem) planElem.textContent = this.currentUser.email || 'Pro Tier';
      if (btnLogoutSidebar) btnLogoutSidebar.classList.remove('hidden');
      if (settingsAccountSection) {
        settingsAccountSection.classList.remove('hidden');
        const settingsEmail = document.getElementById('settingsUserEmail');
        if (settingsEmail) settingsEmail.textContent = this.currentUser.email;
      }
    } else {
      // Guest view
      if (avatarElem) avatarElem.textContent = 'G';
      if (nameElem) nameElem.textContent = 'Guest User';
      if (planElem) planElem.textContent = 'Sign in to save chats';
      if (btnLogoutSidebar) btnLogoutSidebar.classList.add('hidden');
      if (settingsAccountSection) settingsAccountSection.classList.add('hidden');
    }
  },

  /**
   * Helper to derive 2-letter initials from full name
   */
  getInitials(fullName) {
    if (!fullName) return 'AI';
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
};
