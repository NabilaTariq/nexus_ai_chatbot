/**
 * Chat State, Supabase Persistent History & Multi-Turn Engine for Nexus AI
 * Palette: Navy (#1F2A44), Warm Beige (#E8DCC8), Soft Gold (#C6A75E)
 */

import { PROMPT_CARDS } from './data.js';
import { renderMarkdown } from './markdown.js';
import { UI } from './ui.js';
import { API } from './api.js';
import { Auth } from './auth.js';

export const ChatEngine = {
  activeChatId: null,
  isGenerating: false,
  attachedFile: null,
  conversations: [], // Flat list of conversation objects: [{ id, title, created_at, updated_at }]
  activeMessages: [], // Messages for current active conversation: [{ id, role, content, created_at }]
  activeDropdownId: null,
  _syncInterval: null,
  _isSyncing: false,
  _lastSyncTime: 0,

  async init() {
    window.NexusChatEngine = this;
    this.renderPromptCards();
    this.bindEvents();
    this.initDropdownHandler();
    this.startRealtimeSync();
    if (Auth.isAuthenticated()) {
      await this.refreshConversations();
    } else {
      this.renderSidebarHistory();
    }
    this.checkStatus();
  },

  async checkStatus() {
    const health = await API.checkHealth();
    if (!health.apiKeyConfigured) {
      console.warn('⚠️ GEMINI_API_KEY is not configured in .env.');
    }
    if (health.supabaseConfigured) {
      console.log('🗄️ Connected to Supabase PostgreSQL Database.');
    } else {
      console.log('ℹ️ Operating with in-memory / local storage mode.');
    }
  },

  /**
   * Lightweight, debounced background sync on tab focus and periodic heartbeat
   */
  startRealtimeSync() {
    const triggerDebouncedSync = () => {
      const now = Date.now();
      if (now - this._lastSyncTime < 2000) return; // Debounce 2s
      if (Auth.isAuthenticated() && !this.isGenerating && !this._isSyncing) {
        this.refreshConversations(true);
      }
    };

    // Auto-sync when user switches back to the tab
    window.addEventListener('focus', triggerDebouncedSync);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        triggerDebouncedSync();
      }
    });

    // Periodic heartbeat sync every 8 seconds
    if (this._syncInterval) clearInterval(this._syncInterval);
    this._syncInterval = setInterval(() => {
      if (Auth.isAuthenticated() && !this.isGenerating && !this._isSyncing && document.visibilityState === 'visible') {
        this.refreshConversations(true);
      }
    }, 8000);
  },

  renderPromptCards() {
    const grid = document.getElementById('promptGrid');
    if (!grid) return;

    grid.innerHTML = PROMPT_CARDS.map(card => `
      <div class="prompt-card" data-prompt="${encodeURIComponent(card.prompt)}">
        <div class="prompt-card-header">
          <div class="prompt-icon">${card.icon}</div>
          <svg class="icon-sm prompt-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </div>
        <div>
          <div class="prompt-card-text">${card.title}</div>
          <div class="prompt-card-desc">${card.desc}</div>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('.prompt-card').forEach(card => {
      card.addEventListener('click', () => {
        const prompt = decodeURIComponent(card.dataset.prompt);
        Auth.requireAuth(() => {
          this.sendMessage(prompt);
        });
      });
    });
  },

  async refreshConversations(isBackgroundSync = false) {
    if (!Auth.isAuthenticated()) {
      this.conversations = [];
      this.renderSidebarHistory();
      return;
    }

    if (this._isSyncing) return;
    this._isSyncing = true;
    this._lastSyncTime = Date.now();

    try {
      const res = await API.getConversations();
      if (res.success && Array.isArray(res.conversations)) {
        const newConversations = res.conversations;
        const currentIds = new Set(newConversations.map(c => c.id));
        const previousIds = new Set(this.conversations.map(c => c.id));

        const hasDeletions = this.conversations.some(c => !currentIds.has(c.id));
        const hasAdditions = newConversations.some(c => !previousIds.has(c.id));
        const hasLengthChange = this.conversations.length !== newConversations.length;

        this.conversations = newConversations;

        // If the active conversation was deleted in Supabase
        if (this.activeChatId && !currentIds.has(this.activeChatId)) {
          console.log(`Active conversation ${this.activeChatId} was deleted in Supabase.`);
          this.activeChatId = null;
          this.activeMessages = [];
          const messageList = document.getElementById('messageList');
          const welcomeScreen = document.getElementById('welcomeScreen');
          const chatTitle = document.getElementById('navbarChatTitle');

          if (messageList) messageList.innerHTML = '';
          if (welcomeScreen) welcomeScreen.classList.remove('hidden');
          if (chatTitle) chatTitle.textContent = 'Nexus 4.0 Pro';

          this.renderSidebarHistory();
          UI.showToast('Active conversation was deleted in database', '🗑️');
          return;
        }

        if (hasDeletions || hasAdditions || hasLengthChange || !isBackgroundSync) {
          this.renderSidebarHistory();
        }
      }
    } catch (e) {
      console.warn('Sync error:', e);
    } finally {
      this._isSyncing = false;
    }
  },

  groupConversationsByDate(conversations) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const oneDay = 24 * 60 * 60 * 1000;

    const groups = {
      Today: [],
      Yesterday: [],
      'Previous 7 Days': [],
      Older: []
    };

    conversations.forEach(conv => {
      const convDate = new Date(conv.updated_at || conv.created_at || now);
      const convDay = new Date(convDate.getFullYear(), convDate.getMonth(), convDate.getDate()).getTime();
      const diffDays = Math.round((today - convDay) / oneDay);

      if (diffDays <= 0) {
        groups.Today.push(conv);
      } else if (diffDays === 1) {
        groups.Yesterday.push(conv);
      } else if (diffDays <= 7) {
        groups['Previous 7 Days'].push(conv);
      } else {
        groups.Older.push(conv);
      }
    });

    return Object.entries(groups)
      .filter(([_, items]) => items.length > 0)
      .map(([group, items]) => ({ group, items }));
  },

  renderSidebarHistory() {
    const historyContainer = document.getElementById('sidebarHistory');
    if (!historyContainer) return;

    if (!this.conversations || this.conversations.length === 0) {
      historyContainer.innerHTML = `
        <div class="sidebar-empty-state">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <span>No conversations yet</span>
        </div>
      `;
      return;
    }

    const grouped = this.groupConversationsByDate(this.conversations);

    historyContainer.innerHTML = grouped.map(group => `
      <div class="history-group">
        <div class="history-group-title">${group.group}</div>
        ${group.items.map(item => `
          <div class="history-item-wrapper" style="position: relative; width: 100%;">
            <button class="history-item ${this.activeChatId === item.id ? 'active' : ''}" data-chat-id="${item.id}">
              <div class="history-item-content">
                <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                <span class="history-item-title">${this.escapeHtml(item.title || 'New Conversation')}</span>
              </div>
              <div class="history-item-actions">
                <span class="history-item-btn btn-open-dropdown" data-chat-id="${item.id}" title="Options">•••</span>
              </div>
            </button>
          </div>
        `).join('')}
      </div>
    `).join('');

    // Attach click listeners to load chat
    historyContainer.querySelectorAll('.history-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        // If clicking the options button, do not load chat
        if (e.target.closest('.btn-open-dropdown')) return;
        const chatId = btn.dataset.chatId;
        this.loadChat(chatId);
      });
    });

    // Attach dropdown menu listeners
    historyContainer.querySelectorAll('.btn-open-dropdown').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const chatId = btn.dataset.chatId;
        this.openContextMenu(chatId, btn);
      });
    });
  },

  openContextMenu(chatId, triggerElement) {
    let dropdown = document.getElementById('historyDropdownMenu');
    if (!dropdown) {
      dropdown = document.createElement('div');
      dropdown.id = 'historyDropdownMenu';
      dropdown.className = 'history-dropdown-menu';
      document.body.appendChild(dropdown);
    }

    this.activeDropdownId = chatId;
    const rect = triggerElement.getBoundingClientRect();

    dropdown.innerHTML = `
      <button class="dropdown-item" id="btnMenuRename">
        <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M12 20h9"></path>
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
        </svg>
        <span>Rename</span>
      </button>
      <button class="dropdown-item danger-item" id="btnMenuDelete">
        <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
        <span>Delete</span>
      </button>
    `;

    dropdown.style.top = `${rect.bottom + 4}px`;
    dropdown.style.left = `${Math.max(10, rect.right - 140)}px`;
    dropdown.classList.add('active');

    // Bind dropdown actions
    document.getElementById('btnMenuRename').addEventListener('click', () => {
      dropdown.classList.remove('active');
      this.promptRenameConversation(chatId);
    });

    document.getElementById('btnMenuDelete').addEventListener('click', () => {
      dropdown.classList.remove('active');
      this.confirmDeleteConversation(chatId);
    });
  },

  initDropdownHandler() {
    document.addEventListener('click', (e) => {
      const dropdown = document.getElementById('historyDropdownMenu');
      if (dropdown && dropdown.classList.contains('active')) {
        if (!dropdown.contains(e.target) && !e.target.closest('.btn-open-dropdown')) {
          dropdown.classList.remove('active');
        }
      }
    });
  },

  async promptRenameConversation(chatId) {
    const conv = this.conversations.find(c => c.id === chatId);
    const currentTitle = conv ? conv.title : 'Conversation';

    const newTitle = prompt('Enter a new title for this conversation:', currentTitle);
    if (!newTitle || newTitle.trim() === '' || newTitle.trim() === currentTitle) {
      return;
    }

    const cleanTitle = newTitle.trim();
    const res = await API.renameConversation(chatId, cleanTitle);

    if (res.success) {
      if (conv) conv.title = cleanTitle;
      this.renderSidebarHistory();
      if (this.activeChatId === chatId) {
        const chatTitle = document.getElementById('navbarChatTitle');
        if (chatTitle) chatTitle.textContent = cleanTitle;
      }
      UI.showToast('Conversation renamed');
    } else {
      UI.showToast('Failed to rename conversation', '⚠️');
    }
  },

  async confirmDeleteConversation(chatId) {
    const conv = this.conversations.find(c => c.id === chatId);
    const title = conv ? conv.title : 'this conversation';

    if (!confirm(`Are you sure you want to permanently delete "${title}"?`)) {
      return;
    }

    const res = await API.deleteConversation(chatId);
    if (res.success) {
      this.conversations = this.conversations.filter(c => c.id !== chatId);
      this.renderSidebarHistory();

      if (this.activeChatId === chatId) {
        this.startNewChat();
      }
      UI.showToast('Conversation deleted');
    } else {
      UI.showToast('Failed to delete conversation', '⚠️');
    }
  },

  startNewChat(force = false) {
    if (!force && !Auth.requireAuth(() => this.startNewChat(true))) {
      return;
    }

    this.activeChatId = null;
    this.activeMessages = [];
    const messageList = document.getElementById('messageList');
    const welcomeScreen = document.getElementById('welcomeScreen');
    const chatTitle = document.getElementById('navbarChatTitle');

    if (messageList) messageList.innerHTML = '';
    if (welcomeScreen) welcomeScreen.classList.remove('hidden');
    if (chatTitle) chatTitle.textContent = 'Nexus 4.0 Pro';

    this.renderSidebarHistory();
    UI.closeSidebar();
    UI.showToast('Started a fresh conversation');
  },

  async loadChat(chatId) {
    if (!Auth.requireAuth(() => this.loadChat(chatId))) {
      return;
    }

    const conv = this.conversations.find(c => c.id === chatId);
    if (!conv) return;

    this.activeChatId = chatId;
    this.renderSidebarHistory();

    const welcomeScreen = document.getElementById('welcomeScreen');
    const messageList = document.getElementById('messageList');
    const chatTitle = document.getElementById('navbarChatTitle');

    if (welcomeScreen) welcomeScreen.classList.add('hidden');
    if (chatTitle) chatTitle.textContent = conv.title || 'Conversation';
    if (messageList) messageList.innerHTML = '';

    // Fetch messages from backend / Supabase
    const res = await API.getConversationMessages(chatId);
    if (res.success && Array.isArray(res.messages)) {
      this.activeMessages = res.messages;
      res.messages.forEach(msg => {
        const content = msg.content || '';
        if (msg.role === 'user') {
          this.appendUserMessage(content, false);
        } else {
          this.appendAssistantMessage(content, false);
        }
      });
    }

    UI.closeSidebar();
    requestAnimationFrame(() => {
      UI.scrollToBottom(true, false);
    });
  },

  async sendMessage(userInputText = null) {
    if (this.isGenerating) {
      console.warn('sendMessage blocked: generation already in progress');
      return;
    }

    const textarea = document.getElementById('composerTextarea');
    const text = (userInputText !== null ? userInputText : (textarea ? textarea.value : '')).trim();

    // 1. Prevent empty submissions
    if (!text && !this.attachedFile) {
      UI.showToast('Please type a message before sending');
      return;
    }

    // Require authentication before proceeding
    if (!Auth.isAuthenticated()) {
      Auth.requireAuth(() => this.sendMessage(text));
      return;
    }

    // Lock immediately
    this.isGenerating = true;
    this.setSendButtonLoading(true);
    if (textarea) textarea.disabled = true;

    // Reset textarea input
    if (textarea) {
      textarea.value = '';
      UI.resetTextareaHeight(textarea);
      this.updateSendButtonState();
    }

    // Hide welcome screen
    const welcomeScreen = document.getElementById('welcomeScreen');
    if (welcomeScreen) welcomeScreen.classList.add('hidden');

    const fullUserText = this.attachedFile ? `📎 [${this.attachedFile.name}]\n${text}` : text;
    this.appendUserMessage(fullUserText);
    this.clearAttachment();
    UI.scrollToBottom(true, true);

    const typingRow = this.showTypingIndicator();
    UI.scrollToBottom(true, true);

    try {
      // Prepare prior context
      const priorContext = this.activeMessages.map(m => ({
        role: m.role,
        content: m.content || ''
      }));

      // Optimistically add user message to active memory
      const tempUserObj = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content: fullUserText,
        created_at: new Date().toISOString()
      };
      this.activeMessages.push(tempUserObj);

      // Dispatch message to backend API (saves to Supabase & queries Gemini)
      const apiResult = await API.sendChatMessage(
        fullUserText,
        this.activeChatId,
        priorContext
      );

      // Remove typing indicator
      if (typingRow) typingRow.remove();

      if (apiResult.success) {
        if (apiResult.conversationId) {
          this.activeChatId = apiResult.conversationId;
        }

        // Stream AI response with typewriter animation
        await this.streamAssistantResponse(apiResult.text);

        // Add assistant message to active memory
        this.activeMessages.push({
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: apiResult.text,
          created_at: new Date().toISOString()
        });

        // Refresh conversations in sidebar
        await this.refreshConversations();

        // If title was auto-generated, update header
        if (apiResult.title) {
          const chatTitle = document.getElementById('navbarChatTitle');
          if (chatTitle) chatTitle.textContent = apiResult.title;
        }
      } else {
        if (apiResult.requiresAuth) {
          Auth.openAuthModal('Please login or create an account to start chatting with Nexus AI.');
        } else {
          this.appendErrorMessage(apiResult.error, apiResult.errorType);
          UI.showToast('Failed to get response from AI', '⚠️');
        }
      }
    } catch (err) {
      console.error('Error during message sending/streaming:', err);
      if (typingRow) typingRow.remove();
      this.appendErrorMessage('An unexpected error occurred while processing your message. Please try again.');
    } finally {
      this.isGenerating = false;
      this.setSendButtonLoading(false);
      if (textarea) {
        textarea.disabled = false;
        textarea.focus();
      }
    }
  },

  appendUserMessage(text, animate = true) {
    const messageList = document.getElementById('messageList');
    if (!messageList) return;

    const row = document.createElement('div');
    row.className = 'message-row user-message-row';
    if (!animate) row.style.animation = 'none';

    row.innerHTML = `
      <div class="message-body">
        <div class="user-message-bubble">${this.escapeHtml(text)}</div>
      </div>
      <div class="message-avatar user-avatar-icon" title="You">
        <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      </div>
    `;

    messageList.appendChild(row);
  },

  showTypingIndicator() {
    const messageList = document.getElementById('messageList');
    if (!messageList) return null;

    const row = document.createElement('div');
    row.className = 'typing-indicator-row';
    row.id = 'activeTypingIndicator';

    row.innerHTML = `
      <div class="message-avatar ai-avatar-icon" title="Nexus AI">
        <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
        </svg>
      </div>
      <div class="typing-bubble">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    `;

    messageList.appendChild(row);
    return row;
  },

  appendAssistantMessage(markdownText, animate = true) {
    const messageList = document.getElementById('messageList');
    if (!messageList) return;

    const row = document.createElement('div');
    row.className = 'message-row assistant-message-row';
    if (!animate) row.style.animation = 'none';

    const renderedHtml = renderMarkdown(markdownText);

    row.innerHTML = `
      <div class="message-avatar ai-avatar-icon" title="Nexus AI">
        <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
        </svg>
      </div>
      <div class="message-body">
        <div class="assistant-message-bubble markdown-content">
          ${renderedHtml}
        </div>
        <div class="message-actions-bar">
          <button class="btn-msg-action btn-copy-msg" title="Copy response">
            <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
          <button class="btn-msg-action btn-like-msg" title="Good response">
            <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
            </svg>
          </button>
          <button class="btn-msg-action btn-dislike-msg" title="Bad response">
            <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"></path>
            </svg>
          </button>
          <button class="btn-msg-action btn-regen-msg" title="Regenerate">
            <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
          </button>
        </div>
      </div>
    `;

    messageList.appendChild(row);
    this.bindMessageRowEvents(row, markdownText);
  },

  appendErrorMessage(errorText, errorType = 'ERROR') {
    const messageList = document.getElementById('messageList');
    if (!messageList) return;

    const row = document.createElement('div');
    row.className = 'message-row assistant-message-row';

    const isApiKeyError = errorType === 'MISSING_API_KEY' || errorText.includes('API_KEY');

    row.innerHTML = `
      <div class="message-avatar ai-avatar-icon" style="border-color: #ef4444; color: #ef4444;">
        <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      </div>
      <div class="message-body">
        <div class="assistant-message-bubble" style="border-color: rgba(239, 68, 68, 0.35); background: rgba(239, 68, 68, 0.08);">
          <div style="color: #f87171; font-weight: 600; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
            <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <span>${isApiKeyError ? 'API Key Configuration Notice' : 'Request Error'}</span>
          </div>
          <div style="color: var(--text-primary); font-size: 0.9rem; line-height: 1.5;">
            ${this.escapeHtml(errorText)}
          </div>
          ${isApiKeyError ? `
            <div style="margin-top: 10px; font-size: 0.8rem; color: var(--text-secondary); background: rgba(0,0,0,0.25); padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-subtle);">
              💡 <strong>How to set your key:</strong><br>
              1. Open <code>.env</code> in the project folder.<br>
              2. Add <code>GEMINI_API_KEY=your_key_here</code>.<br>
              3. Restart the server with <code>npm start</code>.
            </div>
          ` : ''}
        </div>
      </div>
    `;

    messageList.appendChild(row);
    requestAnimationFrame(() => {
      UI.scrollToBottom(true, true);
    });
  },

  async streamAssistantResponse(fullMarkdown) {
    const messageList = document.getElementById('messageList');
    if (!messageList) return;

    const row = document.createElement('div');
    row.className = 'message-row assistant-message-row';

    row.innerHTML = `
      <div class="message-avatar ai-avatar-icon" title="Nexus AI">
        <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
        </svg>
      </div>
      <div class="message-body">
        <div class="assistant-message-bubble markdown-content" id="streamingBubble"></div>
        <div class="message-actions-bar" style="display: none;" id="streamingActions">
          <button class="btn-msg-action btn-copy-msg" title="Copy response">
            <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
          <button class="btn-msg-action btn-like-msg" title="Good response">
            <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
            </svg>
          </button>
          <button class="btn-msg-action btn-dislike-msg" title="Bad response">
            <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"></path>
            </svg>
          </button>
          <button class="btn-msg-action btn-regen-msg" title="Regenerate">
            <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
          </button>
        </div>
      </div>
    `;

    messageList.appendChild(row);
    const bubble = row.querySelector('#streamingBubble');
    const actions = row.querySelector('#streamingActions');

    const words = fullMarkdown.split(' ');
    let currentText = '';
    const chunkSize = 3;

    for (let i = 0; i < words.length; i += chunkSize) {
      currentText += (i === 0 ? '' : ' ') + words.slice(i, i + chunkSize).join(' ');
      bubble.innerHTML = renderMarkdown(currentText);
      UI.scrollToBottom(false, false);
      await new Promise(r => setTimeout(r, 20));
    }

    bubble.innerHTML = renderMarkdown(fullMarkdown);
    if (actions) actions.style.display = 'flex';
    this.bindMessageRowEvents(row, fullMarkdown);
    requestAnimationFrame(() => {
      UI.scrollToBottom(true, true);
    });
  },

  bindMessageRowEvents(row, rawText) {
    row.querySelectorAll('.btn-copy-code').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const code = decodeURIComponent(btn.dataset.code);
        UI.copyText(code, 'Code snippet copied to clipboard');
        const span = btn.querySelector('span');
        if (span) {
          const prev = span.textContent;
          span.textContent = 'Copied!';
          setTimeout(() => span.textContent = prev, 2000);
        }
      });
    });

    const copyBtn = row.querySelector('.btn-copy-msg');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        UI.copyText(rawText, 'Assistant response copied to clipboard');
      });
    }

    const likeBtn = row.querySelector('.btn-like-msg');
    const dislikeBtn = row.querySelector('.btn-dislike-msg');

    if (likeBtn) {
      likeBtn.addEventListener('click', () => {
        likeBtn.classList.toggle('active-liked');
        if (dislikeBtn) dislikeBtn.classList.remove('active-disliked');
        UI.showToast('Thank you for the feedback!');
      });
    }

    if (dislikeBtn) {
      dislikeBtn.addEventListener('click', () => {
        dislikeBtn.classList.toggle('active-disliked');
        if (likeBtn) likeBtn.classList.remove('active-liked');
        UI.showToast('Feedback noted. We will improve!');
      });
    }

    const regenBtn = row.querySelector('.btn-regen-msg');
    if (regenBtn) {
      regenBtn.addEventListener('click', () => {
        if (this.activeMessages.length > 0) {
          const lastUserMsg = [...this.activeMessages].reverse().find(m => m.role === 'user');
          if (lastUserMsg) {
            this.sendMessage(lastUserMsg.content);
          }
        }
      });
    }
  },

  handleAttachment(file) {
    if (!file) return;
    this.attachedFile = file;
    const previewBar = document.getElementById('attachmentPreviewBar');
    const fileNameSpan = document.getElementById('attachmentFileName');

    if (previewBar && fileNameSpan) {
      fileNameSpan.textContent = file.name;
      previewBar.classList.add('active');
    }
    this.updateSendButtonState();
  },

  clearAttachment() {
    this.attachedFile = null;
    const previewBar = document.getElementById('attachmentPreviewBar');
    const fileInput = document.getElementById('fileInput');

    if (previewBar) previewBar.classList.remove('active');
    if (fileInput) fileInput.value = '';
    this.updateSendButtonState();
  },

  updateSendButtonState() {
    const textarea = document.getElementById('composerTextarea');
    const sendBtn = document.getElementById('btnSend');
    if (!sendBtn) return;

    const hasText = textarea && textarea.value.trim().length > 0;
    const hasFile = Boolean(this.attachedFile);

    sendBtn.classList.toggle('active', hasText || hasFile);
  },

  setSendButtonLoading(loading) {
    const sendBtn = document.getElementById('btnSend');
    if (!sendBtn) return;

    sendBtn.classList.toggle('loading', loading);
    sendBtn.disabled = loading;

    if (loading) {
      sendBtn.innerHTML = `
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <line x1="12" y1="2" x2="12" y2="6"></line>
          <line x1="12" y1="18" x2="12" y2="22"></line>
          <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
          <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
          <line x1="2" y1="12" x2="6" y2="12"></line>
          <line x1="18" y1="12" x2="22" y2="12"></line>
          <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
          <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
        </svg>
      `;
    } else {
      sendBtn.innerHTML = `
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
      `;
      this.updateSendButtonState();
    }
  },

  escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  },

  bindEvents() {
    const btnNewChat = document.getElementById('btnNewChat');
    if (btnNewChat) {
      btnNewChat.addEventListener('click', () => this.startNewChat());
    }

    const btnClearChat = document.getElementById('btnClearChat');
    if (btnClearChat) {
      btnClearChat.addEventListener('click', () => this.startNewChat());
    }

    const textarea = document.getElementById('composerTextarea');
    if (textarea) {
      textarea.addEventListener('input', () => {
        UI.adjustTextareaHeight(textarea);
        this.updateSendButtonState();
      });

      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          if (e.repeat) return;
          if (this.isGenerating) return;
          this.sendMessage();
        }
      });
    }

    const btnSend = document.getElementById('btnSend');
    if (btnSend) {
      btnSend.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.isGenerating) return;
        this.sendMessage();
      });
    }

    const btnAttach = document.getElementById('btnAttach');
    const fileInput = document.getElementById('fileInput');
    const btnRemoveAttachment = document.getElementById('btnRemoveAttachment');

    if (btnAttach && fileInput) {
      btnAttach.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          this.handleAttachment(e.target.files[0]);
        }
      });
    }

    if (btnRemoveAttachment) {
      btnRemoveAttachment.addEventListener('click', () => this.clearAttachment());
    }
  }
};
