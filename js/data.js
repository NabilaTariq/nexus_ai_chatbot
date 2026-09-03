/**
 * Knowledge Base, 6 Homepage Feature Cards & Prompt Library for Nexus AI
 * Midnight Orchid Luxury Identity
 */

export const INITIAL_CHAT_HISTORY = [];

// 6 Core Homepage Feature Cards
export const FEATURE_CARDS = [
  {
    id: "ai-chat",
    icon: "💬",
    badge: "Core Intelligence",
    title: "AI Chat",
    desc: "Engage in multi-turn strategic dialogues, conceptual synthesis, and deep reasoning.",
    prompt: "I'd like to brainstorm and analyze high-level strategic opportunities in emerging AI workflows."
  },
  {
    id: "document-analysis",
    icon: "📄",
    badge: "Document Engine",
    title: "Document Analysis",
    desc: "Upload PDFs, research papers, or reports for instant semantic breakdown and insights.",
    prompt: "Analyze the uploaded document for key themes, executive takeaways, and operational risks."
  },
  {
    id: "ai-research",
    icon: "🔬",
    badge: "Deep Research",
    title: "AI Research",
    desc: "Perform comprehensive multi-source investigation and synthesize empirical findings.",
    prompt: "Conduct a deep research overview on the architectural evolution from Transformers to State Space Models."
  },
  {
    id: "coding-assistant",
    icon: "💻",
    badge: "Engineering",
    title: "Coding Assistant",
    desc: "Full-stack code generation, refactoring, vulnerability remediation, and test suites.",
    prompt: "Write a high-performance, asynchronous REST API service with clean architecture and schema validation."
  },
  {
    id: "content-creation",
    icon: "✍️",
    badge: "Creative Synthesis",
    title: "Content Creation",
    desc: "Draft executive summaries, technical documentation, compelling copy, and thought leadership.",
    prompt: "Draft an executive briefing on AI enterprise deployment with clear milestones and ROI benchmarks."
  },
  {
    id: "automation",
    icon: "⚡",
    badge: "Autonomous Agents",
    title: "Automation",
    desc: "Design autonomous agent loops, tool-calling pipelines, and automated system scripts.",
    prompt: "Design an automated data processing pipeline with error recovery and webhook notification triggers."
  }
];

// Presets for the Prompt Library Modal
export const PROMPT_LIBRARY = [
  {
    category: "Architecture & Code",
    items: [
      {
        title: "Clean Microservice Scaffold",
        prompt: "Design a production-ready Node.js or Python microservice architecture adhering to Domain-Driven Design (DDD)."
      },
      {
        title: "SQL Schema & Query Optimization",
        prompt: "Review this database query and suggest indexing strategies, query plan optimizations, and connection pooling best practices."
      },
      {
        title: "Security Audit & Code Review",
        prompt: "Audit this code snippet for security vulnerabilities including injection attacks, sanitization gaps, and resource leaks."
      }
    ]
  },
  {
    category: "Strategic Research",
    items: [
      {
        title: "Competitive Moat Analysis",
        prompt: "Perform a strategic competitive moat analysis for a modern AI platform evaluating network effects, data flywheels, and switching costs."
      },
      {
        title: "Technology Tradeoff Matrix",
        prompt: "Create a comparative technical tradeoff matrix between PostgreSQL with pgvector versus dedicated vector databases (Pinecone, Qdrant)."
      }
    ]
  },
  {
    category: "Content & Executive Writing",
    items: [
      {
        title: "Investor Executive Summary",
        prompt: "Draft a crisp 1-page executive summary for an AI startup emphasizing problem-solution fit, market size, and traction."
      },
      {
        title: "Technical Architecture Whitepaper",
        prompt: "Draft an outline and introduction for a technical whitepaper detailing a resilient, event-driven agent architecture."
      }
    ]
  }
];
