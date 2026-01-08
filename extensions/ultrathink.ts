/**
 * Ultrathink Extension - Rainbow animated "ultrathink" display
 * 
 * Detects "ultrathink" AS YOU TYPE and shows rainbow animation.
 * Just like Claude Code - type u-l-t-r-a-t-h-i-n-k and watch the magic!
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

// Rainbow colors (ANSI 256 colors for smooth gradient)
const RAINBOW_COLORS = [
  "\x1b[38;5;196m", // red
  "\x1b[38;5;208m", // orange  
  "\x1b[38;5;226m", // yellow
  "\x1b[38;5;118m", // lime green
  "\x1b[38;5;51m",  // cyan
  "\x1b[38;5;39m",  // sky blue
  "\x1b[38;5;171m", // violet
  "\x1b[38;5;213m", // pink
];

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const BRIGHT_WHITE = "\x1b[38;5;231m";

export default function (pi: ExtensionAPI) {
  let shimmerOffset = 0;
  let colorOffset = 0;
  let animationInterval: ReturnType<typeof setInterval> | null = null;
  let editorWatchInterval: ReturnType<typeof setInterval> | null = null;
  let isShowingRainbow = false;
  let manualMode = false; // When true, don't auto-disable based on editor text
  let currentCtx: any = null;

  // Create rainbow text with Knight Rider shimmer effect
  function createRainbowText(text: string, shimmerPos: number, colorShift: number): string {
    let result = "";
    const chars = [...text];
    
    for (let i = 0; i < chars.length; i++) {
      const colorIndex = (i + colorShift) % RAINBOW_COLORS.length;
      const color = RAINBOW_COLORS[colorIndex];
      const distanceFromShimmer = Math.abs(i - shimmerPos);
      let charStyle = "";
      
      if (distanceFromShimmer === 0) {
        charStyle = `${BRIGHT_WHITE}${BOLD}`;
      } else if (distanceFromShimmer === 1) {
        charStyle = color + BOLD;
      } else {
        charStyle = color;
      }
      
      result += charStyle + chars[i] + RESET;
    }
    
    return result;
  }

  // Create widget (appears right above the editor)
  function createWidget(): string[] {
    const text = "ultrathink";
    const rainbow = createRainbowText(text, shimmerOffset % text.length, colorOffset);
    return [`  ✨ ${rainbow} ✨ ${DIM}enabled${RESET}`];
  }

  // Start rainbow animation
  function startRainbow(ctx: any) {
    if (isShowingRainbow) return;
    
    currentCtx = ctx;
    isShowingRainbow = true;
    shimmerOffset = 0;
    colorOffset = 0;
    
    const textLength = "ultrathink".length;
    let direction = 1;
    let frameCount = 0;
    
    ctx.ui.setWidget("ultrathink", createWidget());
    
    animationInterval = setInterval(() => {
      frameCount++;
      shimmerOffset += direction;
      
      if (shimmerOffset >= textLength - 1) direction = -1;
      else if (shimmerOffset <= 0) direction = 1;
      
      if (frameCount % 3 === 0) {
        colorOffset = (colorOffset + 1) % RAINBOW_COLORS.length;
      }
      
      ctx.ui.setWidget("ultrathink", createWidget());
    }, 50);
  }

  // Stop rainbow animation
  function stopRainbow() {
    if (animationInterval) {
      clearInterval(animationInterval);
      animationInterval = null;
    }
    if (currentCtx) {
      currentCtx.ui.setWidget("ultrathink", undefined);
    }
    isShowingRainbow = false;
  }

  // Start watching editor for "ultrathink"
  function startEditorWatch(ctx: any) {
    if (editorWatchInterval) return;
    
    currentCtx = ctx;
    
    // Poll editor text frequently to detect typing
    editorWatchInterval = setInterval(() => {
      try {
        const text = ctx.ui.getEditorText?.() || "";
        const hasUltrathink = text.toLowerCase().includes("ultrathink");
        
        if (hasUltrathink && !isShowingRainbow) {
          manualMode = false; // Auto-detected, not manual
          startRainbow(ctx);
        } else if (!hasUltrathink && isShowingRainbow && !manualMode) {
          // Only auto-disable if not in manual mode
          stopRainbow();
        }
      } catch {
        // Ignore errors if UI not available
      }
    }, 50); // Check every 50ms for responsive detection
  }

  // Stop watching editor
  function stopEditorWatch() {
    if (editorWatchInterval) {
      clearInterval(editorWatchInterval);
      editorWatchInterval = null;
    }
    manualMode = false;
    stopRainbow();
  }

  // Start watching when session starts
  pi.on("session_start", async (_event, ctx) => {
    if (ctx.hasUI) {
      startEditorWatch(ctx);
    }
  });

  // Also inject thinking instructions when prompt is sent
  pi.on("before_agent_start", async (event, ctx) => {
    const prompt = event.prompt?.toLowerCase() || "";
    
    if (prompt.includes("ultrathink")) {
      return {
        systemPromptAppend: `
The user has requested ULTRATHINK mode. This means:
- Think EXTREMELY deeply about the problem
- Consider multiple approaches and their tradeoffs  
- Be extra thorough in your analysis
- Take your time to reason through complex aspects
- Provide comprehensive, well-thought-out responses
`,
      };
    }
  });

  // Keep rainbow going while agent runs if ultrathink was in prompt
  pi.on("agent_start", async (_event, ctx) => {
    const text = ctx.ui.getEditorText?.() || "";
    // Editor might be cleared, check if we were showing rainbow
    if (isShowingRainbow) {
      // Keep it going during response
    }
  });

  // Cleanup on shutdown
  pi.on("session_shutdown", async () => {
    stopEditorWatch();
  });

  pi.on("session_switch", async () => {
    stopEditorWatch();
  });

  // Manual toggle command
  pi.registerCommand("ultrathink", {
    description: "Toggle ultrathink rainbow mode",
    handler: async (_args, ctx) => {
      if (isShowingRainbow && manualMode) {
        manualMode = false;
        stopRainbow();
        ctx.ui.notify("Ultrathink disabled", "info");
      } else {
        manualMode = true;
        startRainbow(ctx);
        // Append "ultrathink" to current editor text if not already there
        const currentText = ctx.ui.getEditorText?.() || "";
        if (!currentText.toLowerCase().includes("ultrathink")) {
          ctx.ui.setEditorText(currentText ? `${currentText}\n\nULTRATHINK` : "ULTRATHINK");
        }
        ctx.ui.notify("Ultrathink enabled - will be added to prompt", "success");
      }
    },
  });

  // Keyboard shortcut
  pi.registerShortcut("ctrl+u", {
    description: "Toggle ultrathink mode",
    handler: async (ctx) => {
      if (isShowingRainbow && manualMode) {
        manualMode = false;
        stopRainbow();
        ctx.ui.notify("Ultrathink disabled", "info");
      } else {
        manualMode = true;
        startRainbow(ctx);
        // Append "ULTRATHINK" to current editor text if not already there
        const currentText = ctx.ui.getEditorText?.() || "";
        if (!currentText.toLowerCase().includes("ultrathink")) {
          ctx.ui.setEditorText(currentText ? `${currentText}\n\nULTRATHINK` : "ULTRATHINK");
        }
        ctx.ui.notify("Ultrathink enabled - will be added to prompt", "success");
      }
    },
  });
}
