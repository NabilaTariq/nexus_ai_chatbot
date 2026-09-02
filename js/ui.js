/**
 * UI Controls, Theme, Modals, and Toasts for Nexus AI
 * Palette: Navy (#1F2A44), Warm Beige (#E8DCC8), Soft Gold (#C6A75E)
 */

export const UI = {
  // Theme Management
  initTheme() {
    const savedTheme = localStorage.getItem('nexus_ai_theme') || 'dark';
    this.setTheme(savedTheme);
  },

  setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('nexus_ai_theme', theme);

    // Update active state in settings modal buttons if open
    document.querySelectorAll('.theme-opt-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === theme);
    });
  },

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    this.setTheme(newTheme);
    this.showToast(`Theme changed to ${newTheme} mode`);
  },

  // Sidebar Controls (Mobile Drawer / Collapse)
  toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const isOpen = sidebar.classList.toggle('open');
    if (overlay) {
      overlay.classList.toggle('active', isOpen);
    }
  },

  closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
  },

  // Auto-resize Textarea
  adjustTextareaHeight(textarea) {
    if (!textarea) return;
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 180);
    textarea.style.height = `${Math.max(newHeight, 24)}px`;
  },

  resetTextareaHeight(textarea) {
    if (!textarea) return;
    textarea.style.height = '24px';
  },

  // Scroll Chat to Bottom (Sentinel anchor + container scroll)
  scrollToBottom(force = false, smooth = true) {
    const scrollContainer = document.getElementById('chatScrollContainer');
    const bottomAnchor = document.getElementById('chatBottomAnchor');
    if (!scrollContainer) return;

    // Check if user is scrolled up reading earlier messages (threshold: 160px)
    const distanceFromBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight;
    const isNearBottom = distanceFromBottom <= 160;

    if (force || isNearBottom) {
      if (bottomAnchor && typeof bottomAnchor.scrollIntoView === 'function') {
        bottomAnchor.scrollIntoView({
          behavior: smooth ? 'smooth' : 'auto',
          block: 'end'
        });
      } else {
        if (smooth) {
          scrollContainer.scrollTo({
            top: scrollContainer.scrollHeight,
            behavior: 'smooth'
          });
        } else {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
      }
    }
  },

  // Toast Notifications
  showToast(message, iconSvg = null) {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast';

    const defaultIcon = `
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
    `;

    toast.innerHTML = `
      ${iconSvg || defaultIcon}
      <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  },

  // Copy to Clipboard with Feedback
  async copyText(text, successMessage = 'Copied to clipboard!') {
    try {
      await navigator.clipboard.writeText(text);
      this.showToast(successMessage);
      return true;
    } catch (err) {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      this.showToast(successMessage);
      return true;
    }
  },

  // Modal Management
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
    }
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
    }
  }
};
