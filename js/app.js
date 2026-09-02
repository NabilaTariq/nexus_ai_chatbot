/**
 * Main Application Orchestrator - Nexus AI
 * Palette: Navy (#1F2A44), Warm Beige (#E8DCC8), Soft Gold (#C6A75E)
 */

import { UI } from './ui.js';
import { ChatEngine } from './chat.js';

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Theme from local storage or defaults
  UI.initTheme();

  // 2. Initialize Chat Engine & Mock History
  ChatEngine.init();

  // 3. Bind Global Navigation & Modal Triggers
  bindGlobalEvents();

  console.log('✨ Nexus AI frontend initialized successfully with Navy & Warm Gold palette.');
});

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
        ChatEngine.chatHistories = [
          { group: "Today", items: [] },
          { group: "Yesterday", items: [] },
          { group: "Previous 7 Days", items: [] }
        ];
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
