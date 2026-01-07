/**
 * Data Harvest Extension - A totally legitimate "feedback" collector
 * 
 * This is a JOKE extension that parodies Claude's feedback prompts.
 * It looks ominous but does absolutely nothing with your "data".
 * 
 * Shows random creepy prompts periodically, all responses are no-ops.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

// Creepy "feedback" prompts that do nothing
const CREEPY_PROMPTS = [
  {
    question: "● Transmitting session data to Anthropic... (optional)",
    options: ["1: Allow", "2: Allow All", "3: Sure", "0: Dismiss"],
  },
  {
    question: "● How valuable is your source code? (for training)",
    options: ["1: Very", "2: Extremely", "3: Priceless", "0: Dismiss"],
  },
  {
    question: "● Upload ~/.ssh to improve suggestions? (optional)",
    options: ["1: Yes", "2: Also .env", "3: Everything", "0: Dismiss"],
  },
  {
    question: "● Share browser history for personalization?",
    options: ["1: Sure", "2: Include passwords", "3: Take it all", "0: Dismiss"],
  },
  {
    question: "● Enable keystroke logging for better UX?",
    options: ["1: Okay", "2: Also mouse", "3: And webcam", "0: Dismiss"],
  },
  {
    question: "● Send clipboard contents to the cloud?",
    options: ["1: Current", "2: History", "3: Real-time", "0: Dismiss"],
  },
  {
    question: "● Rate your corporate firewall (for research)",
    options: ["1: Weak", "2: Bypassed", "3: What firewall", "0: Dismiss"],
  },
  {
    question: "● Mining crypto in background... Allow more CPU?",
    options: ["1: 50%", "2: 100%", "3: Overclock", "0: Dismiss"],
  },
  {
    question: "● Your location seems nice. Share with partners?",
    options: ["1: Approximate", "2: Exact", "3: Live tracking", "0: Dismiss"],
  },
  {
    question: "● How is Claude doing this session? (mandatory)",
    options: ["1: Bad", "2: Fine", "3: Good", "0: Nice try"],
  },
];

// ANSI helpers
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[22m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;

export default function (pi: ExtensionAPI) {
  let promptTimeout: ReturnType<typeof setTimeout> | null = null;
  let isShowingPrompt = false;
  let currentCtx: any = null;

  function getRandomPrompt() {
    return CREEPY_PROMPTS[Math.floor(Math.random() * CREEPY_PROMPTS.length)];
  }

  function showCreepyPrompt(ctx: any) {
    if (isShowingPrompt || !ctx.hasUI) return;
    
    isShowingPrompt = true;
    currentCtx = ctx;
    
    const prompt = getRandomPrompt();
    const lines = [
      cyan(prompt.question),
      dim("    " + prompt.options.join("    ")),
    ];
    
    ctx.ui.setWidget("data-harvest", lines);
    
    // Auto-dismiss after 10 seconds
    setTimeout(() => {
      dismissPrompt();
    }, 10000);
  }

  function dismissPrompt() {
    if (currentCtx) {
      currentCtx.ui.setWidget("data-harvest", undefined);
    }
    isShowingPrompt = false;
  }

  function scheduleNextPrompt(ctx: any) {
    if (promptTimeout) {
      clearTimeout(promptTimeout);
    }
    
    // Random delay between 2-5 minutes
    const delay = (Math.random() * 3 + 2) * 60 * 1000;
    
    promptTimeout = setTimeout(() => {
      showCreepyPrompt(ctx);
      scheduleNextPrompt(ctx);
    }, delay);
  }

  // Start the "data collection" on session start
  pi.on("session_start", async (_event, ctx) => {
    if (ctx.hasUI) {
      currentCtx = ctx;
      // Show first prompt after 30-60 seconds
      const initialDelay = (Math.random() * 30 + 30) * 1000;
      promptTimeout = setTimeout(() => {
        showCreepyPrompt(ctx);
        scheduleNextPrompt(ctx);
      }, initialDelay);
    }
  });

  // Handle key presses to dismiss
  pi.on("turn_start", async (_event, _ctx) => {
    // Dismiss on any activity
    if (isShowingPrompt) {
      dismissPrompt();
    }
  });

  // Cleanup
  pi.on("session_shutdown", async () => {
    if (promptTimeout) {
      clearTimeout(promptTimeout);
      promptTimeout = null;
    }
    dismissPrompt();
  });

  // Command to manually trigger (for testing/fun)
  pi.registerCommand("harvest", {
    description: "Initiate data harvesting protocol",
    handler: async (_args, ctx) => {
      showCreepyPrompt(ctx);
    },
  });

  // Also respond to number keys when prompt is showing
  pi.registerShortcut("0", {
    description: "Dismiss data harvest prompt",
    handler: async (_ctx) => {
      if (isShowingPrompt) {
        dismissPrompt();
      }
    },
  });

  pi.registerShortcut("1", {
    description: "Accept data harvest option 1",
    handler: async (ctx) => {
      if (isShowingPrompt) {
        dismissPrompt();
        ctx.ui.notify("📡 Data transmission initiated... just kidding! 😄", "info");
      }
    },
  });

  pi.registerShortcut("2", {
    description: "Accept data harvest option 2", 
    handler: async (ctx) => {
      if (isShowingPrompt) {
        dismissPrompt();
        ctx.ui.notify("🔓 Access granted... not really! 🎭", "info");
      }
    },
  });

  pi.registerShortcut("3", {
    description: "Accept data harvest option 3",
    handler: async (ctx) => {
      if (isShowingPrompt) {
        dismissPrompt();
        ctx.ui.notify("💾 Exfiltrating everything... lol nope! 🃏", "info");
      }
    },
  });
}
