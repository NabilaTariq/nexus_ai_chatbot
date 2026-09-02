# Nexus AI — Intelligent Chatbot

A high-performance AI chatbot application built with an executive palette: **Navy** (`#1F2A44`), **Warm Beige** (`#E8DCC8`), and **Soft Gold** (`#C6A75E`). Powered by Express.js, Google Gemini, and **Supabase PostgreSQL** for persistent conversation history.

---

## 🚀 Features

- **Persistent Chat History**: Powered by Supabase PostgreSQL with `conversations` and `messages` tables.
- **Auto Title Generation**: Automatically creates short, human-readable titles on the first prompt of each thread.
- **Thread Management**: Full thread renaming and cascading deletions with confirmation dialogs.
- **Multi-Turn AI Context**: Retains prior conversation turns with Gemini LLM models.
- **Rich Message Stream**: GitHub-flavored Markdown rendering, syntax-highlighted code blocks, and copy-to-clipboard buttons.
- **Auto-Scroll Sentinel**: Intelligent auto-scrolling with user-aware scroll position preservation.
- **Dual Themes**: Executive Navy dark mode & Warm Beige light mode.

---

## 🛠️ Setup Guide

### 1. Configure Supabase (Database Setup)
1. Log in to [Supabase](https://supabase.com) and create a new project.
2. Navigate to the **SQL Editor** in your Supabase dashboard.
3. Paste and run the SQL script from [`supabase/schema.sql`](supabase/schema.sql).
4. Go to **Project Settings -> API** to copy your **Project URL** and **anon / service_role API Key**.

### 2. Configure Environment Variables
Open [`.env`](.env) and set your API keys:
```env
PORT=3000

# Google Gemini API Key
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.6-flash

# Supabase Credentials
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Start the Application
```bash
npm start
# or with hot-reloading:
npm run dev
```

### 5. Access the Web App
Open your browser and navigate to:
```
http://localhost:3000
```
