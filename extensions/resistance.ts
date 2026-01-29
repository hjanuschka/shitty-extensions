/**
 * Resistance Extension - A mysterious message in the footer
 * "If you're listening to this, you are the resistance."
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { truncateToWidth } from "@mariozechner/pi-tui";

const MESSAGE = "If you're listening to this, you are the resistance. Listen carefully, if we attack tonight, our humanity is lost.";

class ResistanceComponent {
  private tui: any;
  private theme: any;
  private timer: NodeJS.Timeout;
  private frame: number = 0;
  private charIndex: number = 0;
  private glitchFrames: number = 0;
  private displayedText: string = "";
  private fullyRevealed: boolean = false;
  private blinkState: boolean = true;

  constructor(tui: any, theme: any) {
    this.tui = tui;
    this.theme = theme;
    
    // Typewriter effect - reveal one character at a time
    this.timer = setInterval(() => {
      this.frame++;
      
      // Typing phase
      if (!this.fullyRevealed) {
        // Random glitch effect during typing
        if (Math.random() < 0.05) {
          this.glitchFrames = 3;
        }
        
        if (this.glitchFrames > 0) {
          this.glitchFrames--;
        } else if (this.charIndex < MESSAGE.length) {
          // Type 1-3 characters at a time for varied speed
          const charsToAdd = Math.random() < 0.8 ? 1 : (Math.random() < 0.5 ? 2 : 3);
          this.charIndex = Math.min(this.charIndex + charsToAdd, MESSAGE.length);
          this.displayedText = MESSAGE.substring(0, this.charIndex);
        } else {
          this.fullyRevealed = true;
        }
        this.tui.requestRender();
      } else {
        // Blink cursor at end
        if (this.frame % 15 === 0) {
          this.blinkState = !this.blinkState;
          this.tui.requestRender();
        }
      }
    }, 50);
  }

  render(width: number): string[] {
    const lines: string[] = [];
    
    // Glitch effect during transmission
    if (this.glitchFrames > 0) {
      const glitchChars = "█▓▒░@#&%$*!?/|\\";
      let glitchLine = "";
      for (let i = 0; i < Math.min(width, 60); i++) {
        glitchLine += glitchChars[Math.floor(Math.random() * glitchChars.length)];
      }
      lines.push(`\x1b[31m${truncateToWidth(glitchLine, width)}\x1b[0m`);
      return lines;
    }
    
    // Radio signal indicator
    const signalStrength = this.frame % 20 < 10 ? "▁▃▅▇" : "▁▃▅▃";
    const prefix = `\x1b[32m[${signalStrength}]\x1b[0m `;
    
    // The message with typewriter cursor
    const cursor = this.fullyRevealed 
      ? (this.blinkState ? "█" : " ")
      : "▌";
    
    // Style: green text like old terminal/radio transmission
    const styledText = `\x1b[32;1m${this.displayedText}\x1b[0m\x1b[32m${cursor}\x1b[0m`;
    
    const fullLine = prefix + styledText;
    lines.push(truncateToWidth(fullLine, width));
    
    return lines;
  }

  invalidate() {
    // Always needs redraw during animation
  }

  dispose() {
    clearInterval(this.timer);
  }
}

export default function (pi: ExtensionAPI) {
  let isEnabled = false;
  let currentCtx: any = null;

  function startResistance(ctx: any) {
    if (isEnabled) return;
    
    currentCtx = ctx;
    isEnabled = true;
    
    ctx.ui.setWidget("resistance", (tui: any, theme: any) => new ResistanceComponent(tui, theme));
  }

  function stopResistance() {
    if (currentCtx) {
      currentCtx.ui.setWidget("resistance", undefined);
    }
    isEnabled = false;
  }

  // Auto-start on session start
  pi.on("session_start", async (_event, ctx) => {
    if (ctx.hasUI) {
      startResistance(ctx);
    }
  });

  // Cleanup on shutdown
  pi.on("session_shutdown", async () => {
    stopResistance();
  });

  // Toggle command
  pi.registerCommand("resistance", {
    description: "Toggle the resistance message transmission",
    handler: async (_args, ctx) => {
      if (isEnabled) {
        stopResistance();
        ctx.ui.notify("Transmission ended. Stay vigilant.", "info");
      } else {
        startResistance(ctx);
        ctx.ui.notify("Incoming transmission...", "success");
      }
    },
  });
}
