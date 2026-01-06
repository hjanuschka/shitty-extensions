/**
 * Usage Bar Extension - Shows AI provider usage stats like CodexBar
 * Run /usage to see usage for Claude, Copilot, Gemini, and Codex
 * 
 * Features:
 * - Usage stats with progress bars
 * - Provider status (outages/incidents)
 * - Reset countdowns
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { visibleWidth } from "@mariozechner/pi-tui";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { execSync } from "node:child_process";

// ============================================================================
// Types
// ============================================================================

interface RateWindow {
	label: string;
	usedPercent: number;
	resetDescription?: string;
	resetsAt?: Date;
}

interface ProviderStatus {
	indicator: "none" | "minor" | "major" | "critical" | "maintenance" | "unknown";
	description?: string;
}

interface UsageSnapshot {
	provider: string;
	displayName: string;
	windows: RateWindow[];
	plan?: string;
	error?: string;
	status?: ProviderStatus;
}

// ============================================================================
// Status Polling
// ============================================================================

const STATUS_URLS: Record<string, string> = {
	anthropic: "https://status.anthropic.com/api/v2/status.json",
	codex: "https://status.openai.com/api/v2/status.json",
	copilot: "https://www.githubstatus.com/api/v2/status.json",
};

async function fetchProviderStatus(provider: string): Promise<ProviderStatus> {
	const url = STATUS_URLS[provider];
	if (!url) return { indicator: "none" };
	
	try {
		const controller = new AbortController();
		setTimeout(() => controller.abort(), 5000);
		
		const res = await fetch(url, { signal: controller.signal });
		if (!res.ok) return { indicator: "unknown" };
		
		const data = await res.json() as any;
		const indicator = data.status?.indicator || "none";
		const description = data.status?.description;
		
		return {
			indicator: indicator as ProviderStatus["indicator"],
			description,
		};
	} catch {
		return { indicator: "unknown" };
	}
}

async function fetchGeminiStatus(): Promise<ProviderStatus> {
	try {
		const controller = new AbortController();
		setTimeout(() => controller.abort(), 5000);
		
		const res = await fetch("https://www.google.com/appsstatus/dashboard/incidents.json", {
			signal: controller.signal,
		});
		if (!res.ok) return { indicator: "unknown" };
		
		const incidents = await res.json() as any[];
		
		// Look for active Gemini incidents (product ID: npdyhgECDJ6tB66MxXyo)
		const geminiProductId = "npdyhgECDJ6tB66MxXyo";
		const activeIncidents = incidents.filter((inc: any) => {
			if (inc.end) return false; // Not active
			const affected = inc.currently_affected_products || inc.affected_products || [];
			return affected.some((p: any) => p.id === geminiProductId);
		});
		
		if (activeIncidents.length === 0) {
			return { indicator: "none" };
		}
		
		// Find most severe
		let worstIndicator: ProviderStatus["indicator"] = "minor";
		let description: string | undefined;
		
		for (const inc of activeIncidents) {
			const status = inc.most_recent_update?.status || inc.status_impact;
			if (status === "SERVICE_OUTAGE") {
				worstIndicator = "critical";
				description = inc.external_desc;
			} else if (status === "SERVICE_DISRUPTION" && worstIndicator !== "critical") {
				worstIndicator = "major";
				description = inc.external_desc;
			}
		}
		
		return { indicator: worstIndicator, description };
	} catch {
		return { indicator: "unknown" };
	}
}

// ============================================================================
// Claude Usage
// ============================================================================

function loadClaudeToken(): string | undefined {
	// Try pi's auth.json first (has user:profile scope)
	const piAuthPath = path.join(os.homedir(), ".pi", "agent", "auth.json");
	try {
		if (fs.existsSync(piAuthPath)) {
			const data = JSON.parse(fs.readFileSync(piAuthPath, "utf-8"));
			if (data.anthropic?.access) return data.anthropic.access;
		}
	} catch {}

	// Fallback to Claude CLI keychain (macOS)
	try {
		const keychainData = execSync(
			'security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null',
			{ encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
		).trim();
		if (keychainData) {
			const parsed = JSON.parse(keychainData);
			const scopes = parsed.claudeAiOauth?.scopes || [];
			if (scopes.includes("user:profile") && parsed.claudeAiOauth?.accessToken) {
				return parsed.claudeAiOauth.accessToken;
			}
		}
	} catch {}

	return undefined;
}

async function fetchClaudeUsage(): Promise<UsageSnapshot> {
	const token = loadClaudeToken();
	if (!token) {
		return { provider: "anthropic", displayName: "Claude", windows: [], error: "No credentials" };
	}

	try {
		const controller = new AbortController();
		setTimeout(() => controller.abort(), 5000);

		const res = await fetch("https://api.anthropic.com/api/oauth/usage", {
			headers: {
				Authorization: `Bearer ${token}`,
				"anthropic-beta": "oauth-2025-04-20",
			},
			signal: controller.signal,
		});

		if (!res.ok) {
			return { provider: "anthropic", displayName: "Claude", windows: [], error: `HTTP ${res.status}` };
		}

		const data = await res.json() as any;
		const windows: RateWindow[] = [];

		if (data.five_hour?.utilization !== undefined) {
			windows.push({
				label: "5h",
				usedPercent: data.five_hour.utilization,
				resetDescription: data.five_hour.resets_at ? formatReset(new Date(data.five_hour.resets_at)) : undefined,
			});
		}

		if (data.seven_day?.utilization !== undefined) {
			windows.push({
				label: "Week",
				usedPercent: data.seven_day.utilization,
				resetDescription: data.seven_day.resets_at ? formatReset(new Date(data.seven_day.resets_at)) : undefined,
			});
		}

		const modelWindow = data.seven_day_sonnet || data.seven_day_opus;
		if (modelWindow?.utilization !== undefined) {
			windows.push({
				label: data.seven_day_sonnet ? "Sonnet" : "Opus",
				usedPercent: modelWindow.utilization,
			});
		}

		return { provider: "anthropic", displayName: "Claude", windows };
	} catch (e) {
		return { provider: "anthropic", displayName: "Claude", windows: [], error: String(e) };
	}
}

// ============================================================================
// Copilot Usage
// ============================================================================

function loadCopilotToken(): string | undefined {
	const authPath = path.join(os.homedir(), ".pi", "agent", "auth.json");
	try {
		if (fs.existsSync(authPath)) {
			const data = JSON.parse(fs.readFileSync(authPath, "utf-8"));
			if (data["github-copilot"]?.access) return data["github-copilot"].access;
		}
	} catch {}

	try {
		return execSync("gh auth token 2>/dev/null", { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
	} catch {}

	return undefined;
}

async function fetchCopilotUsage(): Promise<UsageSnapshot> {
	const token = loadCopilotToken();
	if (!token) {
		return { provider: "copilot", displayName: "Copilot", windows: [], error: "No token" };
	}

	try {
		const controller = new AbortController();
		setTimeout(() => controller.abort(), 5000);

		const res = await fetch("https://api.github.com/copilot_internal/user", {
			headers: {
				Authorization: `token ${token}`,
				"Editor-Version": "vscode/1.96.2",
				"User-Agent": "GitHubCopilotChat/0.26.7",
				"X-Github-Api-Version": "2025-04-01",
			},
			signal: controller.signal,
		});

		if (!res.ok) {
			return { provider: "copilot", displayName: "Copilot", windows: [], error: `HTTP ${res.status}` };
		}

		const data = await res.json() as any;
		const windows: RateWindow[] = [];

		if (data.quota_snapshots?.premium_interactions) {
			windows.push({
				label: "Premium",
				usedPercent: Math.max(0, 100 - (data.quota_snapshots.premium_interactions.percent_remaining || 0)),
			});
		}

		if (data.quota_snapshots?.chat) {
			windows.push({
				label: "Chat",
				usedPercent: Math.max(0, 100 - (data.quota_snapshots.chat.percent_remaining || 0)),
			});
		}

		return {
			provider: "copilot",
			displayName: "Copilot",
			windows,
			plan: data.copilot_plan,
		};
	} catch (e) {
		return { provider: "copilot", displayName: "Copilot", windows: [], error: String(e) };
	}
}

// ============================================================================
// Gemini Usage
// ============================================================================

async function fetchGeminiUsage(_modelRegistry: any): Promise<UsageSnapshot> {
	let token: string | undefined;
	
	// Read directly from pi's auth.json
	const piAuthPath = path.join(os.homedir(), ".pi", "agent", "auth.json");
	try {
		if (fs.existsSync(piAuthPath)) {
			const data = JSON.parse(fs.readFileSync(piAuthPath, "utf-8"));
			token = data["google-gemini-cli"]?.access;
		}
	} catch {}
	
	// Fallback to ~/.gemini/oauth_creds.json
	if (!token) {
		const credPath = path.join(os.homedir(), ".gemini", "oauth_creds.json");
		try {
			if (fs.existsSync(credPath)) {
				const data = JSON.parse(fs.readFileSync(credPath, "utf-8"));
				token = data.access_token;
			}
		} catch {}
	}
	
	if (!token) {
		return { provider: "gemini", displayName: "Gemini", windows: [], error: "No credentials" };
	}

	try {
		const controller = new AbortController();
		setTimeout(() => controller.abort(), 5000);

		const res = await fetch("https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota", {
			method: "POST",
			headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
			body: "{}",
			signal: controller.signal,
		});

		if (!res.ok) {
			return { provider: "gemini", displayName: "Gemini", windows: [], error: `HTTP ${res.status}` };
		}

		const data = await res.json() as any;
		const quotas: Record<string, number> = {};

		for (const bucket of data.buckets || []) {
			const model = bucket.modelId || "unknown";
			const frac = bucket.remainingFraction ?? 1;
			if (!quotas[model] || frac < quotas[model]) quotas[model] = frac;
		}

		const windows: RateWindow[] = [];
		let proMin = 1, flashMin = 1;
		let hasProModel = false, hasFlashModel = false;

		for (const [model, frac] of Object.entries(quotas)) {
			if (model.toLowerCase().includes("pro")) {
				hasProModel = true;
				if (frac < proMin) proMin = frac;
			}
			if (model.toLowerCase().includes("flash")) {
				hasFlashModel = true;
				if (frac < flashMin) flashMin = frac;
			}
		}

		// Always show windows if model exists (even at 0% usage)
		if (hasProModel) windows.push({ label: "Pro", usedPercent: (1 - proMin) * 100 });
		if (hasFlashModel) windows.push({ label: "Flash", usedPercent: (1 - flashMin) * 100 });

		return { provider: "gemini", displayName: "Gemini", windows };
	} catch (e) {
		return { provider: "gemini", displayName: "Gemini", windows: [], error: String(e) };
	}
}

// ============================================================================
// Codex (OpenAI) Usage
// ============================================================================

async function fetchCodexUsage(modelRegistry: any): Promise<UsageSnapshot> {
	// Try to get token from pi's auth storage first
	let accessToken: string | undefined;
	let accountId: string | undefined;
	
	try {
		// Try openai-codex provider first (pi's built-in)
		accessToken = await modelRegistry?.authStorage?.getApiKey?.("openai-codex");
		
		// Get account ID if available from OAuth credentials
		const cred = modelRegistry?.authStorage?.get?.("openai-codex");
		if (cred?.type === "oauth") {
			accountId = (cred as any).accountId;
		}
	} catch {}
	
	// Fallback to ~/.codex/auth.json if not in pi's auth
	if (!accessToken) {
		const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
		const authPath = path.join(codexHome, "auth.json");
		
		try {
			if (fs.existsSync(authPath)) {
				const data = JSON.parse(fs.readFileSync(authPath, "utf-8"));
				
				if (data.OPENAI_API_KEY) {
					accessToken = data.OPENAI_API_KEY;
				} else if (data.tokens?.access_token) {
					accessToken = data.tokens.access_token;
					accountId = data.tokens.account_id;
				}
			}
		} catch {}
	}
	
	if (!accessToken) {
		return { provider: "codex", displayName: "Codex", windows: [], error: "No credentials" };
	}

	try {
		const controller = new AbortController();
		setTimeout(() => controller.abort(), 5000);

		const headers: Record<string, string> = {
			Authorization: `Bearer ${accessToken}`,
			"User-Agent": "CodexBar",
			Accept: "application/json",
		};
		
		if (accountId) {
			headers["ChatGPT-Account-Id"] = accountId;
		}

		const res = await fetch("https://chatgpt.com/backend-api/wham/usage", {
			method: "GET",
			headers,
			signal: controller.signal,
		});

		if (res.status === 401 || res.status === 403) {
			return { provider: "codex", displayName: "Codex", windows: [], error: "Token expired" };
		}

		if (!res.ok) {
			return { provider: "codex", displayName: "Codex", windows: [], error: `HTTP ${res.status}` };
		}

		const data = await res.json() as any;
		const windows: RateWindow[] = [];

		// Primary window (usually 3-hour)
		if (data.rate_limit?.primary_window) {
			const pw = data.rate_limit.primary_window;
			const resetDate = pw.reset_at ? new Date(pw.reset_at * 1000) : undefined;
			const windowHours = Math.round((pw.limit_window_seconds || 10800) / 3600);
			windows.push({
				label: `${windowHours}h`,
				usedPercent: pw.used_percent || 0,
				resetDescription: resetDate ? formatReset(resetDate) : undefined,
			});
		}

		// Secondary window (usually daily)
		if (data.rate_limit?.secondary_window) {
			const sw = data.rate_limit.secondary_window;
			const resetDate = sw.reset_at ? new Date(sw.reset_at * 1000) : undefined;
			const windowHours = Math.round((sw.limit_window_seconds || 86400) / 3600);
			const label = windowHours >= 24 ? "Day" : `${windowHours}h`;
			windows.push({
				label,
				usedPercent: sw.used_percent || 0,
				resetDescription: resetDate ? formatReset(resetDate) : undefined,
			});
		}

		// Credits info
		let plan = data.plan_type;
		if (data.credits?.balance !== undefined && data.credits.balance !== null) {
			const balance = typeof data.credits.balance === 'number' 
				? data.credits.balance 
				: parseFloat(data.credits.balance) || 0;
			plan = plan ? `${plan} ($${balance.toFixed(2)})` : `$${balance.toFixed(2)}`;
		}

		return { provider: "codex", displayName: "Codex", windows, plan };
	} catch (e) {
		return { provider: "codex", displayName: "Codex", windows: [], error: String(e) };
	}
}

// ============================================================================
// Helpers
// ============================================================================

function formatReset(date: Date): string {
	const diffMs = date.getTime() - Date.now();
	if (diffMs < 0) return "now";
	
	const diffMins = Math.floor(diffMs / 60000);
	if (diffMins < 60) return `${diffMins}m`;
	
	const hours = Math.floor(diffMins / 60);
	const mins = diffMins % 60;
	if (hours < 24) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
	
	const days = Math.floor(hours / 24);
	if (days < 7) return `${days}d ${hours % 24}h`;
	
	return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function getStatusEmoji(status?: ProviderStatus): string {
	if (!status) return "";
	switch (status.indicator) {
		case "none": return "✅";
		case "minor": return "⚠️";
		case "major": return "🟠";
		case "critical": return "🔴";
		case "maintenance": return "🔧";
		default: return "";
	}
}

// ============================================================================
// UI Component
// ============================================================================

class UsageComponent {
	private usages: UsageSnapshot[] = [];
	private loading = true;
	private tui: { requestRender: () => void };
	private theme: any;
	private onClose: () => void;
	private modelRegistry: any;

	constructor(tui: { requestRender: () => void }, theme: any, onClose: () => void, modelRegistry: any) {
		this.tui = tui;
		this.theme = theme;
		this.onClose = onClose;
		this.modelRegistry = modelRegistry;
		this.load();
	}

	private async load() {
		const timeout = <T>(p: Promise<T>, ms: number, fallback: T) =>
			Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);

		// Fetch usage and status in parallel
		const [claude, copilot, gemini, codex, claudeStatus, copilotStatus, geminiStatus, codexStatus] = await Promise.all([
			timeout(fetchClaudeUsage(), 6000, { provider: "anthropic", displayName: "Claude", windows: [], error: "Timeout" }),
			timeout(fetchCopilotUsage(), 6000, { provider: "copilot", displayName: "Copilot", windows: [], error: "Timeout" }),
			timeout(fetchGeminiUsage(this.modelRegistry), 6000, { provider: "gemini", displayName: "Gemini", windows: [], error: "Timeout" }),
			timeout(fetchCodexUsage(this.modelRegistry), 6000, { provider: "codex", displayName: "Codex", windows: [], error: "Timeout" }),
			timeout(fetchProviderStatus("anthropic"), 3000, { indicator: "unknown" as const }),
			timeout(fetchProviderStatus("copilot"), 3000, { indicator: "unknown" as const }),
			timeout(fetchGeminiStatus(), 3000, { indicator: "unknown" as const }),
			timeout(fetchProviderStatus("codex"), 3000, { indicator: "unknown" as const }),
		]);

		// Attach status to usage
		claude.status = claudeStatus;
		copilot.status = copilotStatus;
		gemini.status = geminiStatus;
		codex.status = codexStatus;

		this.usages = [claude, copilot, gemini, codex];
		this.loading = false;
		this.tui.requestRender();
	}

	handleInput(_data: string): void {
		this.onClose();
	}

	invalidate(): void {}

	render(width: number): string[] {
		const t = this.theme;
		const dim = (s: string) => t.fg("muted", s);
		const bold = (s: string) => t.bold(s);
		const accent = (s: string) => t.fg("accent", s);

		// Box dimensions: total width includes borders
		const totalW = Math.min(55, width - 4);
		const innerW = totalW - 4; // subtract "│ " and " │"
		const hLine = "─".repeat(totalW - 2); // subtract corners

		const box = (content: string) => {
			const contentW = visibleWidth(content);
			const pad = Math.max(0, innerW - contentW);
			return dim("│ ") + content + " ".repeat(pad) + dim(" │");
		};

		const lines: string[] = [];
		lines.push(dim(`╭${hLine}╮`));
		lines.push(box(bold(accent("AI Usage"))));
		lines.push(dim(`├${hLine}┤`));

		if (this.loading) {
			lines.push(box("Loading..."));
		} else {
			for (const u of this.usages) {
				// Provider header with status emoji and plan
				const statusEmoji = getStatusEmoji(u.status);
				const planStr = u.plan ? dim(` (${u.plan})`) : "";
				const statusStr = statusEmoji ? ` ${statusEmoji}` : "";
				lines.push(box(bold(u.displayName) + planStr + statusStr));

				// Show incident description if any
				if (u.status?.indicator && u.status.indicator !== "none" && u.status.indicator !== "unknown" && u.status.description) {
					const desc = u.status.description.length > 40 
						? u.status.description.substring(0, 37) + "..." 
						: u.status.description;
					lines.push(box(t.fg("warning", `  ⚡ ${desc}`)));
				}

				if (u.error) {
					lines.push(box(dim(`  ${u.error}`)));
				} else if (u.windows.length === 0) {
					lines.push(box(dim("  No data")));
				} else {
					for (const w of u.windows) {
						const remaining = Math.max(0, 100 - w.usedPercent);
						const barW = 12;
						const filled = Math.round((w.usedPercent / 100) * barW);
						const empty = barW - filled;
						const color = remaining <= 10 ? "error" : remaining <= 30 ? "warning" : "success";
						const bar = t.fg(color, "█".repeat(filled)) + dim("░".repeat(empty));
						const reset = w.resetDescription ? dim(` ⏱${w.resetDescription}`) : "";
						lines.push(box(`  ${w.label.padEnd(7)} ${bar} ${remaining.toFixed(0).padStart(3)}%${reset}`));
					}
				}
				lines.push(box(""));
			}
		}

		lines.push(dim(`├${hLine}┤`));
		lines.push(box(dim("Press any key to close")));
		lines.push(dim(`╰${hLine}╯`));

		return lines;
	}

	dispose(): void {}
}

// ============================================================================
// Hook
// ============================================================================

export default function (pi: ExtensionAPI) {
	pi.registerCommand("usage", {
		description: "Show AI provider usage statistics",
		handler: async (_args, ctx) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("Usage requires interactive mode", "error");
				return;
			}

			const modelRegistry = ctx.modelRegistry;
			await ctx.ui.custom((tui, theme, done) => {
				return new UsageComponent(tui, theme, () => done(undefined), modelRegistry);
			});
		},
	});
}
