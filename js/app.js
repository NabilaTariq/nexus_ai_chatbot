/**
 * Main Application Orchestrator - Nexus AI
 * Palette: Navy (#1F2A44), Warm Beige (#E8DCC8), Soft Gold (#C6A75E)
 */

import { UI } from './ui.js';
import { ChatEngine } from './chat.js';
import { Auth } from './auth.js';

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Initialize Theme from local storage or defaults
  UI.initTheme();

  // 2. Initialize Authentication State
  await Auth.init();

  // 3. Initialize Chat Engine
  await ChatEngine.init();

  // 4. Bind Global Navigation & Modal Triggers
  bindGlobalEvents();
  bindAuthEvents();

  console.log('✨ Nexus AI frontend initialized with Executive Burgundy & Cream palette.');
});

function bindAuthEvents() {
  const authModal = document.getElementById('authModal');
  const btnCloseAuthModal = document.getElementById('btnCloseAuthModal');
  const authTabLogin = document.getElementById('authTabLogin');
  const authTabSignup = document.getElementById('authTabSignup');
  const authFullNameGroup = document.getElementById('authFullNameGroup');
  const authForm = document.getElementById('authForm');
  const authTogglePromptLink = document.getElementById('authTogglePromptLink');
  const authToggleText = document.getElementById('authToggleText');
  const btnAuthSubmit = document.getElementById('btnAuthSubmit');
  const userProfileCard = document.getElementById('userProfileCard');
  const btnLogoutSidebar = document.getElementById('btnLogoutSidebar');
  const btnLogoutSettings = document.getElementById('btnLogoutSettings');

  // Open auth modal when guest clicks profile card
  if (userProfileCard) {
    userProfileCard.addEventListener('click', () => {
      if (!Auth.isAuthenticated()) {
        Auth.openAuthModal('Sign in to Nexus AI to save and access your conversations across devices.');
      }
    });
  }

  // Close auth modal
  if (btnCloseAuthModal) {
    btnCloseAuthModal.addEventListener('click', () => Auth.closeAuthModal());
  }

  // Set Auth Mode helper
  function setAuthMode(mode) {
    if (!authModal) return;
    authModal.dataset.mode = mode;
    Auth.hideAuthError();

    if (mode === 'signup') {
      if (authTabSignup) authTabSignup.classList.add('active');
      if (authTabLogin) authTabLogin.classList.remove('active');
      if (authFullNameGroup) authFullNameGroup.classList.remove('hidden');
      if (btnAuthSubmit) btnAuthSubmit.textContent = 'Create Nexus AI Account';
      if (authToggleText) authToggleText.textContent = 'Already have an account?';
      if (authTogglePromptLink) authTogglePromptLink.textContent = 'Sign In';
    } else {
      if (authTabLogin) authTabLogin.classList.add('active');
      if (authTabSignup) authTabSignup.classList.remove('active');
      if (authFullNameGroup) authFullNameGroup.classList.add('hidden');
      if (btnAuthSubmit) btnAuthSubmit.textContent = 'Sign In to Nexus AI';
      if (authToggleText) authToggleText.textContent = "Don't have an account?";
      if (authTogglePromptLink) authTogglePromptLink.textContent = 'Create Account';
    }
  }

  if (authTabLogin) {
    authTabLogin.addEventListener('click', () => setAuthMode('login'));
  }
  if (authTabSignup) {
    authTabSignup.addEventListener('click', () => setAuthMode('signup'));
  }
  if (authTogglePromptLink) {
    authTogglePromptLink.addEventListener('click', (e) => {
      e.preventDefault();
      const currentMode = authModal?.dataset.mode || 'login';
      setAuthMode(currentMode === 'login' ? 'signup' : 'login');
    });
  }

  // Auth Form Submit
  if (authForm) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('authEmail')?.value.trim();
      const password = document.getElementById('authPassword')?.value;
      const fullName = document.getElementById('authFullName')?.value.trim();
      const mode = authModal?.dataset.mode || 'login';

      if (!email || !password) {
        Auth.showAuthError('Please enter your email and password.');
        return;
      }

      if (password.length < 6) {
        Auth.showAuthError('Password must be at least 6 characters long.');
        return;
      }

      if (mode === 'signup') {
        await Auth.signup(email, password, fullName);
      } else {
        await Auth.login(email, password);
      }
    });
  }

  // Logout buttons
  if (btnLogoutSidebar) {
    btnLogoutSidebar.addEventListener('click', (e) => {
      e.stopPropagation();
      Auth.logout();
    });
  }

  if (btnLogoutSettings) {
    btnLogoutSettings.addEventListener('click', () => {
      Auth.logout();
    });
  }
}

function bindGlobalEvents() {
  // Sidebar Toggle (Hamburger menu)
  const btnToggleSidebar = document.getElementById('btnToggleSidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const btnCloseSidebar = document.getElementById('btnCloseSidebar');

  if (btnToggleSidebar) {
    btnToggleSidebar.addEventListener('click', () => UI.toggleSidebar());
  }
  if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', () => UI.closeSidebar());
  }
  if (btnCloseSidebar) {
    btnCloseSidebar.addEventListener('click', () => UI.closeSidebar());
  }

  // Theme Toggle Button in Header
  const btnThemeToggle = document.getElementById('btnThemeToggle');
  if (btnThemeToggle) {
    btnThemeToggle.addEventListener('click', () => UI.toggleTheme());
  }

  // Settings Modal Open / Close
  const btnOpenSettings = document.getElementById('btnOpenSettings');
  const btnCloseSettings = document.getElementById('btnCloseSettings');
  const btnCancelSettings = document.getElementById('btnCancelSettings');
  const btnSaveSettings = document.getElementById('btnSaveSettings');
  const settingsModal = document.getElementById('settingsModal');

  if (btnOpenSettings) {
    btnOpenSettings.addEventListener('click', () => {
      UI.openModal('settingsModal');
      UI.closeSidebar();
    });
  }

  if (btnCloseSettings) {
    btnCloseSettings.addEventListener('click', () => UI.closeModal('settingsModal'));
  }
  if (btnCancelSettings) {
    btnCancelSettings.addEventListener('click', () => UI.closeModal('settingsModal'));
  }
  if (btnSaveSettings) {
    btnSaveSettings.addEventListener('click', () => {
      UI.closeModal('settingsModal');
      UI.showToast('Settings saved successfully');
    });
  }

  // Theme buttons in Settings modal
  document.querySelectorAll('.theme-opt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = btn.dataset.theme;
      UI.setTheme(theme);
    });
  });

  // Clear all chats button in Settings
  const btnClearAllHistory = document.getElementById('btnClearAllHistory');
  if (btnClearAllHistory) {
    btnClearAllHistory.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear all conversation history?')) {
        ChatEngine.conversations = [];
        ChatEngine.renderSidebarHistory();
        ChatEngine.startNewChat();
        UI.closeModal('settingsModal');
        UI.showToast('All conversation history cleared');
      }
    });
  }

  // Close modals when clicking backdrop
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        backdrop.classList.remove('active');
      }
    });
  });

  // Global Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    // Escape to close open modal / sidebar
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop.active').forEach(m => m.classList.remove('active'));
      UI.closeSidebar();
    }

    // Ctrl + N or Cmd + N for New Chat (prevent default browser new window)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      ChatEngine.startNewChat();
    }

    // '/' or Ctrl + K to focus composer (if not typing in input)
    if ((e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) && document.activeElement.tagName !== 'TEXTAREA' && document.activeElement.tagName !== 'INPUT') {
      e.preventDefault();
      const composer = document.getElementById('composerTextarea');
      if (composer) {
        composer.focus();
      }
    }
  });
}
