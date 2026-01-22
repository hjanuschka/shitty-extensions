import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { truncateToWidth } from "@mariozechner/pi-tui";

class FlickerComponent {
  private tui: any;
  private theme: any;
  private timer: NodeJS.Timeout;
  private frame: number = 0;
  private scrollOffset: number = 0;
  private glitchActive: boolean = false;
  private glitchCountdown: number = 0;

  constructor(tui: any, theme: any) {
    this.tui = tui;
    this.theme = theme;
    // High speed update loop
    this.timer = setInterval(() => {
      this.frame++;
      this.scrollOffset++;

      if (this.glitchActive) {
        this.glitchCountdown--;
        if (this.glitchCountdown <= 0) {
          this.glitchActive = false;
          this.tui.requestRender(); // Clear screen
        } else {
          this.tui.requestRender(); // Animate glitch
        }
      } else {
        // Randomly trigger glitch (approx every 2-10 seconds)
        if (Math.random() < 0.005) {
          this.glitchActive = true;
          // Glitch duration: 100ms to 800ms (3 to 25 frames)
          this.glitchCountdown = Math.floor(Math.random() * 22) + 3;
          this.tui.requestRender();
        }
      }
    }, 30); 
  }

  render(width: number): string[] {
    if (!this.glitchActive) {
        return [];
    }

    // Attempt to fill the entire screen
    const height = process.stdout.rows || 50;
    const lines: string[] = [];
    
    const chars = "█▓▒░@#&%$*!?/|\\";
    
    for (let i = 0; i < height; i++) {
      let line = "";
      
      // Create a scrolling effect by using (i + scrollOffset)
      const patternIndex = (i + this.scrollOffset) % 20;

      if (patternIndex === 0 || patternIndex === 10) {
         const text = " FLICKER CORP ";
         const repeatCount = Math.ceil(width / text.length) + 1;
         // Shift text horizontally
         const horizontalShift = (this.frame * 2) % text.length;
         const fullContent = text.repeat(repeatCount);
         line = fullContent.substring(horizontalShift, horizontalShift + width);
      } else {
         // Random noise generation
         for (let j = 0; j < width; j++) {
            if (Math.random() > 0.7) {
                line += chars[Math.floor(Math.random() * chars.length)];
            } else {
                line += " ";
            }
         }
      }

      // Intense random coloring
      const color = Math.floor(Math.random() * 6) + 31; // 31-36
      const bold = Math.random() > 0.5 ? ";1" : "";
      // Occasionally flash background
      const bg = Math.random() > 0.95 ? `;4${Math.floor(Math.random() * 6) + 1}` : "";
      
      line = `\x1b[${color}${bold}${bg}m${line}\x1b[0m`;

      lines.push(truncateToWidth(line, width));
    }

    return lines;
  }

  invalidate() {
    // Always invalid
  }

  dispose() {
    clearInterval(this.timer);
  }
}

export default function (pi: ExtensionAPI) {
  let active = false;

  const toggleFlicker = async (ctx: any) => {
    active = !active;
    
    if (active) {
      ctx.ui.notify("FULLSCREEN FLICKER!!! SCROLLING ENGAGED.", "success");
      ctx.ui.setWidget("flicker-corp", (tui: any, theme: any) => new FlickerComponent(tui, theme));
    } else {
      ctx.ui.notify("Flicker Corp shutting down.", "info");
      ctx.ui.setWidget("flicker-corp", undefined);
    }
  };

  pi.registerCommand("flicker-corp", {
    description: "Toggle the authentic FULLSCREEN FLICKER experience",
    handler: async (_args, ctx) => toggleFlicker(ctx),
  });
  
  // Also register a "signature-flicker" alias because branding
  pi.registerCommand("signature-flicker", {
      description: "Alias for flicker-corp",
      handler: async (_args, ctx) => toggleFlicker(ctx),
  });
}
