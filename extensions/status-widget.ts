/**
 * Status Widget Extension - Shows provider status in the footer
 * Automatically refreshes every 5 minutes
 * 
 * Shows: ✅ Claude ✅ OpenAI ⚠️ GitHub
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

// Status page URLs
const STATUS_URLS: Record<string, { url: string; name: string }> = {
	claude: { url: "https://status.anthropic.com/api/v2/status.json", name: "Claude" },
	openai: { url: "https://status.openai.com/api/v2/status.json", name: "OpenAI" },
	github: { url: "https://www.githubstatus.com/api/v2/status.json", name: "GitHub" },
};

interface ProviderStatus {
	name: string;
	indicator: "none" | "minor" | "major" | "critical" | "maintenance" | "unknown";
	description?: string;
}

async function fetchStatus(key: string, config: { url: string; name: string }): Promise<ProviderStatus> {
	try {
		const controller = new AbortController();
		setTimeout(() => controller.abort(), 5000);
		
		const res = await fetch(config.url, { signal: controller.signal });
		if (!res.ok) return { name: config.name, indicator: "unknown" };
		
		const data = await res.json() as any;
		return {
			name: config.name,
			indicator: (data.status?.indicator || "none") as ProviderStatus["indicator"],
			description: data.status?.description,
		};
	} catch {
		return { name: config.name, indicator: "unknown" };
	}
}

async function fetchGeminiStatus(): Promise<ProviderStatus> {
	try {
		const controller = new AbortController();
		setTimeout(() => controller.abort(), 5000);
		
		const res = await fetch("https://www.google.com/appsstatus/dashboard/incidents.json", {
			signal: controller.signal,
		});
		if (!res.ok) return { name: "Gemini", indicator: "unknown" };
		
		const incidents = await res.json() as any[];
		const geminiProductId = "npdyhgECDJ6tB66MxXyo";
		const active = incidents.filter((inc: any) => {
			if (inc.end) return false;
			const affected = inc.currently_affected_products || inc.affected_products || [];
			return affected.some((p: any) => p.id === geminiProductId);
		});
		
		if (active.length === 0) return { name: "Gemini", indicator: "none" };
		
		const severity = active.some((i: any) => i.status_impact === "SERVICE_OUTAGE") ? "critical"
			: active.some((i: any) => i.status_impact === "SERVICE_DISRUPTION") ? "major"
			: "minor";
		
		return { name: "Gemini", indicator: severity };
	} catch {
		return { name: "Gemini", indicator: "unknown" };
	}
}

function getStatusEmoji(indicator: ProviderStatus["indicator"]): string {
	switch (indicator) {
		case "none": return "✅";
		case "minor": return "⚠️";
		case "major": return "🟠";
		case "critical": return "🔴";
		case "maintenance": return "🔧";
		default: return "❓";
	}
}

async function fetchAllStatuses(): Promise<ProviderStatus[]> {
	const results = await Promise.all([
		fetchStatus("claude", STATUS_URLS.claude),
		fetchStatus("openai", STATUS_URLS.openai),
		fetchGeminiStatus(),
		fetchStatus("github", STATUS_URLS.github),
	]);
	return results;
}

function formatStatusLine(statuses: ProviderStatus[]): string {
	return statuses
		.map(s => `${getStatusEmoji(s.indicator)} ${s.name}`)
		.join("  ");
}

export default function (pi: ExtensionAPI) {
	let refreshInterval: ReturnType<typeof setInterval> | null = null;
	let currentCtx: any = null;
	let isEnabled = false;

	async function refreshStatus() {
		if (!currentCtx || !isEnabled) return;
		
		try {
			const statuses = await fetchAllStatuses();
			const line = formatStatusLine(statuses);
			currentCtx.ui.setStatus("provider-status", line);
		} catch {
			currentCtx.ui.setStatus("provider-status", "❓ Status check failed");
		}
	}

	function startWidget(ctx: any) {
		if (isEnabled) return;
		
		currentCtx = ctx;
		isEnabled = true;
		
		// Initial fetch
		refreshStatus();
		
		// Refresh every 5 minutes
		refreshInterval = setInterval(refreshStatus, 5 * 60 * 1000);
	}

	function stopWidget() {
		if (refreshInterval) {
			clearInterval(refreshInterval);
			refreshInterval = null;
		}
		if (currentCtx) {
			currentCtx.ui.setStatus("provider-status", undefined);
		}
		isEnabled = false;
	}

	// Auto-start on session start
	pi.on("session_start", async (_event, ctx) => {
		if (ctx.hasUI) {
			startWidget(ctx);
		}
	});

	// Cleanup on shutdown
	pi.on("session_shutdown", async () => {
		stopWidget();
	});

	// Toggle command
	pi.registerCommand("status", {
		description: "Toggle provider status widget in footer",
		handler: async (_args, ctx) => {
			if (isEnabled) {
				stopWidget();
				ctx.ui.notify("Status widget disabled", "info");
			} else {
				startWidget(ctx);
				ctx.ui.notify("Status widget enabled", "info");
			}
		},
	});

	// Manual refresh command
	pi.registerCommand("status-refresh", {
		description: "Refresh provider status now",
		handler: async (_args, ctx) => {
			if (!isEnabled) {
				startWidget(ctx);
			}
			await refreshStatus();
			ctx.ui.notify("Status refreshed", "info");
		},
	});
}
