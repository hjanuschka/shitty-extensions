/**
 * Clipboard Extension
 *
 * Provides a tool that allows the LLM to copy text to the user's clipboard
 * using OSC52 escape sequences. This works across SSH sessions and most
 * modern terminal emulators.
 *
 * Usage:
 *   Ask the LLM: "write me a draft reply and put it into clipboard!"
 */

import { Type } from "@sinclair/typebox";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

/**
 * Encode text to base64 for OSC52
 */
function toBase64(text: string): string {
	return Buffer.from(text, "utf-8").toString("base64");
}

/**
 * Copy text to clipboard using OSC52 escape sequence.
 * OSC52 is supported by most modern terminal emulators including:
 * - iTerm2, Kitty, Alacritty, WezTerm, foot, Windows Terminal
 * - tmux (with set-clipboard on), screen (with proper config)
 */
function copyToClipboard(text: string): void {
	const base64Text = toBase64(text);
	// OSC 52 ; c ; <base64-text> ST
	// \x1b] = OSC (Operating System Command)
	// 52 = clipboard operation
	// c = clipboard selection (could also be p for primary, s for secondary)
	// \x07 = ST (String Terminator) - also \x1b\\ works
	const osc52 = `\x1b]52;c;${base64Text}\x07`;
	process.stdout.write(osc52);
}

export default function clipboardExtension(pi: ExtensionAPI): void {
	pi.registerTool({
		name: "copy_to_clipboard",
		label: "Copy to Clipboard",
		description:
			"Copy text to the user's system clipboard. Use this when the user asks you to " +
			"put something in their clipboard, write a draft reply to clipboard, or copy any " +
			"generated text for easy pasting. The text will be available for pasting immediately.",
		parameters: Type.Object({
			text: Type.String({
				description: "The text to copy to the clipboard",
			}),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const { text } = params as { text: string };

			if (!text || text.trim().length === 0) {
				return {
					content: [{ type: "text", text: "Error: No text provided to copy." }],
					details: { success: false, error: "empty_text" },
				};
			}

			try {
				copyToClipboard(text);

				const preview = text.length > 100 ? `${text.slice(0, 100)}...` : text;
				const charCount = text.length;

				if (ctx.hasUI) {
					ctx.ui.notify(`Copied ${charCount} characters to clipboard`, "info");
				}

				return {
					content: [
						{
							type: "text",
							text: `Successfully copied ${charCount} characters to clipboard.\n\nPreview:\n${preview}`,
						},
					],
					details: {
						success: true,
						characterCount: charCount,
						preview,
					},
				};
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : "Unknown error";
				return {
					content: [{ type: "text", text: `Failed to copy to clipboard: ${errorMessage}` }],
					details: { success: false, error: errorMessage },
				};
			}
		},
	});
}
