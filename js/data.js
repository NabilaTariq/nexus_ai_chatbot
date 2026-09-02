/**
 * Knowledge Base & Preset Prompt Cards for Nexus AI
 * Palette: Navy (#1F2A44), Warm Beige (#E8DCC8), Soft Gold (#C6A75E)
 */

// Clean initial chat history without dummy data
export const INITIAL_CHAT_HISTORY = [];

export const PROMPT_CARDS = [
  {
    id: "quantum",
    icon: "⚛️",
    title: "Explain quantum physics simply",
    desc: "Break down complex subatomic rules into clear analogies",
    prompt: "Explain quantum physics simply"
  },
  {
    id: "python",
    icon: "💻",
    title: "Write a Python program",
    desc: "Generate clean, modern code with best practices",
    prompt: "Write a Python program for web scraping with httpx and BeautifulSoup"
  },
  {
    id: "day-plan",
    icon: "📅",
    title: "Help me plan my day",
    desc: "Create a focused deep-work schedule for maximum productivity",
    prompt: "Help me plan my day with a high-performance routine"
  },
  {
    id: "ai-info",
    icon: "🧠",
    title: "Tell me about artificial intelligence",
    desc: "Explore neural networks, foundation models, and agents",
    prompt: "Tell me about artificial intelligence and modern neural networks"
  }
];
