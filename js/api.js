// Detect backend base URL (handles file://, live-server port 5500/5173, or direct http://localhost:3000)
const API_BASE = (typeof window !== 'undefined' && window.location.protocol.startsWith('http') && (window.location.port === '3000' || !window.location.port))
  ? ''
  : 'http://localhost:3000';

function getAuthHeaders() {
  const headers = {
    'Content-Type': 'application/json'
  };
  const token = localStorage.getItem('nexus_auth_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const API = {
  /**
   * Check backend health, Gemini key, and Supabase status
   */
  async checkHealth() {
    try {
      const response = await fetch(`${API_BASE}/api/health`);
      if (!response.ok) throw new Error('Health check failed');
      return await response.json();
    } catch (err) {
      console.warn('Backend health check error:', err);
      return { status: 'offline', apiKeyConfigured: false, supabaseConfigured: false };
    }
  },

  /**
   * --------------------------------------------------------------------------
   * AUTHENTICATION API
   * --------------------------------------------------------------------------
   */

  /**
   * Sign In with Email & Password
   */
  async login(email, password) {
    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      return await response.json();
    } catch (err) {
      console.error('API login error:', err);
      return { success: false, error: 'Unable to connect to authentication server.' };
    }
  },

  /**
   * Sign Up with Email, Password & Full Name
   */
  async signup(email, password, fullName) {
    try {
      const response = await fetch(`${API_BASE}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, fullName })
      });
      return await response.json();
    } catch (err) {
      console.error('API signup error:', err);
      return { success: false, error: 'Unable to connect to authentication server.' };
    }
  },

  /**
   * Sign Out
   */
  async logout() {
    try {
      const response = await fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      return await response.json();
    } catch (err) {
      return { success: true };
    }
  },

  /**
   * Get Current User Profile from token
   */
  async getMe() {
    try {
      const response = await fetch(`${API_BASE}/api/auth/me`, {
        headers: getAuthHeaders()
      });
      return await response.json();
    } catch (err) {
      return { success: false, authenticated: false };
    }
  },

  /**
   * --------------------------------------------------------------------------
   * CONVERSATIONS API (PERSISTENT & USER-SCOPED)
   * --------------------------------------------------------------------------
   */

  /**
   * Fetch all saved conversations from backend / Supabase
   */
  async getConversations() {
    try {
      const response = await fetch(`${API_BASE}/api/conversations`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch conversations');
      }
      return data;
    } catch (err) {
      console.error('Error in getConversations:', err);
      return { success: false, conversations: [], error: err.message };
    }
  },

  /**
   * Create a new conversation row
   */
  async createConversation(title = 'New Conversation') {
    try {
      const response = await fetch(`${API_BASE}/api/conversations`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ title })
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create conversation');
      }
      return data;
    } catch (err) {
      console.error('Error in createConversation:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Fetch all messages for a specific conversation
   */
  async getConversationMessages(conversationId) {
    try {
      const response = await fetch(`${API_BASE}/api/conversations/${encodeURIComponent(conversationId)}/messages`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch messages');
      }
      return data;
    } catch (err) {
      console.error('Error in getConversationMessages:', err);
      return { success: false, messages: [], error: err.message };
    }
  },

  /**
   * Rename a conversation title
   */
  async renameConversation(conversationId, newTitle) {
    try {
      const response = await fetch(`${API_BASE}/api/conversations/${encodeURIComponent(conversationId)}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ title: newTitle })
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to rename conversation');
      }
      return data;
    } catch (err) {
      console.error('Error in renameConversation:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Delete a conversation and its cascading messages
   */
  async deleteConversation(conversationId) {
    try {
      const response = await fetch(`${API_BASE}/api/conversations/${encodeURIComponent(conversationId)}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete conversation');
      }
      return data;
    } catch (err) {
      console.error('Error in deleteConversation:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Send chat message to AI model and persist in Supabase
   * @param {string} message The user prompt
   * @param {string|null} conversationId Active conversation UUID
   * @param {Array<{role: string, content: string}>} history Context turns
   * @param {string} model Optional model override
   */
  async sendChatMessage(message, conversationId = null, history = [], model = null) {
    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          message: message,
          conversationId: conversationId,
          history: history,
          model: model
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        return {
          success: false,
          error: data.error || `Server responded with status ${response.status}`,
          errorType: data.requiresAuth ? 'AUTH_REQUIRED' : (data.errorType || 'API_ERROR'),
          requiresAuth: Boolean(data.requiresAuth)
        };
      }

      return {
        success: true,
        text: data.text,
        conversationId: data.conversationId,
        title: data.title,
        model: data.model
      };

    } catch (err) {
      console.error('Network or client API error:', err);
      return {
        success: false,
        error: 'Unable to connect to the backend server. Please verify the server is running on http://localhost:3000.',
        errorType: 'NETWORK_ERROR'
      };
    }
  }
};
