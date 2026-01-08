/**
 * Memory Mode Extension
 *
 * Save instructions to AGENTS.md files with AI-assisted integration.
 *
 * Features:
 * - /mem command opens a text input for your instruction
 * - Choose save location: Project Local, Project, or Global
 * - AI integrates instruction into existing file structure
 * - Preview changes before saving with YES/NO confirmation
 * - AGENTS.local.md auto-added to .gitignore
 *
 * Usage:
 * 1. Copy this file to ~/.pi/agent/extensions/ or your project's .pi/extensions/
 * 2. Type /mem and enter your instruction
 *
 * Example:
 *   /mem → "Never use git commands directly" → Select location → Preview → Save
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { completeSimple } from "@mariozechner/pi-ai";
import type { ExtensionAPI, ExtensionContext, Theme } from "@mariozechner/pi-coding-agent";
import { type TUI, matchesKey, Key, truncateToWidth, wrapTextWithAnsi } from "@mariozechner/pi-tui";

// Spinner frames for loading animation
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

/**
 * Custom component that shows:
 * 1. A spinner while AI is processing
 * 2. A preview of the content with YES/NO selection
 */
class MemoryPreviewComponent {
	private tui: TUI;
	private theme: Theme;
	private filePath: string;
	private state: "loading" | "preview" = "loading";
	private content: string = "";
	private selectedOption: "yes" | "no" = "yes";
	private spinnerFrame = 0;
	private spinnerInterval: ReturnType<typeof setInterval> | null = null;
	private abortController = new AbortController();
	private cachedLines: string[] = [];
	private cachedWidth = 0;

	public onDone?: (result: { save: boolean; content: string } | null) => void;

	constructor(tui: TUI, theme: Theme, filePath: string) {
		this.tui = tui;
		this.theme = theme;
		this.filePath = filePath;
		this.startSpinner();
	}

	get signal(): AbortSignal {
		return this.abortController.signal;
	}

	private startSpinner(): void {
		this.spinnerInterval = setInterval(() => {
			this.spinnerFrame = (this.spinnerFrame + 1) % SPINNER_FRAMES.length;
			this.invalidate();
			this.tui.requestRender();
		}, 80);
	}

	private stopSpinner(): void {
		if (this.spinnerInterval) {
			clearInterval(this.spinnerInterval);
			this.spinnerInterval = null;
		}
	}

	setContent(content: string): void {
		this.stopSpinner();
		this.content = content;
		this.state = "preview";
		this.invalidate();
		this.tui.requestRender();
	}

	setError(error: string): void {
		this.stopSpinner();
		this.onDone?.(null);
	}

	handleInput(data: string): void {
		if (matchesKey(data, Key.escape)) {
			this.abortController.abort();
			this.dispose();
			this.onDone?.(null);
			return;
		}

		if (this.state === "preview") {
			if (matchesKey(data, Key.left) || matchesKey(data, Key.right) || matchesKey(data, "tab")) {
				this.selectedOption = this.selectedOption === "yes" ? "no" : "yes";
				this.invalidate();
				this.tui.requestRender();
			} else if (matchesKey(data, Key.enter)) {
				this.dispose();
				this.onDone?.({ save: this.selectedOption === "yes", content: this.content });
			} else if (data === "y" || data === "Y") {
				this.dispose();
				this.onDone?.({ save: true, content: this.content });
			} else if (data === "n" || data === "N") {
				this.dispose();
				this.onDone?.({ save: false, content: this.content });
			}
		}
	}

	invalidate(): void {
		this.cachedWidth = 0;
		this.cachedLines = [];
	}

	render(width: number): string[] {
		if (this.cachedWidth === width && this.cachedLines.length > 0) {
			return this.cachedLines;
		}

		const lines: string[] = [];
		const contentWidth = Math.max(40, width - 4);

		if (this.state === "loading") {
			// Show spinner
			const spinner = this.theme.fg("accent", SPINNER_FRAMES[this.spinnerFrame]);
			const message = this.theme.fg("muted", " Integrating instruction with AI...");
			lines.push("");
			lines.push(truncateToWidth(`  ${spinner}${message}`, width));
			lines.push("");
			lines.push(truncateToWidth(this.theme.fg("dim", "  Press ESC to cancel"), width));
			lines.push("");
		} else {
			// Show preview with YES/NO
			lines.push("");
			lines.push(truncateToWidth(this.theme.fg("accent", "  📄 ") + this.theme.bold(this.filePath), width));
			lines.push(truncateToWidth(this.theme.fg("dim", "  " + "─".repeat(Math.min(60, contentWidth))), width));
			lines.push("");

			// Wrap and display content (limit to ~15 lines for preview)
			const contentLines = this.content.split("\n");
			let displayedLines = 0;
			const maxLines = 15;

			for (const line of contentLines) {
				if (displayedLines >= maxLines) {
					lines.push(truncateToWidth(this.theme.fg("dim", "  ... (content truncated)"), width));
					break;
				}
				const wrapped = wrapTextWithAnsi(line, contentWidth - 4);
				for (const wrappedLine of wrapped) {
					if (displayedLines >= maxLines) break;
					lines.push(truncateToWidth("  " + wrappedLine, width));
					displayedLines++;
				}
			}

			lines.push("");
			lines.push(truncateToWidth(this.theme.fg("dim", "  " + "─".repeat(Math.min(60, contentWidth))), width));
			lines.push("");

			// YES/NO buttons
			const yesBtn = this.selectedOption === "yes"
				? this.theme.bg("selectedBg", this.theme.fg("success", " ✓ YES "))
				: this.theme.fg("dim", "   YES  ");
			const noBtn = this.selectedOption === "no"
				? this.theme.bg("selectedBg", this.theme.fg("error", " ✗ NO "))
				: this.theme.fg("dim", "   NO   ");

			lines.push(truncateToWidth(`  Save changes?  ${yesBtn}  ${noBtn}`, width));
			lines.push("");
			lines.push(truncateToWidth(this.theme.fg("dim", "  ←/→ to select, Enter to confirm, ESC to cancel"), width));
			lines.push("");
		}

		this.cachedWidth = width;
		this.cachedLines = lines;
		return lines;
	}

	dispose(): void {
		this.stopSpinner();
	}
}

/**
 * Simple diff: find lines that were added (in new but not in old)
 */
function getAddedLines(oldContent: string, newContent: string): string[] {
	const oldLines = new Set(oldContent.split("\n").map(l => l.trim()).filter(l => l.length > 0));
	const newLines = newContent.split("\n");
	
	const added: string[] = [];
	for (const line of newLines) {
		const trimmed = line.trim();
		if (trimmed.length > 0 && !oldLines.has(trimmed)) {
			added.push(line);
		}
	}
	return added;
}

interface SaveLocation {
	value: "local" | "project" | "global";
	label: string;
	description: string;
	filePath: string;
}

export default function (pi: ExtensionAPI) {
	// Register /mem command
	pi.registerCommand("mem", {
		description: "Save an instruction to AGENTS.md (AI-assisted)",
		handler: async (_args, ctx) => {
			// Step 1: Text Input - Get the instruction from user
			const instruction = await ctx.ui.input("Memory instruction:", "e.g., never use git commands");

			if (!instruction || !instruction.trim()) {
				return; // User cancelled or empty input
			}

			// Continue with the memory instruction flow
			await handleMemoryInstruction(pi, ctx, instruction.trim());
		},
	});

	// Also register /remember as an alias
	pi.registerCommand("remember", {
		description: "Save an instruction to AGENTS.md (alias for /mem)",
		handler: async (_args, ctx) => {
			const instruction = await ctx.ui.input("Memory instruction:", "e.g., always use TypeScript strict mode");

			if (!instruction || !instruction.trim()) {
				return;
			}

			await handleMemoryInstruction(pi, ctx, instruction.trim());
		},
	});
}

async function handleMemoryInstruction(pi: ExtensionAPI, ctx: ExtensionContext, instruction: string): Promise<void> {
	const cwd = ctx.cwd;
	const agentDir = getAgentDir();

	// Step 2: Location Selector - Build list of save locations
	const locations: SaveLocation[] = [
		{
			value: "local",
			label: "Project Local",
			description: `${path.join(cwd, "AGENTS.local.md")} (gitignored, just for you)`,
			filePath: path.join(cwd, "AGENTS.local.md"),
		},
		{
			value: "project",
			label: "Project",
			description: `${path.join(cwd, "AGENTS.md")} (shared with team)`,
			filePath: path.join(cwd, "AGENTS.md"),
		},
		{
			value: "global",
			label: "Global",
			description: `${path.join(agentDir, "AGENTS.md")} (all your projects)`,
			filePath: path.join(agentDir, "AGENTS.md"),
		},
	];

	// Show location selector
	const selected = await ctx.ui.select(
		"Save instruction to:",
		locations.map((loc) => `${loc.label} - ${loc.description}`),
	);

	if (!selected) {
		return; // User cancelled
	}

	// Find the selected location
	const location = locations.find((loc) => selected.startsWith(loc.label));
	if (!location) {
		return;
	}

	// Read existing content
	let existingContent = "";
	if (fs.existsSync(location.filePath)) {
		existingContent = fs.readFileSync(location.filePath, "utf-8");
	}

	// Get model and API key
	const model = ctx.model;
	if (!model) {
		ctx.ui.notify("No model selected", "error");
		return;
	}

	const apiKey = await ctx.modelRegistry.getApiKey(model);
	if (!apiKey) {
		ctx.ui.notify("No API key available for current model", "error");
		return;
	}

	// Step 3 & 4: AI Processing with spinner, then Preview with YES/NO
	const result = await ctx.ui.custom<{ save: boolean; content: string } | null>((tui, theme, _kb, done) => {
		const component = new MemoryPreviewComponent(tui, theme, location.filePath);
		component.onDone = done;

		// Call AI to integrate the instruction (fire-and-forget, don't await)
		const systemPrompt = `You are helping to maintain an AGENTS.md file that provides instructions for an AI coding assistant.

Your task is to integrate a new instruction into the existing file content. Follow these rules:
- If the file is empty, create a well-structured markdown document with the instruction
- If the file has existing content, integrate the new instruction in the most appropriate location
- Group related instructions together under appropriate headings
- Avoid duplicating instructions - if a similar one exists, update it instead
- Maintain consistent formatting with the existing content
- Keep the file concise and well-organized
- Output ONLY the final file content, no explanations or markdown code fences`;

		const userPrompt = existingContent
			? `Here is the existing AGENTS.md content:

\`\`\`markdown
${existingContent}
\`\`\`

Please integrate this new instruction:
${instruction}

Output the complete updated file content:`
			: `The AGENTS.md file is currently empty. Please create it with this instruction:
${instruction}

Output the complete file content:`;

		// Fire-and-forget async work
		const doWork = async () => {
			const response = await completeSimple(
				model,
				{
					systemPrompt,
					messages: [{ role: "user", content: [{ type: "text", text: userPrompt }], timestamp: Date.now() }],
				},
				{ apiKey, signal: component.signal, maxTokens: 4096 },
			);

			if (response.stopReason === "aborted") {
				return null;
			}

			if (response.stopReason === "error") {
				throw new Error(response.errorMessage || "AI request failed");
			}

			// Extract the new content from AI response
			let content = response.content
				.filter((c): c is { type: "text"; text: string } => c.type === "text")
				.map((c) => c.text)
				.join("\n")
				.trim();

			// Remove markdown code fences if present
			if (content.startsWith("```markdown")) {
				content = content.slice(11);
			} else if (content.startsWith("```")) {
				content = content.slice(3);
			}
			if (content.endsWith("```")) {
				content = content.slice(0, -3);
			}
			return content.trim();
		};

		doWork()
			.then((content) => {
				if (content) {
					component.setContent(content);
				} else {
					component.setError("Cancelled");
				}
			})
			.catch((error) => {
				ctx.ui.notify(`Failed: ${error instanceof Error ? error.message : "Unknown error"}`, "error");
				done(null);
			});

		return component;
	});

	if (!result || !result.save) {
		return; // User cancelled or chose NO
	}

	// Save the file
	const newContent = result.content;
	
	// Ensure directory exists
	const dir = path.dirname(location.filePath);
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}

	// Write the file
	fs.writeFileSync(location.filePath, newContent);

	// If it's AGENTS.local.md, ensure it's in .gitignore
	if (location.value === "local") {
		ensureGitignore(cwd, "AGENTS.local.md");
	}

	// Show what was added with colored diff
	const addedLines = getAddedLines(existingContent, newContent);
	if (addedLines.length > 0) {
		const diffDisplay = addedLines.map(line => `+ ${line}`).join("\n");
		pi.sendMessage({
			customType: "memory-saved",
			content: `✅ **Saved to ${location.filePath}**\n\n\`\`\`diff\n${diffDisplay}\n\`\`\``,
			display: true,
		});
	} else {
		pi.sendMessage({
			customType: "memory-saved", 
			content: `✅ **Saved to ${location.filePath}**\n\n_(No new lines added - content was reorganized)_`,
			display: true,
		});
	}
}

function getAgentDir(): string {
	const envDir = process.env.PI_CODING_AGENT_DIR;
	if (envDir) {
		return envDir;
	}
	const home = process.env.HOME || process.env.USERPROFILE || "";
	return path.join(home, ".pi", "agent");
}

function ensureGitignore(cwd: string, filename: string): void {
	const gitignorePath = path.join(cwd, ".gitignore");
	try {
		let content = "";
		if (fs.existsSync(gitignorePath)) {
			content = fs.readFileSync(gitignorePath, "utf-8");
		}

		// Check if already in .gitignore
		const lines = content.split("\n");
		if (lines.some((line) => line.trim() === filename)) {
			return;
		}

		// Add to .gitignore
		const newContent = `${content.trimEnd()}${content.endsWith("\n") ? "" : "\n"}${filename}\n`;
		fs.writeFileSync(gitignorePath, newContent);
	} catch {
		// Ignore errors - gitignore update is best-effort
	}
}
