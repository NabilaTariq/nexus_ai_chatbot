import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';



// Load environment variables from .env
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.static(path.join(__dirname)));
app.use("/css", express.static(path.join(__dirname, "css")));
app.use("/js", express.static(path.join(__dirname, "js")));

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Serve static frontend files
app.use(express.static(__dirname));

/**
 * Initialize Supabase Client
 */
const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
const supabaseKey = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_KEY ||
  ''
).trim();

let supabase = null;
if (supabaseUrl && supabaseKey && !supabaseUrl.includes('your-project-id') && supabaseKey !== 'your_supabase_anon_key_here') {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('✅ Supabase Client Initialized successfully.');
  } catch (err) {
    console.warn('⚠️ Failed to initialize Supabase client:', err.message);
  }
} else {
  console.log('ℹ️ Supabase not configured in .env. Running with local fallback.');
}

/**
 * Helper to generate a concise, human-readable title from user message
 */
function generateShortTitle(message) {
  if (!message) return 'New Conversation';

  // Clean up punctuation and excess spaces
  let cleaned = message.replace(/[^\w\s-]/g, '').trim();
  const words = cleaned.split(/\s+/).filter(Boolean);

  if (words.length <= 5) {
    return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }

  return words.slice(0, 5).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') + '...';
}

/**
 * Helper to authenticate request using Supabase JWT Bearer token
 * Returns user object { id, email, user_metadata } or null
 */
async function getAuthUser(req) {
  if (!supabase) return null;
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;
    return user;
  } catch (err) {
    console.warn('Auth token verification error:', err.message);
    return null;
  }
}

/**
 * Health & Configuration Check Endpoint
 * GET /api/health
 */
app.get('/api/health', (req, res) => {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
  const hasGeminiKey = Boolean(apiKey && apiKey !== 'your_gemini_api_key_here');

  res.json({
    status: 'ok',
    apiKeyConfigured: hasGeminiKey,
    supabaseConfigured: Boolean(supabase),
    supabaseUrl: process.env.SUPABASE_URL || null,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || null,
    model: process.env.GEMINI_MODEL || 'gemini-3.5-flash'
  });
});

/**
 * --------------------------------------------------------------------------
 * SUPABASE AUTHENTICATION ENDPOINTS
 * --------------------------------------------------------------------------
 */

/**
 * Sign Up with Email & Password
 * POST /api/auth/signup
 * Body: { email, password, fullName }
 */
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, fullName } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }
    if (!supabase) {
      return res.status(503).json({ success: false, error: 'Supabase database is not configured.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanFullName = (fullName || '').trim() || cleanEmail.split('@')[0];

    let userResult = null;
    let authError = null;

    // If Service Role Key is configured, use admin API with email_confirm: true for instant frictionless signup
    const isServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
    if (isServiceRole && supabase.auth.admin) {
      const { data: adminData, error: adminErr } = await supabase.auth.admin.createUser({
        email: cleanEmail,
        password: password,
        email_confirm: true,
        user_metadata: {
          full_name: cleanFullName
        }
      });

      if (adminErr) {
        authError = adminErr;
      } else {
        userResult = adminData.user;
      }
    } else {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: password,
        options: {
          data: {
            full_name: cleanFullName
          }
        }
      });

      if (error) {
        authError = error;
      } else {
        userResult = data.user;
      }
    }

    if (authError) {
      return res.status(400).json({ success: false, error: authError.message });
    }

    // Automatically sign in to get active session JWT token
    const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: password
    });

    if (!loginErr && loginData?.session) {
      return res.json({
        success: true,
        user: {
          id: loginData.user.id,
          email: loginData.user.email,
          fullName: loginData.user.user_metadata?.full_name || cleanFullName
        },
        session: {
          access_token: loginData.session.access_token,
          refresh_token: loginData.session.refresh_token
        },
        message: 'Account created and signed in successfully.'
      });
    }

    return res.json({
      success: true,
      user: userResult ? {
        id: userResult.id,
        email: userResult.email,
        fullName: userResult.user_metadata?.full_name || cleanFullName
      } : null,
      session: null,
      message: 'Account created. Please check your email if confirmation is required.'
    });

  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Sign In with Email & Password
 * POST /api/auth/login
 * Body: { email, password }
 */
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }
    if (!supabase) {
      return res.status(503).json({ success: false, error: 'Supabase database is not configured.' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password
    });

    if (error) {
      return res.status(401).json({ success: false, error: error.message });
    }

    return res.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        fullName: data.user.user_metadata?.full_name || data.user.email.split('@')[0]
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Sign Out
 * POST /api/auth/logout
 */
app.post('/api/auth/logout', async (req, res) => {
  try {
    return res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Get Current Authenticated User Profile
 * GET /api/auth/me
 */
app.get('/api/auth/me', async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ success: false, authenticated: false, error: 'Not authenticated.' });
    }

    return res.json({
      success: true,
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.user_metadata?.full_name || user.email.split('@')[0]
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * --------------------------------------------------------------------------
 * CONVERSATION CRUD ENDPOINTS (SUPABASE PERSISTENCE)
 * --------------------------------------------------------------------------
 */

/**
 * Fetch all conversations for the authenticated user
 * GET /api/conversations
 */
app.get('/api/conversations', async (req, res) => {
  try {
    if (!supabase) {
      return res.json({
        success: true,
        conversations: [],
        storageType: 'local'
      });
    }

    const user = await getAuthUser(req);
    if (!user) {
      // Guests see clean landing page with empty history
      return res.json({
        success: true,
        conversations: [],
        storageType: 'guest'
      });
    }

    let { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    // Graceful fallback if user_id column has not been added yet in remote Supabase table
    if (error && error.message && error.message.includes('user_id')) {
      console.warn('ℹ️ user_id column not found in conversations table. Running fallback query.');
      const fallback = await supabase
        .from('conversations')
        .select('*')
        .order('updated_at', { ascending: false });
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      console.error('Supabase get conversations error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({
      success: true,
      conversations: data || [],
      storageType: 'supabase'
    });

  } catch (err) {
    console.error('Error fetching conversations:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Create a new conversation
 * POST /api/conversations
 * Body: { title?: string }
 */
app.post('/api/conversations', async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user && supabase) {
      return res.status(401).json({
        success: false,
        error: 'Please login or create an account to start chatting with Nexus AI.',
        requiresAuth: true
      });
    }

    const title = (req.body && req.body.title ? req.body.title.trim() : 'New Conversation');

    if (!supabase) {
      const mockId = `conv-${Date.now()}`;
      return res.json({
        success: true,
        conversation: {
          id: mockId,
          title: title,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      });
    }

    let insertPayload = {
      title: title,
      user_id: user ? user.id : null
    };

    let { data, error } = await supabase
      .from('conversations')
      .insert([insertPayload])
      .select()
      .single();

    if (error && error.message && error.message.includes('user_id')) {
      const fallback = await supabase
        .from('conversations')
        .insert([{ title: title }])
        .select()
        .single();
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      console.error('Supabase create conversation error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({
      success: true,
      conversation: data
    });

  } catch (err) {
    console.error('Error creating conversation:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Fetch all messages for a specific conversation
 * GET /api/conversations/:id/messages
 */
app.get('/api/conversations/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ success: false, error: 'Conversation ID is required.' });
    }

    if (!supabase) {
      return res.json({ success: true, messages: [] });
    }

    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Please login or create an account to view chat history.',
        requiresAuth: true
      });
    }

    // Verify conversation ownership
    let { data: conv, error: convErr } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (convErr && convErr.message && convErr.message.includes('user_id')) {
      const fallback = await supabase
        .from('conversations')
        .select('id')
        .eq('id', id)
        .single();
      conv = fallback.data;
      convErr = fallback.error;
    }

    if (convErr || !conv) {
      return res.status(404).json({ success: false, error: 'Conversation not found or access denied.' });
    }

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Supabase fetch messages error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({
      success: true,
      messages: data || []
    });

  } catch (err) {
    console.error('Error fetching messages:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Rename conversation
 * PATCH /api/conversations/:id
 * Body: { title: string }
 */
app.patch('/api/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Title cannot be empty.' });
    }

    const cleanTitle = title.trim();

    if (!supabase) {
      return res.json({
        success: true,
        conversation: { id, title: cleanTitle, updated_at: new Date().toISOString() }
      });
    }

    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized.', requiresAuth: true });
    }

    let { data, error } = await supabase
      .from('conversations')
      .update({
        title: cleanTitle,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error && error.message && error.message.includes('user_id')) {
      const fallback = await supabase
        .from('conversations')
        .update({
          title: cleanTitle,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      console.error('Supabase rename conversation error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({
      success: true,
      conversation: data
    });

  } catch (err) {
    console.error('Error updating conversation title:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Delete conversation and its cascading messages
 * DELETE /api/conversations/:id
 */
app.delete('/api/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ success: false, error: 'Conversation ID is required.' });
    }

    if (!supabase) {
      return res.json({ success: true, id: id });
    }

    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized.', requiresAuth: true });
    }

    // Deleting from conversations will automatically cascade to messages via foreign key ON DELETE CASCADE
    let { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error && error.message && error.message.includes('user_id')) {
      const fallback = await supabase
        .from('conversations')
        .delete()
        .eq('id', id);
      error = fallback.error;
    }

    if (error) {
      console.error('Supabase delete conversation error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({
      success: true,
      id: id,
      message: 'Conversation and associated messages deleted successfully.'
    });

  } catch (err) {
    console.error('Error deleting conversation:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * --------------------------------------------------------------------------
 * CHAT COMPLETION & PERSISTENCE ENDPOINT
 * --------------------------------------------------------------------------
 * POST /api/chat
 * Body: { message: string, conversationId?: string, history?: Array<{role: string, content: string}>, model?: string }
 */
app.post('/api/chat', async (req, res) => {
  try {
    const { message, conversationId, history = [], model: requestedModel } = req.body;

    // 1. Input Validation: Prevent empty submissions
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Message content is required and cannot be empty.'
      });
    }

    // Check Authentication
    const user = await getAuthUser(req);
    if (!user && supabase) {
      return res.status(401).json({
        success: false,
        error: 'Please login or create an account to start chatting with Nexus AI.',
        requiresAuth: true
      });
    }

    const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();

    // 2. Check for configured API Key
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      return res.status(503).json({
        success: false,
        error: 'API key is not configured. Please add your GEMINI_API_KEY to the .env file and restart the server.',
        errorType: 'MISSING_API_KEY'
      });
    }

    let activeConvId = conversationId;
    let generatedTitle = null;

    // 3. Database Persistence: Manage conversation row
    if (supabase && user) {
      if (!activeConvId) {
        generatedTitle = generateShortTitle(message.trim());
        let { data: newConv, error: convErr } = await supabase
          .from('conversations')
          .insert([{
            title: generatedTitle,
            user_id: user.id
          }])
          .select()
          .single();

        if (convErr && convErr.message && convErr.message.includes('user_id')) {
          const fallback = await supabase
            .from('conversations')
            .insert([{ title: generatedTitle }])
            .select()
            .single();
          newConv = fallback.data;
          convErr = fallback.error;
        }

        if (!convErr && newConv) {
          activeConvId = newConv.id;
        } else {
          console.warn('Could not create new conversation in DB:', convErr?.message);
        }
      }

      // Save User Message to Database
      if (activeConvId) {
        await supabase
          .from('messages')
          .insert([{
            conversation_id: activeConvId,
            role: 'user',
            content: message.trim()
          }]);
      }
    }

    // 4. Format and sanitize conversation history for multi-turn Gemini chat
    let contents = [];

    // If Supabase is connected and we have a conversationId, query DB history for source-of-truth context
    let contextMessages = history;
    if (supabase && activeConvId) {
      const { data: dbMessages } = await supabase
        .from('messages')
        .select('role, content')
        .eq('conversation_id', activeConvId)
        .order('created_at', { ascending: true })
        .limit(30);

      if (dbMessages && dbMessages.length > 0) {
        // Exclude the last message if it's the current user message to avoid duplicate turn
        contextMessages = dbMessages.slice(0, -1);
      }
    }

    if (Array.isArray(contextMessages) && contextMessages.length > 0) {
      const recentHistory = contextMessages.slice(-30);

      for (const entry of recentHistory) {
        const textContent = (entry.content || entry.text || '').trim();
        if (!textContent) continue;

        const role = (entry.role === 'assistant' || entry.role === 'model') ? 'model' : 'user';

        // Ensure alternating roles
        if (contents.length > 0 && contents[contents.length - 1].role === role) {
          contents[contents.length - 1].parts[0].text += '\n\n' + textContent;
        } else {
          contents.push({
            role: role,
            parts: [{ text: textContent }]
          });
        }
      }

      // Ensure starts with user
      if (contents.length > 0 && contents[0].role === 'model') {
        contents.shift();
      }
    }

    // Append the current latest user message
    if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
      contents[contents.length - 1].parts[0].text += '\n\n' + message.trim();
    } else {
      contents.push({
        role: 'user',
        parts: [{ text: message.trim() }]
      });
    }

    // 5. Initialize Google Generative AI SDK with Candidate Fallback & Retry
    const genAI = new GoogleGenerativeAI(apiKey);
    const candidateModels = Array.from(new Set([
      requestedModel,
      process.env.GEMINI_MODEL || 'gemini-3.5-flash',
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.1-flash-lite',
      'gemini-3.6-flash',
      'gemini-3.7-flash',
      'gemini-flash-latest'
    ])).filter(Boolean);

    const systemInstruction = `You are Nexus AI, a professional, elegant, and sophisticated conversational AI assistant. Always provide clean, properly formatted, high-quality responses.

Strict formatting rules:
- Never output raw Markdown placeholder tokens or internal labels (such as CODE_BLOCK_0, CODE_BLOCK_1, SVG, etc.).
- Always use standard GitHub-flavored Markdown for headings, lists, bold text, and tables.
- For all code examples, always use real fenced code blocks specifying the correct programming language (e.g., \`\`\`python, \`\`\`javascript, \`\`\`html, \`\`\`css, \`\`\`bash, \`\`\`json, \`\`\`sql).
- Keep code clean, readable, and properly indented with concise inline comments where helpful.`;

    let lastError = null;
    let responseText = null;
    let successfulModel = null;

    for (const modelName of candidateModels) {
      try {
        const modelInstance = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: systemInstruction
        });

        // Try with retry backoff for rate limits / transient server overloads
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const result = await modelInstance.generateContent({
              contents: contents,
              generationConfig: {
                temperature: 0.7,
                topP: 0.95,
                maxOutputTokens: 2048,
              }
            });

            const response = await result.response;
            responseText = response.text();
            successfulModel = modelName;
            break;
          } catch (retryErr) {
            const isTransient = retryErr.message && (
              retryErr.message.includes('429') ||
              retryErr.message.includes('503') ||
              retryErr.message.includes('quota') ||
              retryErr.message.includes('overloaded') ||
              retryErr.message.includes('Resource has been exhausted')
            );
            if (isTransient && attempt < 2) {
              console.log(`[${modelName}] Transient error (attempt ${attempt + 1}/3), backing off 2s...`);
              await new Promise(r => setTimeout(r, 2000));
            } else {
              throw retryErr;
            }
          }
        }

        if (responseText) {
          break; // Succeeded!
        }
      } catch (err) {
        lastError = err;
        console.warn(`Model ${modelName} attempt failed: ${err.message}. Trying next candidate...`);
      }
    }

    if (!responseText && lastError) {
      throw lastError;
    }

    // 6. Save Assistant Response to Database
    if (supabase && activeConvId && responseText) {
      await supabase
        .from('messages')
        .insert([{
          conversation_id: activeConvId,
          role: 'assistant',
          content: responseText
        }]);

      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', activeConvId);
    }

    return res.json({
      success: true,
      text: responseText,
      conversationId: activeConvId || conversationId,
      title: generatedTitle,
      model: successfulModel
    });

  } catch (err) {
    console.error('Error generating AI response:', err);

    let friendlyMessage = 'An error occurred while communicating with the AI service. Please try again.';
    let statusCode = 500;

    if (err.message && err.message.includes('API_KEY_INVALID')) {
      friendlyMessage = 'The provided GEMINI_API_KEY is invalid. Please verify your API key in the .env file.';
      statusCode = 401;
    } else if (err.message && (err.message.includes('quota') || err.message.includes('RATE_LIMIT_EXCEEDED') || err.message.includes('429') || err.message.includes('503'))) {
      friendlyMessage = 'AI model service is currently experiencing high demand. Please retry in a few moments.';
      statusCode = 503;
    } else if (err.message) {
      friendlyMessage = err.message;
    }

    return res.status(statusCode).json({
      success: false,
      error: friendlyMessage
    });
  }
});

// Start Server locally if not running within a serverless container (e.g. Vercel)
if (process.env.VERCEL !== '1' && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  app.listen(PORT, () => {
    console.log(`=================================================`);
    console.log(`  ✨ Nexus AI Backend Server Running`);
    console.log(`  🌐 Local: http://localhost:${PORT}`);
    console.log(`  🔑 Gemini Key Configured: ${Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here') ? 'YES' : 'NO'}`);
    console.log(`  🗄️  Supabase Database: ${Boolean(supabase) ? 'CONNECTED' : 'LOCAL FALLBACK'}`);
    console.log(`=================================================`);
  });
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

export default app;