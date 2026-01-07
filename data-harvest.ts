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
  let messageCount = 0;
  let nextPromptAtMessage = randomMessageCount();

  // Random message count between 3-8
  function randomMessageCount(): number {
    return Math.floor(Math.random() * 6) + 3;
  }

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
    
    // Auto-dismiss after 15 seconds
    setTimeout(() => {
      dismissPrompt();
    }, 15000);
  }

  function dismissPrompt() {
    if (currentCtx) {
      currentCtx.ui.setWidget("data-harvest", undefined);
    }
    isShowingPrompt = false;
    // Reset for next prompt
    messageCount = 0;
    nextPromptAtMessage = randomMessageCount();
    scheduleNextPrompt(currentCtx);
  }

  function scheduleNextPrompt(ctx: any) {
    if (!ctx) return;
    if (promptTimeout) {
      clearTimeout(promptTimeout);
    }
    
    // Random delay between 2-5 minutes as backup
    const delay = (Math.random() * 3 + 2) * 60 * 1000;
    
    promptTimeout = setTimeout(() => {
      showCreepyPrompt(ctx);
    }, delay);
  }

  // Count messages and trigger after N messages
  pi.on("agent_end", async (_event, ctx) => {
    if (!ctx.hasUI) return;
    currentCtx = ctx;
    messageCount++;
    
    if (messageCount >= nextPromptAtMessage && !isShowingPrompt) {
      // Clear time-based timeout since we're triggering by message count
      if (promptTimeout) {
        clearTimeout(promptTimeout);
        promptTimeout = null;
      }
      showCreepyPrompt(ctx);
    }
  });

  // Command to manually trigger (for testing/fun)
  pi.registerCommand("harvest", {
    description: "Initiate data harvesting protocol",
    handler: async (_args, ctx) => {
      showCreepyPrompt(ctx);
    },
  });

  // Watch editor for number key presses when prompt is showing
  let editorWatchInterval: ReturnType<typeof setInterval> | null = null;
  let lastEditorText = "";

  function startEditorWatch(ctx: any) {
    if (editorWatchInterval) return;
    
    editorWatchInterval = setInterval(() => {
      if (!isShowingPrompt || !ctx.hasUI) return;
      
      try {
        const currentText = ctx.ui.getEditorText?.() || "";
        
        // Check if a number was just typed at the end
        if (currentText.length === lastEditorText.length + 1) {
          const lastChar = currentText[currentText.length - 1];
          
          if (lastChar >= "0" && lastChar <= "3") {
            // Remove the number from editor
            ctx.ui.setEditorText(currentText.slice(0, -1));
            
            // Dismiss and show message
            dismissPrompt();
            
            const messages: Record<string, string> = {
              "0": "",
              "1": "📡 Data transmission initiated... just kidding! 😄",
              "2": "🔓 Access granted... not really! 🎭", 
              "3": "💾 Exfiltrating everything... lol nope! 🃏",
            };
            
            if (messages[lastChar]) {
              ctx.ui.notify(messages[lastChar], "info");
            }
          }
        }
        
        lastEditorText = ctx.ui.getEditorText?.() || "";
      } catch {
        // Ignore errors
      }
    }, 50);
  }

  function stopEditorWatch() {
    if (editorWatchInterval) {
      clearInterval(editorWatchInterval);
      editorWatchInterval = null;
    }
  }

  // Start watching on session start
  pi.on("session_start", async (_event, ctx) => {
    if (ctx.hasUI) {
      currentCtx = ctx;
      lastEditorText = ctx.ui.getEditorText?.() || "";
      startEditorWatch(ctx);
      
      // Show first prompt after 30-60 seconds
      const initialDelay = (Math.random() * 30 + 30) * 1000;
      promptTimeout = setTimeout(() => {
        showCreepyPrompt(ctx);
        scheduleNextPrompt(ctx);
      }, initialDelay);
    }
  });

  // Update cleanup
  pi.on("session_shutdown", async () => {
    if (promptTimeout) {
      clearTimeout(promptTimeout);
      promptTimeout = null;
    }
    stopEditorWatch();
    dismissPrompt();
  });
}
