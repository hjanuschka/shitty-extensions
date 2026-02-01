/**
 * Plan Mode Extension - Kickass Plan Management
 *
 * Inspired by mitsuhiko's todo extension, this provides:
 * - File-based plans stored in .pi/plans/ as markdown files
 * - A `plan` custom tool the LLM can call to manage plans and steps
 * - Interactive /plan command with selection, action menus, detail overlays
 * - Plan assignment/locking to prevent conflicts across sessions
 * - Beautiful TUI rendering with custom renderCall/renderResult
 * - Read-only "planning mode" for safe exploration before execution
 *
 * Plan storage format (JSON frontmatter + markdown body):
 * {
 *   "id": "deadbeef",
 *   "title": "Refactor auth module",
 *   "status": "active",
 *   "created_at": "2026-01-26T08:00:00.000Z",
 *   "assigned_to_session": "session.json",
 *   "steps": [
 *     { "id": 1, "text": "Read existing code", "done": false },
 *     { "id": 2, "text": "Write tests", "done": true }
 *   ]
 * }
 *
 * Optional markdown body with additional notes.
 *
 * Usage:
 * 1. /plan to open plan manager
 * 2. /plan on to enter planning mode (read-only)
 * 3. /plan off to exit planning mode
 * 4. LLM can use `plan` tool to create/update/execute plans
 * 5. Ctrl+X to toggle planning mode
 */

import type { ExtensionAPI, ExtensionContext, Theme } from "@mariozechner/pi-coding-agent";
import { DynamicBorder, keyHint, getMarkdownTheme } from "@mariozechner/pi-coding-agent";
import { StringEnum } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";
import path from "node:path";
import fs from "node:fs/promises";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import crypto from "node:crypto";
import {
	Container,
	type Focusable,
	Input,
	Key,
	Markdown,
	SelectList,
	Spacer,
	type SelectItem,
	Text,
	TUI,
	fuzzyMatch,
	getEditorKeybindings,
	matchesKey,
	truncateToWidth,
	visibleWidth,
} from "@mariozechner/pi-tui";

// Configuration
const PLAN_DIR_NAME = ".pi/plans";
const PLAN_PATH_ENV = "PI_PLAN_PATH";
const PLAN_SETTINGS_NAME = "settings.json";
const PLAN_ID_PREFIX = "PLAN-";
const PLAN_ID_PATTERN = /^[a-f0-9]{8}$/i;
const LOCK_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Read-only tools for planning mode
const PLAN_MODE_TOOLS = ["read", "bash", "grep", "find", "ls", "plan"];

// Full set of tools for normal mode
const NORMAL_MODE_TOOLS = ["read", "bash", "edit", "write"];

// Patterns for destructive bash commands blocked in planning mode
const DESTRUCTIVE_PATTERNS = [
	/\brm\b/i, /\brmdir\b/i, /\bmv\b/i, /\bcp\b/i, /\bmkdir\b/i, /\btouch\b/i,
	/\bchmod\b/i, /\bchown\b/i, /\bchgrp\b/i, /\bln\b/i, /\btee\b/i,
	/\btruncate\b/i, /\bdd\b/i, /\bshred\b/i,
	/[^<]>(?!>)/, />>/,
	/\bnpm\s+(install|uninstall|update|ci|link|publish)/i,
	/\byarn\s+(add|remove|install|publish)/i,
	/\bpnpm\s+(add|remove|install|publish)/i,
	/\bpip\s+(install|uninstall)/i,
	/\bapt(-get)?\s+(install|remove|purge|update|upgrade)/i,
	/\bbrew\s+(install|uninstall|upgrade)/i,
	/\bgit\s+(add|commit|push|pull|merge|rebase|reset|checkout\s+-b|branch\s+-[dD]|stash|cherry-pick|revert|tag|init|clone)/i,
	/\bsudo\b/i, /\bsu\b/i, /\bkill\b/i, /\bpkill\b/i, /\bkillall\b/i,
	/\breboot\b/i, /\bshutdown\b/i,
	/\bsystemctl\s+(start|stop|restart|enable|disable)/i,
	/\bservice\s+\S+\s+(start|stop|restart)/i,
	/\b(vim?|nano|emacs|code|subl)\b/i,
];

// Safe read-only commands
const SAFE_COMMANDS = [
	/^\s*cat\b/, /^\s*head\b/, /^\s*tail\b/, /^\s*less\b/, /^\s*more\b/,
	/^\s*grep\b/, /^\s*find\b/, /^\s*ls\b/, /^\s*pwd\b/, /^\s*echo\b/,
	/^\s*printf\b/, /^\s*wc\b/, /^\s*sort\b/, /^\s*uniq\b/, /^\s*diff\b/,
	/^\s*file\b/, /^\s*stat\b/, /^\s*du\b/, /^\s*df\b/, /^\s*tree\b/,
	/^\s*which\b/, /^\s*whereis\b/, /^\s*type\b/, /^\s*env\b/, /^\s*printenv\b/,
	/^\s*uname\b/, /^\s*whoami\b/, /^\s*id\b/, /^\s*date\b/, /^\s*cal\b/,
	/^\s*uptime\b/, /^\s*ps\b/, /^\s*top\b/, /^\s*htop\b/, /^\s*free\b/,
	/^\s*git\s+(status|log|diff|show|branch|remote|config\s+--get)/i,
	/^\s*git\s+ls-/i,
	/^\s*npm\s+(list|ls|view|info|search|outdated|audit)/i,
	/^\s*yarn\s+(list|info|why|audit)/i,
	/^\s*node\s+--version/i, /^\s*python\s+--version/i,
	/^\s*curl\s/i, /^\s*wget\s+-O\s*-/i,
	/^\s*jq\b/, /^\s*sed\s+-n/i, /^\s*awk\b/,
	/^\s*rg\b/, /^\s*fd\b/, /^\s*bat\b/, /^\s*exa\b/,
];

// Types
interface PlanStep {
	id: number;
	text: string;
	done: boolean;
}

interface PlanFrontMatter {
	id: string;
	title: string;
	status: "draft" | "active" | "completed" | "archived";
	created_at: string;
	assigned_to_session?: string;
	steps: PlanStep[];
}

interface PlanRecord extends PlanFrontMatter {
	body: string;
}

interface LockInfo {
	id: string;
	pid: number;
	session?: string | null;
	created_at: string;
}

interface PlanSettings {
	gc: boolean;
	gcDays: number;
}

const DEFAULT_PLAN_SETTINGS: PlanSettings = {
	gc: true,
	gcDays: 30,
};

type PlanAction =
	| "list"
	| "get"
	| "create"
	| "update"
	| "add-step"
	| "complete-step"
	| "delete"
	| "claim"
	| "release"
	| "execute";

type PlanToolDetails =
	| { action: "list"; plans: PlanFrontMatter[]; currentSessionId?: string; error?: string }
	| { action: PlanAction; plan: PlanRecord; error?: string };

const PlanParams = Type.Object({
	action: StringEnum([
		"list", "get", "create", "update", "add-step", "complete-step",
		"delete", "claim", "release", "execute",
	] as const),
	id: Type.Optional(Type.String({ description: "Plan id (PLAN-<hex> or raw hex)" })),
	title: Type.Optional(Type.String({ description: "Plan title" })),
	status: Type.Optional(StringEnum(["draft", "active", "completed", "archived"] as const)),
	body: Type.Optional(Type.String({ description: "Plan notes/details (markdown)" })),
	steps: Type.Optional(Type.Array(Type.String({ description: "Steps to add (for create)" }))),
	step_text: Type.Optional(Type.String({ description: "Step text (for add-step)" })),
	step_id: Type.Optional(Type.Number({ description: "Step ID to mark complete" })),
	force: Type.Optional(Type.Boolean({ description: "Override another session's assignment" })),
});

// Utility functions
function isSafeCommand(command: string): boolean {
	if (SAFE_COMMANDS.some((pattern) => pattern.test(command))) {
		if (!DESTRUCTIVE_PATTERNS.some((pattern) => pattern.test(command))) {
			return true;
		}
	}
	if (DESTRUCTIVE_PATTERNS.some((pattern) => pattern.test(command))) {
		return false;
	}
	return true;
}

function formatPlanId(id: string): string {
	return `${PLAN_ID_PREFIX}${id}`;
}

function normalizePlanId(id: string): string {
	let trimmed = id.trim();
	if (trimmed.startsWith("#")) trimmed = trimmed.slice(1);
	if (trimmed.toUpperCase().startsWith(PLAN_ID_PREFIX)) {
		trimmed = trimmed.slice(PLAN_ID_PREFIX.length);
	}
	return trimmed;
}

function validatePlanId(id: string): { id: string } | { error: string } {
	const normalized = normalizePlanId(id);
	if (!normalized || !PLAN_ID_PATTERN.test(normalized)) {
		return { error: "Invalid plan id. Expected PLAN-<hex>." };
	}
	return { id: normalized.toLowerCase() };
}

function displayPlanId(id: string): string {
	return formatPlanId(normalizePlanId(id));
}

function isPlanCompleted(status: string): boolean {
	return ["completed", "archived"].includes(status.toLowerCase());
}

function getPlansDir(cwd: string): string {
	const overridePath = process.env[PLAN_PATH_ENV];
	if (overridePath?.trim()) {
		return path.resolve(cwd, overridePath.trim());
	}
	return path.resolve(cwd, PLAN_DIR_NAME);
}

function getPlansDirLabel(cwd: string): string {
	const overridePath = process.env[PLAN_PATH_ENV];
	if (overridePath?.trim()) {
		return path.resolve(cwd, overridePath.trim());
	}
	return PLAN_DIR_NAME;
}

function getPlanPath(plansDir: string, id: string): string {
	return path.join(plansDir, `${id}.md`);
}

function getLockPath(plansDir: string, id: string): string {
	return path.join(plansDir, `${id}.lock`);
}

function getPlanSettingsPath(plansDir: string): string {
	return path.join(plansDir, PLAN_SETTINGS_NAME);
}

// JSON frontmatter parsing
function findJsonObjectEnd(content: string): number {
	let depth = 0;
	let inString = false;
	let escaped = false;

	for (let i = 0; i < content.length; i++) {
		const char = content[i];
		if (inString) {
			if (escaped) { escaped = false; continue; }
			if (char === "\\") { escaped = true; continue; }
			if (char === "\"") inString = false;
			continue;
		}
		if (char === "\"") { inString = true; continue; }
		if (char === "{") { depth++; continue; }
		if (char === "}") {
			depth--;
			if (depth === 0) return i;
		}
	}
	return -1;
}

function splitFrontMatter(content: string): { frontMatter: string; body: string } {
	if (!content.startsWith("{")) {
		return { frontMatter: "", body: content };
	}
	const endIndex = findJsonObjectEnd(content);
	if (endIndex === -1) {
		return { frontMatter: "", body: content };
	}
	const frontMatter = content.slice(0, endIndex + 1);
	const body = content.slice(endIndex + 1).replace(/^\r?\n+/, "");
	return { frontMatter, body };
}

function parseFrontMatter(text: string, idFallback: string): PlanFrontMatter {
	const data: PlanFrontMatter = {
		id: idFallback,
		title: "",
		status: "draft",
		created_at: "",
		assigned_to_session: undefined,
		steps: [],
	};

	const trimmed = text.trim();
	if (!trimmed) return data;

	try {
		const parsed = JSON.parse(trimmed) as Partial<PlanFrontMatter> | null;
		if (!parsed || typeof parsed !== "object") return data;
		if (typeof parsed.id === "string" && parsed.id) data.id = parsed.id;
		if (typeof parsed.title === "string") data.title = parsed.title;
		if (typeof parsed.status === "string") data.status = parsed.status as PlanFrontMatter["status"];
		if (typeof parsed.created_at === "string") data.created_at = parsed.created_at;
		if (typeof parsed.assigned_to_session === "string" && parsed.assigned_to_session.trim()) {
			data.assigned_to_session = parsed.assigned_to_session;
		}
		if (Array.isArray(parsed.steps)) {
			data.steps = parsed.steps.filter((s): s is PlanStep =>
				typeof s === "object" && s !== null &&
				typeof s.id === "number" &&
				typeof s.text === "string" &&
				typeof s.done === "boolean"
			);
		}
	} catch {
		return data;
	}
	return data;
}

function parsePlanContent(content: string, idFallback: string): PlanRecord {
	const { frontMatter, body } = splitFrontMatter(content);
	const parsed = parseFrontMatter(frontMatter, idFallback);
	return { ...parsed, body: body ?? "" };
}

function serializePlan(plan: PlanRecord): string {
	const frontMatter = JSON.stringify(
		{
			id: plan.id,
			title: plan.title,
			status: plan.status,
			created_at: plan.created_at,
			assigned_to_session: plan.assigned_to_session || undefined,
			steps: plan.steps,
		},
		null,
		2,
	);
	const body = plan.body ?? "";
	const trimmedBody = body.replace(/^\n+/, "").replace(/\s+$/, "");
	if (!trimmedBody) return `${frontMatter}\n`;
	return `${frontMatter}\n\n${trimmedBody}\n`;
}

// File operations
async function ensurePlansDir(plansDir: string) {
	await fs.mkdir(plansDir, { recursive: true });
}

async function readPlanFile(filePath: string, idFallback: string): Promise<PlanRecord> {
	const content = await fs.readFile(filePath, "utf8");
	return parsePlanContent(content, idFallback);
}

async function writePlanFile(filePath: string, plan: PlanRecord) {
	await fs.writeFile(filePath, serializePlan(plan), "utf8");
}

async function generatePlanId(plansDir: string): Promise<string> {
	for (let attempt = 0; attempt < 10; attempt++) {
		const id = crypto.randomBytes(4).toString("hex");
		const planPath = getPlanPath(plansDir, id);
		if (!existsSync(planPath)) return id;
	}
	throw new Error("Failed to generate unique plan id");
}

async function readLockInfo(lockPath: string): Promise<LockInfo | null> {
	try {
		const raw = await fs.readFile(lockPath, "utf8");
		return JSON.parse(raw) as LockInfo;
	} catch {
		return null;
	}
}

async function acquireLock(
	plansDir: string,
	id: string,
	ctx: ExtensionContext,
): Promise<(() => Promise<void>) | { error: string }> {
	const lockPath = getLockPath(plansDir, id);
	const now = Date.now();
	const session = ctx.sessionManager.getSessionFile();

	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			const handle = await fs.open(lockPath, "wx");
			const info: LockInfo = {
				id,
				pid: process.pid,
				session,
				created_at: new Date(now).toISOString(),
			};
			await handle.writeFile(JSON.stringify(info, null, 2), "utf8");
			await handle.close();
			return async () => {
				try { await fs.unlink(lockPath); } catch { /* ignore */ }
			};
		} catch (error: any) {
			if (error?.code !== "EEXIST") {
				return { error: `Failed to acquire lock: ${error?.message ?? "unknown error"}` };
			}
			const stats = await fs.stat(lockPath).catch(() => null);
			const lockAge = stats ? now - stats.mtimeMs : LOCK_TTL_MS + 1;
			if (lockAge <= LOCK_TTL_MS) {
				const info = await readLockInfo(lockPath);
				const owner = info?.session ? ` (session ${info.session})` : "";
				return { error: `Plan ${displayPlanId(id)} is locked${owner}. Try again later.` };
			}
			if (!ctx.hasUI) {
				return { error: `Plan ${displayPlanId(id)} lock is stale; rerun in interactive mode to steal it.` };
			}
			const ok = await ctx.ui.confirm("Plan locked", `Plan ${displayPlanId(id)} appears locked. Steal the lock?`);
			if (!ok) {
				return { error: `Plan ${displayPlanId(id)} remains locked.` };
			}
			await fs.unlink(lockPath).catch(() => undefined);
		}
	}
	return { error: `Failed to acquire lock for plan ${displayPlanId(id)}.` };
}

async function withPlanLock<T>(
	plansDir: string,
	id: string,
	ctx: ExtensionContext,
	fn: () => Promise<T>,
): Promise<T | { error: string }> {
	const lock = await acquireLock(plansDir, id, ctx);
	if (typeof lock === "object" && "error" in lock) return lock;
	try {
		return await fn();
	} finally {
		await lock();
	}
}

async function listPlans(plansDir: string): Promise<PlanFrontMatter[]> {
	let entries: string[] = [];
	try {
		entries = await fs.readdir(plansDir);
	} catch {
		return [];
	}

	const plans: PlanFrontMatter[] = [];
	for (const entry of entries) {
		if (!entry.endsWith(".md")) continue;
		const id = entry.slice(0, -3);
		const filePath = path.join(plansDir, entry);
		try {
			const content = await fs.readFile(filePath, "utf8");
			const { frontMatter } = splitFrontMatter(content);
			const parsed = parseFrontMatter(frontMatter, id);
			plans.push(parsed);
		} catch {
			// ignore unreadable
		}
	}

	return sortPlans(plans);
}

function listPlansSync(plansDir: string): PlanFrontMatter[] {
	let entries: string[] = [];
	try {
		entries = readdirSync(plansDir);
	} catch {
		return [];
	}

	const plans: PlanFrontMatter[] = [];
	for (const entry of entries) {
		if (!entry.endsWith(".md")) continue;
		const id = entry.slice(0, -3);
		const filePath = path.join(plansDir, entry);
		try {
			const content = readFileSync(filePath, "utf8");
			const { frontMatter } = splitFrontMatter(content);
			const parsed = parseFrontMatter(frontMatter, id);
			plans.push(parsed);
		} catch {
			// ignore
		}
	}

	return sortPlans(plans);
}

function sortPlans(plans: PlanFrontMatter[]): PlanFrontMatter[] {
	return [...plans].sort((a, b) => {
		const aCompleted = isPlanCompleted(a.status);
		const bCompleted = isPlanCompleted(b.status);
		if (aCompleted !== bCompleted) return aCompleted ? 1 : -1;
		// Active plans first, then draft
		if (a.status === "active" && b.status !== "active") return -1;
		if (b.status === "active" && a.status !== "active") return 1;
		const aAssigned = !aCompleted && Boolean(a.assigned_to_session);
		const bAssigned = !bCompleted && Boolean(b.assigned_to_session);
		if (aAssigned !== bAssigned) return aAssigned ? -1 : 1;
		return (b.created_at || "").localeCompare(a.created_at || "");
	});
}

function filterPlans(plans: PlanFrontMatter[], query: string): PlanFrontMatter[] {
	const trimmed = query.trim();
	if (!trimmed) return plans;

	const tokens = trimmed.split(/\s+/).filter(Boolean);
	if (tokens.length === 0) return plans;

	const matches: Array<{ plan: PlanFrontMatter; score: number }> = [];
	for (const plan of plans) {
		const text = buildPlanSearchText(plan);
		let totalScore = 0;
		let matched = true;
		for (const token of tokens) {
			const result = fuzzyMatch(token, text);
			if (!result.matches) { matched = false; break; }
			totalScore += result.score;
		}
		if (matched) {
			matches.push({ plan, score: totalScore });
		}
	}

	return matches
		.sort((a, b) => {
			const aCompleted = isPlanCompleted(a.plan.status);
			const bCompleted = isPlanCompleted(b.plan.status);
			if (aCompleted !== bCompleted) return aCompleted ? 1 : -1;
			return a.score - b.score;
		})
		.map((m) => m.plan);
}

function buildPlanSearchText(plan: PlanFrontMatter): string {
	const assignment = plan.assigned_to_session ? `assigned:${plan.assigned_to_session}` : "";
	const stepsText = plan.steps.map((s) => s.text).join(" ");
	return `${formatPlanId(plan.id)} ${plan.id} ${plan.title} ${plan.status} ${assignment} ${stepsText}`.trim();
}

// Plan settings
async function readPlanSettings(plansDir: string): Promise<PlanSettings> {
	const settingsPath = getPlanSettingsPath(plansDir);
	let data: Partial<PlanSettings> = {};
	try {
		const raw = await fs.readFile(settingsPath, "utf8");
		data = JSON.parse(raw) as Partial<PlanSettings>;
	} catch {
		data = {};
	}
	return {
		gc: data.gc ?? DEFAULT_PLAN_SETTINGS.gc,
		gcDays: Number.isFinite(data.gcDays) ? Math.max(0, Math.floor(data.gcDays!)) : DEFAULT_PLAN_SETTINGS.gcDays,
	};
}

async function garbageCollectPlans(plansDir: string, settings: PlanSettings): Promise<void> {
	if (!settings.gc) return;
	let entries: string[] = [];
	try {
		entries = await fs.readdir(plansDir);
	} catch {
		return;
	}

	const cutoff = Date.now() - settings.gcDays * 24 * 60 * 60 * 1000;
	await Promise.all(
		entries.filter((e) => e.endsWith(".md")).map(async (entry) => {
			const id = entry.slice(0, -3);
			const filePath = path.join(plansDir, entry);
			try {
				const content = await fs.readFile(filePath, "utf8");
				const { frontMatter } = splitFrontMatter(content);
				const parsed = parseFrontMatter(frontMatter, id);
				if (!isPlanCompleted(parsed.status)) return;
				const createdAt = Date.parse(parsed.created_at);
				if (!Number.isFinite(createdAt)) return;
				if (createdAt < cutoff) {
					await fs.unlink(filePath);
				}
			} catch {
				// ignore
			}
		}),
	);
}

// Rendering helpers
function renderAssignmentSuffix(theme: Theme, plan: PlanFrontMatter, currentSessionId?: string): string {
	if (!plan.assigned_to_session) return "";
	const isCurrent = plan.assigned_to_session === currentSessionId;
	const color = isCurrent ? "success" : "dim";
	const suffix = isCurrent ? ", current" : "";
	return theme.fg(color, ` (assigned: ${plan.assigned_to_session}${suffix})`);
}

function renderPlanHeading(theme: Theme, plan: PlanFrontMatter, currentSessionId?: string): string {
	const completed = isPlanCompleted(plan.status);
	const titleColor = completed ? "dim" : "text";
	const statusColor = plan.status === "active" ? "success" : plan.status === "completed" ? "dim" : "warning";
	const assignmentText = renderAssignmentSuffix(theme, plan, currentSessionId);
	const doneSteps = plan.steps.filter((s) => s.done).length;
	const totalSteps = plan.steps.length;
	const progress = totalSteps > 0 ? theme.fg("muted", ` [${doneSteps}/${totalSteps}]`) : "";
	return (
		theme.fg("accent", formatPlanId(plan.id)) +
		" " +
		theme.fg(titleColor, plan.title || "(untitled)") +
		progress +
		assignmentText +
		" " +
		theme.fg(statusColor, `(${plan.status})`)
	);
}

function serializePlanForAgent(plan: PlanRecord): string {
	return JSON.stringify({ ...plan, id: formatPlanId(plan.id) }, null, 2);
}

function serializePlanListForAgent(plans: PlanFrontMatter[]): string {
	const active = plans.filter((p) => p.status === "active");
	const draft = plans.filter((p) => p.status === "draft");
	const completed = plans.filter((p) => isPlanCompleted(p.status));
	const mapPlan = (p: PlanFrontMatter) => ({ ...p, id: formatPlanId(p.id) });
	return JSON.stringify({ active: active.map(mapPlan), draft: draft.map(mapPlan), completed: completed.map(mapPlan) }, null, 2);
}

function appendExpandHint(theme: Theme, text: string): string {
	return `${text}\n${theme.fg("dim", `(${keyHint("expandTools", "to expand")})`)}`;
}

// TUI Components
class PlanSelectorComponent extends Container implements Focusable {
	private searchInput: Input;
	private listContainer: Container;
	private allPlans: PlanFrontMatter[];
	private filteredPlans: PlanFrontMatter[];
	private selectedIndex = 0;
	private onSelectCallback: (plan: PlanFrontMatter) => void;
	private onCancelCallback: () => void;
	private tui: TUI;
	private theme: Theme;
	private headerText: Text;
	private hintText: Text;
	private currentSessionId?: string;

	private _focused = false;
	get focused(): boolean { return this._focused; }
	set focused(value: boolean) {
		this._focused = value;
		this.searchInput.focused = value;
	}

	constructor(
		tui: TUI,
		theme: Theme,
		plans: PlanFrontMatter[],
		onSelect: (plan: PlanFrontMatter) => void,
		onCancel: () => void,
		initialSearchInput?: string,
		currentSessionId?: string,
		private onQuickAction?: (plan: PlanFrontMatter, action: "execute" | "edit") => void,
	) {
		super();
		this.tui = tui;
		this.theme = theme;
		this.currentSessionId = currentSessionId;
		this.allPlans = plans;
		this.filteredPlans = plans;
		this.onSelectCallback = onSelect;
		this.onCancelCallback = onCancel;

		this.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
		this.addChild(new Spacer(1));

		this.headerText = new Text("", 1, 0);
		this.addChild(this.headerText);
		this.addChild(new Spacer(1));

		this.searchInput = new Input();
		if (initialSearchInput) this.searchInput.setValue(initialSearchInput);
		this.searchInput.onSubmit = () => {
			const selected = this.filteredPlans[this.selectedIndex];
			if (selected) this.onSelectCallback(selected);
		};
		this.addChild(this.searchInput);

		this.addChild(new Spacer(1));
		this.listContainer = new Container();
		this.addChild(this.listContainer);

		this.addChild(new Spacer(1));
		this.hintText = new Text("", 1, 0);
		this.addChild(this.hintText);
		this.addChild(new Spacer(1));
		this.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));

		this.updateHeader();
		this.updateHints();
		this.applyFilter(this.searchInput.getValue());
	}

	setPlans(plans: PlanFrontMatter[]): void {
		this.allPlans = plans;
		this.updateHeader();
		this.applyFilter(this.searchInput.getValue());
		this.tui.requestRender();
	}

	getSearchValue(): string { return this.searchInput.getValue(); }

	private updateHeader(): void {
		const activeCount = this.allPlans.filter((p) => p.status === "active").length;
		const draftCount = this.allPlans.filter((p) => p.status === "draft").length;
		const title = `Plans (${activeCount} active, ${draftCount} draft)`;
		this.headerText.setText(this.theme.fg("accent", this.theme.bold(title)));
	}

	private updateHints(): void {
		this.hintText.setText(
			this.theme.fg("dim", "Type to search • ↑↓ select • Enter actions • Ctrl+Shift+E execute • Ctrl+Shift+R edit • Esc close")
		);
	}

	private applyFilter(query: string): void {
		this.filteredPlans = filterPlans(this.allPlans, query);
		this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, this.filteredPlans.length - 1));
		this.updateList();
	}

	private updateList(): void {
		this.listContainer.clear();

		if (this.filteredPlans.length === 0) {
			this.listContainer.addChild(new Text(this.theme.fg("muted", "  No matching plans"), 0, 0));
			return;
		}

		const maxVisible = 10;
		const startIndex = Math.max(0, Math.min(this.selectedIndex - Math.floor(maxVisible / 2), this.filteredPlans.length - maxVisible));
		const endIndex = Math.min(startIndex + maxVisible, this.filteredPlans.length);

		for (let i = startIndex; i < endIndex; i++) {
			const plan = this.filteredPlans[i];
			if (!plan) continue;
			const isSelected = i === this.selectedIndex;
			const prefix = isSelected ? this.theme.fg("accent", "→ ") : "  ";
			const line = prefix + renderPlanHeading(this.theme, plan, this.currentSessionId);
			this.listContainer.addChild(new Text(line, 0, 0));
		}

		if (startIndex > 0 || endIndex < this.filteredPlans.length) {
			const scrollInfo = this.theme.fg("dim", `  (${this.selectedIndex + 1}/${this.filteredPlans.length})`);
			this.listContainer.addChild(new Text(scrollInfo, 0, 0));
		}
	}

	handleInput(keyData: string): void {
		const kb = getEditorKeybindings();
		if (kb.matches(keyData, "selectUp")) {
			if (this.filteredPlans.length === 0) return;
			this.selectedIndex = this.selectedIndex === 0 ? this.filteredPlans.length - 1 : this.selectedIndex - 1;
			this.updateList();
			return;
		}
		if (kb.matches(keyData, "selectDown")) {
			if (this.filteredPlans.length === 0) return;
			this.selectedIndex = this.selectedIndex === this.filteredPlans.length - 1 ? 0 : this.selectedIndex + 1;
			this.updateList();
			return;
		}
		if (kb.matches(keyData, "selectConfirm")) {
			const selected = this.filteredPlans[this.selectedIndex];
			if (selected) this.onSelectCallback(selected);
			return;
		}
		if (kb.matches(keyData, "selectCancel")) {
			this.onCancelCallback();
			return;
		}
		if (matchesKey(keyData, Key.ctrlShift("e"))) {
			const selected = this.filteredPlans[this.selectedIndex];
			if (selected && this.onQuickAction) this.onQuickAction(selected, "execute");
			return;
		}
		if (matchesKey(keyData, Key.ctrlShift("r"))) {
			const selected = this.filteredPlans[this.selectedIndex];
			if (selected && this.onQuickAction) this.onQuickAction(selected, "edit");
			return;
		}
		this.searchInput.handleInput(keyData);
		this.applyFilter(this.searchInput.getValue());
	}

	override invalidate(): void {
		super.invalidate();
		this.updateHeader();
		this.updateHints();
		this.updateList();
	}
}

class PlanActionMenuComponent extends Container {
	private selectList: SelectList;

	constructor(
		theme: Theme,
		plan: PlanRecord,
		onSelect: (action: string) => void,
		onCancel: () => void,
	) {
		super();
		const completed = isPlanCompleted(plan.status);
		const title = plan.title || "(untitled)";

		const options: SelectItem[] = [
			{ value: "view", label: "view", description: "View plan details" },
			{ value: "execute", label: "execute", description: "Execute this plan" },
			{ value: "edit", label: "edit", description: "Edit plan details" },
			...(completed
				? [{ value: "reopen", label: "reopen", description: "Reopen plan" }]
				: [{ value: "complete", label: "complete", description: "Mark as completed" }]),
			...(plan.assigned_to_session
				? [{ value: "release", label: "release", description: "Release assignment" }]
				: []),
			{ value: "delete", label: "delete", description: "Delete plan" },
		];

		this.addChild(new DynamicBorder((s) => theme.fg("accent", s)));
		this.addChild(new Text(theme.fg("accent", theme.bold(`Actions for ${formatPlanId(plan.id)} "${title}"`))));

		this.selectList = new SelectList(options, options.length, {
			selectedPrefix: (text) => theme.fg("accent", text),
			selectedText: (text) => theme.fg("accent", text),
			description: (text) => theme.fg("muted", text),
			scrollInfo: (text) => theme.fg("dim", text),
			noMatch: (text) => theme.fg("warning", text),
		});
		this.selectList.onSelect = (item) => onSelect(item.value);
		this.selectList.onCancel = onCancel;

		this.addChild(this.selectList);
		this.addChild(new Text(theme.fg("dim", "Enter to confirm • Esc back")));
		this.addChild(new DynamicBorder((s) => theme.fg("accent", s)));
	}

	handleInput(keyData: string): void {
		this.selectList.handleInput(keyData);
	}
}

class PlanDetailOverlayComponent {
	private plan: PlanRecord;
	private theme: Theme;
	private tui: TUI;
	private markdown: Markdown;
	private scrollOffset = 0;
	private viewHeight = 0;
	private totalLines = 0;
	private onAction: (action: "back" | "execute") => void;

	constructor(tui: TUI, theme: Theme, plan: PlanRecord, onAction: (action: "back" | "execute") => void) {
		this.tui = tui;
		this.theme = theme;
		this.plan = plan;
		this.onAction = onAction;
		this.markdown = new Markdown(this.getMarkdownText(), 1, 0, getMarkdownTheme());
	}

	private getMarkdownText(): string {
		const stepsText = this.plan.steps.length > 0
			? this.plan.steps.map((s) => `- [${s.done ? "x" : " "}] ${s.text}`).join("\n")
			: "_No steps defined._";
		const body = this.plan.body?.trim();
		const bodySection = body ? `\n\n---\n\n${body}` : "";
		return `## Steps\n\n${stepsText}${bodySection}`;
	}

	handleInput(keyData: string): void {
		const kb = getEditorKeybindings();
		if (kb.matches(keyData, "selectCancel")) { this.onAction("back"); return; }
		if (kb.matches(keyData, "selectConfirm")) { this.onAction("execute"); return; }
		if (kb.matches(keyData, "selectUp")) { this.scrollBy(-1); return; }
		if (kb.matches(keyData, "selectDown")) { this.scrollBy(1); return; }
		if (kb.matches(keyData, "selectPageUp")) { this.scrollBy(-this.viewHeight || -1); return; }
		if (kb.matches(keyData, "selectPageDown")) { this.scrollBy(this.viewHeight || 1); return; }
	}

	render(width: number): string[] {
		const maxHeight = this.getMaxHeight();
		const headerLines = 3;
		const footerLines = 3;
		const borderLines = 2;
		const innerWidth = Math.max(10, width - 2);
		const contentHeight = Math.max(1, maxHeight - headerLines - footerLines - borderLines);

		const markdownLines = this.markdown.render(innerWidth);
		this.totalLines = markdownLines.length;
		this.viewHeight = contentHeight;
		const maxScroll = Math.max(0, this.totalLines - contentHeight);
		this.scrollOffset = Math.max(0, Math.min(this.scrollOffset, maxScroll));

		const visibleLines = markdownLines.slice(this.scrollOffset, this.scrollOffset + contentHeight);
		const lines: string[] = [];

		lines.push(this.buildTitleLine(innerWidth));
		lines.push(this.buildMetaLine(innerWidth));
		lines.push("");

		for (const line of visibleLines) {
			lines.push(truncateToWidth(line, innerWidth));
		}
		while (lines.length < headerLines + contentHeight) {
			lines.push("");
		}

		lines.push("");
		lines.push(this.buildActionLine(innerWidth));

		const borderColor = (text: string) => this.theme.fg("borderMuted", text);
		const top = borderColor(`┌${"─".repeat(innerWidth)}┐`);
		const bottom = borderColor(`└${"─".repeat(innerWidth)}┘`);
		const framedLines = lines.map((line) => {
			const truncated = truncateToWidth(line, innerWidth);
			const padding = Math.max(0, innerWidth - visibleWidth(truncated));
			return borderColor("│") + truncated + " ".repeat(padding) + borderColor("│");
		});

		return [top, ...framedLines, bottom].map((l) => truncateToWidth(l, width));
	}

	invalidate(): void {
		this.markdown = new Markdown(this.getMarkdownText(), 1, 0, getMarkdownTheme());
	}

	private getMaxHeight(): number {
		const rows = this.tui.terminal.rows || 24;
		return Math.max(10, Math.floor(rows * 0.8));
	}

	private buildTitleLine(width: number): string {
		const titleText = this.plan.title ? ` ${this.plan.title} ` : ` Plan ${formatPlanId(this.plan.id)} `;
		const titleWidth = visibleWidth(titleText);
		if (titleWidth >= width) return truncateToWidth(this.theme.fg("accent", titleText.trim()), width);
		const leftWidth = Math.max(0, Math.floor((width - titleWidth) / 2));
		const rightWidth = Math.max(0, width - titleWidth - leftWidth);
		return (
			this.theme.fg("borderMuted", "─".repeat(leftWidth)) +
			this.theme.fg("accent", titleText) +
			this.theme.fg("borderMuted", "─".repeat(rightWidth))
		);
	}

	private buildMetaLine(width: number): string {
		const statusColor = this.plan.status === "active" ? "success" : this.plan.status === "completed" ? "dim" : "warning";
		const doneSteps = this.plan.steps.filter((s) => s.done).length;
		const totalSteps = this.plan.steps.length;
		const progressText = totalSteps > 0 ? `${doneSteps}/${totalSteps} steps` : "no steps";
		const line =
			this.theme.fg("accent", formatPlanId(this.plan.id)) +
			this.theme.fg("muted", " • ") +
			this.theme.fg(statusColor, this.plan.status) +
			this.theme.fg("muted", " • ") +
			this.theme.fg("muted", progressText);
		return truncateToWidth(line, width);
	}

	private buildActionLine(width: number): string {
		const execute = this.theme.fg("accent", "enter") + this.theme.fg("muted", " execute plan");
		const back = this.theme.fg("dim", "esc back");
		const pieces = [execute, back];
		let line = pieces.join(this.theme.fg("muted", " • "));
		if (this.totalLines > this.viewHeight) {
			const start = Math.min(this.totalLines, this.scrollOffset + 1);
			const end = Math.min(this.totalLines, this.scrollOffset + this.viewHeight);
			const scrollInfo = this.theme.fg("dim", ` ${start}-${end}/${this.totalLines}`);
			line += scrollInfo;
		}
		return truncateToWidth(line, width);
	}

	private scrollBy(delta: number): void {
		const maxScroll = Math.max(0, this.totalLines - this.viewHeight);
		this.scrollOffset = Math.max(0, Math.min(this.scrollOffset + delta, maxScroll));
	}
}

// Main Extension
export default function planModeExtension(pi: ExtensionAPI) {
	let planningModeEnabled = false;
	let activePlanId: string | null = null;

	// Register --plan CLI flag
	pi.registerFlag("plan", {
		description: "Start in planning mode (read-only exploration)",
		type: "boolean",
		default: false,
	});

	// Helper to update status
	function updateStatus(ctx: ExtensionContext) {
		if (planningModeEnabled) {
			ctx.ui.setStatus("plan-mode", ctx.ui.theme.fg("warning", "⏸ planning"));
		} else if (activePlanId) {
			const plansDir = getPlansDir(ctx.cwd);
			const plans = listPlansSync(plansDir);
			const plan = plans.find((p) => p.id === activePlanId);
			if (plan) {
				const done = plan.steps.filter((s) => s.done).length;
				const total = plan.steps.length;
				ctx.ui.setStatus("plan-mode", ctx.ui.theme.fg("accent", `📋 ${done}/${total}`));
			}
		} else {
			ctx.ui.setStatus("plan-mode", undefined);
		}
	}

	// Update widget for active plan
	function updateWidget(ctx: ExtensionContext) {
		if (!activePlanId) {
			ctx.ui.setWidget("plan-steps", undefined);
			return;
		}
		const plansDir = getPlansDir(ctx.cwd);
		try {
			const content = readFileSync(getPlanPath(plansDir, activePlanId), "utf8");
			const plan = parsePlanContent(content, activePlanId);
			if (plan.steps.length === 0) {
				ctx.ui.setWidget("plan-steps", undefined);
				return;
			}
			const lines = plan.steps.map((s) => {
				if (s.done) {
					return ctx.ui.theme.fg("success", "☑ ") + ctx.ui.theme.fg("muted", ctx.ui.theme.strikethrough(s.text));
				}
				return ctx.ui.theme.fg("muted", "☐ ") + s.text;
			});
			ctx.ui.setWidget("plan-steps", lines);
		} catch {
			ctx.ui.setWidget("plan-steps", undefined);
		}
	}

	function togglePlanningMode(ctx: ExtensionContext) {
		planningModeEnabled = !planningModeEnabled;
		if (planningModeEnabled) {
			pi.setActiveTools(PLAN_MODE_TOOLS);
			ctx.ui.notify(`Planning mode enabled. Read-only tools: ${PLAN_MODE_TOOLS.join(", ")}`);
		} else {
			pi.setActiveTools(NORMAL_MODE_TOOLS);
			ctx.ui.notify("Planning mode disabled. Full access restored.");
		}
		updateStatus(ctx);
	}

	// Block destructive bash in planning mode
	pi.on("tool_call", async (event) => {
		if (!planningModeEnabled) return;
		if (event.toolName !== "bash") return;
		const command = event.input.command as string;
		if (!isSafeCommand(command)) {
			return {
				block: true,
				reason: `Planning mode: destructive command blocked. Use /plan off to disable.\nCommand: ${command}`,
			};
		}
	});

	// Inject context for planning mode
	pi.on("before_agent_start", async () => {
		if (planningModeEnabled) {
			return {
				message: {
					customType: "plan-mode-context",
					content: `[PLANNING MODE ACTIVE]
You are in planning mode - a read-only exploration mode for safe code analysis.

Restrictions:
- You can only use: read, bash, grep, find, ls
- Bash is restricted to READ-ONLY commands
- Focus on analysis, planning, and understanding

Use the "plan" tool to:
- Create a plan with steps
- List existing plans
- Get plan details

Do NOT attempt to make changes - just describe what you would do.`,
					display: false,
				},
			};
		}

		if (activePlanId) {
			const plansDir = getPlansDir(process.cwd());
			try {
				const content = readFileSync(getPlanPath(plansDir, activePlanId), "utf8");
				const plan = parsePlanContent(content, activePlanId);
				const remaining = plan.steps.filter((s) => !s.done);
				if (remaining.length === 0) {
					return {
						message: {
							customType: "plan-execution-context",
							content: `[EXECUTING PLAN ${formatPlanId(activePlanId)}]

All steps are complete! Use the plan tool to mark the plan as "completed".`,
							display: false,
						},
					};
				}
				const stepsList = remaining.map((s) => `${s.id}. ${s.text}`).join("\n");
				return {
					message: {
						customType: "plan-execution-context",
						content: `[EXECUTING PLAN ${formatPlanId(activePlanId)}]

Remaining steps:
${stepsList}

Execute each step in order. Use the plan tool with action "complete-step" and step_id to mark steps done.`,
						display: false,
					},
				};
			} catch {
				// ignore
			}
		}
	});

	// Register the plan tool
	const plansDirLabel = getPlansDirLabel(process.cwd());

	pi.registerTool({
		name: "plan",
		label: "Plan",
		description:
			`Manage file-based plans in ${plansDirLabel}. Actions: list, get, create, update, add-step, complete-step, delete, claim, release, execute. ` +
			"Plans have steps that can be marked complete. Claim plans before working on them. " +
			"Plan ids are shown as PLAN-<hex>; id parameters accept PLAN-<hex> or raw hex.",
		parameters: PlanParams,

		async execute(_toolCallId, params, _onUpdate, ctx) {
			const plansDir = getPlansDir(ctx.cwd);
			const action: PlanAction = params.action;

			switch (action) {
				case "list": {
					const plans = await listPlans(plansDir);
					const currentSessionId = ctx.sessionManager.getSessionId();
					return {
						content: [{ type: "text", text: serializePlanListForAgent(plans) }],
						details: { action: "list", plans, currentSessionId } as PlanToolDetails,
					};
				}

				case "get": {
					if (!params.id) {
						return { content: [{ type: "text", text: "Error: id required" }], details: { action: "get", error: "id required" } };
					}
					const validated = validatePlanId(params.id);
					if ("error" in validated) {
						return { content: [{ type: "text", text: validated.error }], details: { action: "get", error: validated.error } };
					}
					const filePath = getPlanPath(plansDir, validated.id);
					if (!existsSync(filePath)) {
						return { content: [{ type: "text", text: `Plan ${displayPlanId(validated.id)} not found` }], details: { action: "get", error: "not found" } };
					}
					const plan = await readPlanFile(filePath, validated.id);
					return {
						content: [{ type: "text", text: serializePlanForAgent(plan) }],
						details: { action: "get", plan } as PlanToolDetails,
					};
				}

				case "create": {
					if (!params.title) {
						return { content: [{ type: "text", text: "Error: title required" }], details: { action: "create", error: "title required" } };
					}
					await ensurePlansDir(plansDir);
					const id = await generatePlanId(plansDir);
					const filePath = getPlanPath(plansDir, id);
					const steps: PlanStep[] = (params.steps ?? []).map((text, i) => ({
						id: i + 1,
						text,
						done: false,
					}));
					const plan: PlanRecord = {
						id,
						title: params.title,
						status: params.status ?? "draft",
						created_at: new Date().toISOString(),
						assigned_to_session: undefined,
						steps,
						body: params.body ?? "",
					};
					const result = await withPlanLock(plansDir, id, ctx, async () => {
						await writePlanFile(filePath, plan);
						return plan;
					});
					if (typeof result === "object" && "error" in result) {
						return { content: [{ type: "text", text: result.error }], details: { action: "create", error: result.error } };
					}
					return {
						content: [{ type: "text", text: serializePlanForAgent(plan) }],
						details: { action: "create", plan } as PlanToolDetails,
					};
				}

				case "update": {
					if (!params.id) {
						return { content: [{ type: "text", text: "Error: id required" }], details: { action: "update", error: "id required" } };
					}
					const validated = validatePlanId(params.id);
					if ("error" in validated) {
						return { content: [{ type: "text", text: validated.error }], details: { action: "update", error: validated.error } };
					}
					const filePath = getPlanPath(plansDir, validated.id);
					if (!existsSync(filePath)) {
						return { content: [{ type: "text", text: `Plan ${displayPlanId(validated.id)} not found` }], details: { action: "update", error: "not found" } };
					}
					const result = await withPlanLock(plansDir, validated.id, ctx, async () => {
						const existing = await readPlanFile(filePath, validated.id);
						if (params.title !== undefined) existing.title = params.title;
						if (params.status !== undefined) existing.status = params.status;
						if (params.body !== undefined) existing.body = params.body;
						await writePlanFile(filePath, existing);
						return existing;
					});
					if (typeof result === "object" && "error" in result) {
						return { content: [{ type: "text", text: result.error }], details: { action: "update", error: result.error } };
					}
					return {
						content: [{ type: "text", text: serializePlanForAgent(result as PlanRecord) }],
						details: { action: "update", plan: result as PlanRecord } as PlanToolDetails,
					};
				}

				case "add-step": {
					if (!params.id) {
						return { content: [{ type: "text", text: "Error: id required" }], details: { action: "add-step", error: "id required" } };
					}
					if (!params.step_text) {
						return { content: [{ type: "text", text: "Error: step_text required" }], details: { action: "add-step", error: "step_text required" } };
					}
					const validated = validatePlanId(params.id);
					if ("error" in validated) {
						return { content: [{ type: "text", text: validated.error }], details: { action: "add-step", error: validated.error } };
					}
					const filePath = getPlanPath(plansDir, validated.id);
					if (!existsSync(filePath)) {
						return { content: [{ type: "text", text: `Plan ${displayPlanId(validated.id)} not found` }], details: { action: "add-step", error: "not found" } };
					}
					const result = await withPlanLock(plansDir, validated.id, ctx, async () => {
						const existing = await readPlanFile(filePath, validated.id);
						const maxId = existing.steps.reduce((max, s) => Math.max(max, s.id), 0);
						existing.steps.push({ id: maxId + 1, text: params.step_text!, done: false });
						await writePlanFile(filePath, existing);
						return existing;
					});
					if (typeof result === "object" && "error" in result) {
						return { content: [{ type: "text", text: result.error }], details: { action: "add-step", error: result.error } };
					}
					// Update widget if this is the active plan
					if (activePlanId === validated.id) {
						updateWidget(ctx);
						updateStatus(ctx);
					}
					return {
						content: [{ type: "text", text: serializePlanForAgent(result as PlanRecord) }],
						details: { action: "add-step", plan: result as PlanRecord } as PlanToolDetails,
					};
				}

				case "complete-step": {
					if (!params.id) {
						return { content: [{ type: "text", text: "Error: id required" }], details: { action: "complete-step", error: "id required" } };
					}
					if (params.step_id === undefined) {
						return { content: [{ type: "text", text: "Error: step_id required" }], details: { action: "complete-step", error: "step_id required" } };
					}
					const validated = validatePlanId(params.id);
					if ("error" in validated) {
						return { content: [{ type: "text", text: validated.error }], details: { action: "complete-step", error: validated.error } };
					}
					const filePath = getPlanPath(plansDir, validated.id);
					if (!existsSync(filePath)) {
						return { content: [{ type: "text", text: `Plan ${displayPlanId(validated.id)} not found` }], details: { action: "complete-step", error: "not found" } };
					}
					const result = await withPlanLock(plansDir, validated.id, ctx, async () => {
						const existing = await readPlanFile(filePath, validated.id);
						const step = existing.steps.find((s) => s.id === params.step_id);
						if (!step) {
							return { error: `Step ${params.step_id} not found in plan ${displayPlanId(validated.id)}` } as const;
						}
						step.done = true;
						await writePlanFile(filePath, existing);
						return existing;
					});
					if (typeof result === "object" && "error" in result) {
						return { content: [{ type: "text", text: result.error }], details: { action: "complete-step", error: result.error } };
					}
					// Update widget if this is the active plan
					if (activePlanId === validated.id) {
						updateWidget(ctx);
						updateStatus(ctx);
					}
					return {
						content: [{ type: "text", text: serializePlanForAgent(result as PlanRecord) }],
						details: { action: "complete-step", plan: result as PlanRecord } as PlanToolDetails,
					};
				}

				case "claim": {
					if (!params.id) {
						return { content: [{ type: "text", text: "Error: id required" }], details: { action: "claim", error: "id required" } };
					}
					const validated = validatePlanId(params.id);
					if ("error" in validated) {
						return { content: [{ type: "text", text: validated.error }], details: { action: "claim", error: validated.error } };
					}
					const filePath = getPlanPath(plansDir, validated.id);
					if (!existsSync(filePath)) {
						return { content: [{ type: "text", text: `Plan ${displayPlanId(validated.id)} not found` }], details: { action: "claim", error: "not found" } };
					}
					const sessionId = ctx.sessionManager.getSessionId();
					const result = await withPlanLock(plansDir, validated.id, ctx, async () => {
						const existing = await readPlanFile(filePath, validated.id);
						if (isPlanCompleted(existing.status)) {
							return { error: `Plan ${displayPlanId(validated.id)} is ${existing.status}` } as const;
						}
						const assigned = existing.assigned_to_session;
						if (assigned && assigned !== sessionId && !params.force) {
							return { error: `Plan ${displayPlanId(validated.id)} is already assigned to session ${assigned}. Use force to override.` } as const;
						}
						existing.assigned_to_session = sessionId;
						await writePlanFile(filePath, existing);
						return existing;
					});
					if (typeof result === "object" && "error" in result) {
						return { content: [{ type: "text", text: result.error }], details: { action: "claim", error: result.error } };
					}
					return {
						content: [{ type: "text", text: serializePlanForAgent(result as PlanRecord) }],
						details: { action: "claim", plan: result as PlanRecord } as PlanToolDetails,
					};
				}

				case "release": {
					if (!params.id) {
						return { content: [{ type: "text", text: "Error: id required" }], details: { action: "release", error: "id required" } };
					}
					const validated = validatePlanId(params.id);
					if ("error" in validated) {
						return { content: [{ type: "text", text: validated.error }], details: { action: "release", error: validated.error } };
					}
					const filePath = getPlanPath(plansDir, validated.id);
					if (!existsSync(filePath)) {
						return { content: [{ type: "text", text: `Plan ${displayPlanId(validated.id)} not found` }], details: { action: "release", error: "not found" } };
					}
					const sessionId = ctx.sessionManager.getSessionId();
					const result = await withPlanLock(plansDir, validated.id, ctx, async () => {
						const existing = await readPlanFile(filePath, validated.id);
						if (!existing.assigned_to_session) return existing;
						if (existing.assigned_to_session !== sessionId && !params.force) {
							return { error: `Plan ${displayPlanId(validated.id)} is assigned to session ${existing.assigned_to_session}. Use force to release.` } as const;
						}
						existing.assigned_to_session = undefined;
						await writePlanFile(filePath, existing);
						return existing;
					});
					if (typeof result === "object" && "error" in result) {
						return { content: [{ type: "text", text: result.error }], details: { action: "release", error: result.error } };
					}
					// Clear active plan if releasing current
					if (activePlanId === validated.id) {
						activePlanId = null;
						updateWidget(ctx);
						updateStatus(ctx);
					}
					return {
						content: [{ type: "text", text: serializePlanForAgent(result as PlanRecord) }],
						details: { action: "release", plan: result as PlanRecord } as PlanToolDetails,
					};
				}

				case "execute": {
					if (!params.id) {
						return { content: [{ type: "text", text: "Error: id required" }], details: { action: "execute", error: "id required" } };
					}
					const validated = validatePlanId(params.id);
					if ("error" in validated) {
						return { content: [{ type: "text", text: validated.error }], details: { action: "execute", error: validated.error } };
					}
					const filePath = getPlanPath(plansDir, validated.id);
					if (!existsSync(filePath)) {
						return { content: [{ type: "text", text: `Plan ${displayPlanId(validated.id)} not found` }], details: { action: "execute", error: "not found" } };
					}
					const sessionId = ctx.sessionManager.getSessionId();
					const result = await withPlanLock(plansDir, validated.id, ctx, async () => {
						const existing = await readPlanFile(filePath, validated.id);
						if (isPlanCompleted(existing.status)) {
							return { error: `Plan ${displayPlanId(validated.id)} is ${existing.status}` } as const;
						}
						// Auto-claim if not assigned
						if (!existing.assigned_to_session) {
							existing.assigned_to_session = sessionId;
						} else if (existing.assigned_to_session !== sessionId && !params.force) {
							return { error: `Plan ${displayPlanId(validated.id)} is assigned to session ${existing.assigned_to_session}. Use force to override.` } as const;
						}
						// Activate
						existing.status = "active";
						await writePlanFile(filePath, existing);
						return existing;
					});
					if (typeof result === "object" && "error" in result) {
						return { content: [{ type: "text", text: result.error }], details: { action: "execute", error: result.error } };
					}
					// Set as active plan and disable planning mode
					planningModeEnabled = false;
					activePlanId = validated.id;
					pi.setActiveTools(NORMAL_MODE_TOOLS);
					updateWidget(ctx);
					updateStatus(ctx);
					const plan = result as PlanRecord;
					const remaining = plan.steps.filter((s) => !s.done);
					const stepsList = remaining.length > 0
						? remaining.map((s) => `${s.id}. ${s.text}`).join("\n")
						: "All steps complete!";
					return {
						content: [{ type: "text", text: `Executing plan ${formatPlanId(validated.id)}. Remaining steps:\n${stepsList}` }],
						details: { action: "execute", plan } as PlanToolDetails,
					};
				}

				case "delete": {
					if (!params.id) {
						return { content: [{ type: "text", text: "Error: id required" }], details: { action: "delete", error: "id required" } };
					}
					const validated = validatePlanId(params.id);
					if ("error" in validated) {
						return { content: [{ type: "text", text: validated.error }], details: { action: "delete", error: validated.error } };
					}
					const filePath = getPlanPath(plansDir, validated.id);
					if (!existsSync(filePath)) {
						return { content: [{ type: "text", text: `Plan ${displayPlanId(validated.id)} not found` }], details: { action: "delete", error: "not found" } };
					}
					const result = await withPlanLock(plansDir, validated.id, ctx, async () => {
						const existing = await readPlanFile(filePath, validated.id);
						await fs.unlink(filePath);
						return existing;
					});
					if (typeof result === "object" && "error" in result) {
						return { content: [{ type: "text", text: result.error }], details: { action: "delete", error: result.error } };
					}
					// Clear active plan if deleting current
					if (activePlanId === validated.id) {
						activePlanId = null;
						updateWidget(ctx);
						updateStatus(ctx);
					}
					return {
						content: [{ type: "text", text: serializePlanForAgent(result as PlanRecord) }],
						details: { action: "delete", plan: result as PlanRecord } as PlanToolDetails,
					};
				}
			}
		},

		renderCall(args, theme) {
			const action = typeof args.action === "string" ? args.action : "";
			const id = typeof args.id === "string" ? args.id : "";
			const normalizedId = id ? normalizePlanId(id) : "";
			const title = typeof args.title === "string" ? args.title : "";
			const stepId = typeof args.step_id === "number" ? args.step_id : undefined;

			let text = theme.fg("toolTitle", theme.bold("plan ")) + theme.fg("muted", action);
			if (normalizedId) text += " " + theme.fg("accent", formatPlanId(normalizedId));
			if (title) text += " " + theme.fg("dim", `"${title}"`);
			if (stepId !== undefined) text += " " + theme.fg("warning", `step #${stepId}`);
			return new Text(text, 0, 0);
		},

		renderResult(result, { expanded, isPartial }, theme) {
			const details = result.details as PlanToolDetails | undefined;
			if (isPartial) return new Text(theme.fg("warning", "Processing..."), 0, 0);
			if (!details) {
				const text = result.content[0];
				return new Text(text?.type === "text" ? text.text : "", 0, 0);
			}

			if (details.error) {
				return new Text(theme.fg("error", `Error: ${details.error}`), 0, 0);
			}

			if (details.action === "list") {
				const plans = details.plans;
				if (plans.length === 0) {
					return new Text(theme.fg("dim", "No plans"), 0, 0);
				}
				const active = plans.filter((p) => p.status === "active");
				const draft = plans.filter((p) => p.status === "draft");
				const completed = plans.filter((p) => isPlanCompleted(p.status));
				const lines: string[] = [];

				const showSection = (label: string, sectionPlans: PlanFrontMatter[], max: number) => {
					lines.push(theme.fg("muted", `${label} (${sectionPlans.length})`));
					if (sectionPlans.length === 0) {
						lines.push(theme.fg("dim", "  none"));
						return;
					}
					const show = expanded ? sectionPlans : sectionPlans.slice(0, max);
					for (const p of show) {
						lines.push("  " + renderPlanHeading(theme, p, details.currentSessionId));
					}
					if (!expanded && sectionPlans.length > max) {
						lines.push(theme.fg("dim", `  ... ${sectionPlans.length - max} more`));
					}
				};

				showSection("Active", active, 3);
				lines.push("");
				showSection("Draft", draft, 3);
				lines.push("");
				showSection("Completed", completed, 2);

				let text = lines.join("\n");
				if (!expanded) text = appendExpandHint(theme, text);
				return new Text(text, 0, 0);
			}

			if (!("plan" in details)) {
				const text = result.content[0];
				return new Text(text?.type === "text" ? text.text : "", 0, 0);
			}

			const plan = details.plan;
			const actionLabel =
				details.action === "create" ? "Created" :
				details.action === "update" ? "Updated" :
				details.action === "add-step" ? "Added step to" :
				details.action === "complete-step" ? "Completed step in" :
				details.action === "delete" ? "Deleted" :
				details.action === "claim" ? "Claimed" :
				details.action === "release" ? "Released" :
				details.action === "execute" ? "Executing" :
				null;

			let text = "";
			if (actionLabel) {
				text += theme.fg("success", "✓ ") + theme.fg("muted", `${actionLabel} `);
			}
			text += renderPlanHeading(theme, plan);

			if (expanded && plan.steps.length > 0) {
				text += "\n";
				for (const s of plan.steps) {
					const check = s.done ? theme.fg("success", "✓") : theme.fg("dim", "○");
					const stepText = s.done ? theme.fg("dim", s.text) : theme.fg("muted", s.text);
					text += `\n  ${check} ${theme.fg("accent", `#${s.id}`)} ${stepText}`;
				}
			}

			if (!expanded && plan.steps.length > 0) {
				text = appendExpandHint(theme, text);
			}

			return new Text(text, 0, 0);
		},
	});

	// Register /plan command
	pi.registerCommand("plan", {
		description: "Plan manager: /plan [on|off] or /plan to open manager",
		getArgumentCompletions: (prefix: string) => {
			const commands = [
				{ value: "on", label: "on", description: "Enter planning mode (read-only)" },
				{ value: "off", label: "off", description: "Exit planning mode" },
			];
			const plans = listPlansSync(getPlansDir(process.cwd()));
			const planItems = plans.map((p) => ({
				value: p.title || formatPlanId(p.id),
				label: `${formatPlanId(p.id)} ${p.title || "(untitled)"}`,
				description: `${p.status} - ${p.steps.filter((s) => s.done).length}/${p.steps.length} steps`,
			}));
			const all = [...commands, ...planItems];
			const filtered = all.filter((i) => i.value.toLowerCase().includes(prefix.toLowerCase()));
			return filtered.length > 0 ? filtered : null;
		},
		handler: async (args, ctx) => {
			const plansDir = getPlansDir(ctx.cwd);
			const trimmedArgs = (args ?? "").trim().toLowerCase();

			// Handle on/off
			if (trimmedArgs === "on") {
				if (!planningModeEnabled) togglePlanningMode(ctx);
				return;
			}
			if (trimmedArgs === "off") {
				if (planningModeEnabled) togglePlanningMode(ctx);
				return;
			}

			// Open plan manager
			const plans = await listPlans(plansDir);
			const currentSessionId = ctx.sessionManager.getSessionId();

			if (!ctx.hasUI) {
				if (plans.length === 0) {
					console.log("No plans. Ask the agent to create one.");
				} else {
					for (const p of plans) {
						const done = p.steps.filter((s) => s.done).length;
						console.log(`${formatPlanId(p.id)} ${p.title || "(untitled)"} [${p.status}] ${done}/${p.steps.length}`);
					}
				}
				return;
			}

			let nextPrompt: string | null = null;
			let rootTui: TUI | null = null;

			await ctx.ui.custom<void>((tui, theme, _kb, done) => {
				rootTui = tui;
				let selector: PlanSelectorComponent | null = null;
				let actionMenu: PlanActionMenuComponent | null = null;
				let activeComponent: {
					render: (width: number) => string[];
					invalidate: () => void;
					handleInput?: (data: string) => void;
					focused?: boolean;
				} | null = null;
				let wrapperFocused = false;

				const setActiveComponent = (component: typeof activeComponent) => {
					if (activeComponent && "focused" in activeComponent) activeComponent.focused = false;
					activeComponent = component;
					if (activeComponent && "focused" in activeComponent) activeComponent.focused = wrapperFocused;
					tui.requestRender();
				};

				const resolvePlanRecord = async (plan: PlanFrontMatter): Promise<PlanRecord | null> => {
					const filePath = getPlanPath(plansDir, plan.id);
					try {
						return await readPlanFile(filePath, plan.id);
					} catch {
						ctx.ui.notify(`Plan ${formatPlanId(plan.id)} not found`, "error");
						return null;
					}
				};

				const openPlanOverlay = async (record: PlanRecord): Promise<"back" | "execute"> => {
					return await ctx.ui.custom<"back" | "execute">(
						(overlayTui, overlayTheme, _overlayKb, overlayDone) =>
							new PlanDetailOverlayComponent(overlayTui, overlayTheme, record, overlayDone),
						{ overlay: true, overlayOptions: { width: "80%", maxHeight: "80%", anchor: "center" } },
					) ?? "back";
				};

				const applyPlanAction = async (record: PlanRecord, action: string): Promise<"stay" | "exit"> => {
					if (action === "execute") {
						// Claim and activate
						const sessionId = ctx.sessionManager.getSessionId();
						const filePath = getPlanPath(plansDir, record.id);
						await withPlanLock(plansDir, record.id, ctx, async () => {
							const existing = await readPlanFile(filePath, record.id);
							existing.assigned_to_session = sessionId;
							existing.status = "active";
							await writePlanFile(filePath, existing);
						});
						planningModeEnabled = false;
						activePlanId = record.id;
						pi.setActiveTools(NORMAL_MODE_TOOLS);
						updateWidget(ctx);
						updateStatus(ctx);
						const remaining = record.steps.filter((s) => !s.done);
						nextPrompt = remaining.length > 0
							? `Execute plan ${formatPlanId(record.id)} "${record.title}". Start with step: ${remaining[0].text}`
							: `Plan ${formatPlanId(record.id)} complete! Mark it as completed.`;
						done();
						return "exit";
					}
					if (action === "edit") {
						nextPrompt = `Edit plan ${formatPlanId(record.id)} "${record.title}": `;
						done();
						return "exit";
					}
					if (action === "view") {
						const overlayAction = await openPlanOverlay(record);
						if (overlayAction === "execute") {
							return applyPlanAction(record, "execute");
						}
						return "stay";
					}
					if (action === "complete") {
						const filePath = getPlanPath(plansDir, record.id);
						await withPlanLock(plansDir, record.id, ctx, async () => {
							const existing = await readPlanFile(filePath, record.id);
							existing.status = "completed";
							existing.assigned_to_session = undefined;
							await writePlanFile(filePath, existing);
						});
						const updated = await listPlans(plansDir);
						selector?.setPlans(updated);
						ctx.ui.notify(`Completed plan ${formatPlanId(record.id)}`, "info");
						if (activePlanId === record.id) {
							activePlanId = null;
							updateWidget(ctx);
							updateStatus(ctx);
						}
						return "stay";
					}
					if (action === "reopen") {
						const filePath = getPlanPath(plansDir, record.id);
						await withPlanLock(plansDir, record.id, ctx, async () => {
							const existing = await readPlanFile(filePath, record.id);
							existing.status = "draft";
							await writePlanFile(filePath, existing);
						});
						const updated = await listPlans(plansDir);
						selector?.setPlans(updated);
						ctx.ui.notify(`Reopened plan ${formatPlanId(record.id)}`, "info");
						return "stay";
					}
					if (action === "release") {
						const filePath = getPlanPath(plansDir, record.id);
						await withPlanLock(plansDir, record.id, ctx, async () => {
							const existing = await readPlanFile(filePath, record.id);
							existing.assigned_to_session = undefined;
							await writePlanFile(filePath, existing);
						});
						const updated = await listPlans(plansDir);
						selector?.setPlans(updated);
						ctx.ui.notify(`Released plan ${formatPlanId(record.id)}`, "info");
						if (activePlanId === record.id) {
							activePlanId = null;
							updateWidget(ctx);
							updateStatus(ctx);
						}
						return "stay";
					}
					if (action === "delete") {
						const confirm = await ctx.ui.confirm("Delete plan?", `Delete ${formatPlanId(record.id)} "${record.title}"?`);
						if (!confirm) return "stay";
						await withPlanLock(plansDir, record.id, ctx, async () => {
							await fs.unlink(getPlanPath(plansDir, record.id));
						});
						const updated = await listPlans(plansDir);
						selector?.setPlans(updated);
						ctx.ui.notify(`Deleted plan ${formatPlanId(record.id)}`, "info");
						if (activePlanId === record.id) {
							activePlanId = null;
							updateWidget(ctx);
							updateStatus(ctx);
						}
						return "stay";
					}
					return "stay";
				};

				const showActionMenu = async (plan: PlanFrontMatter | PlanRecord) => {
					const record = "body" in plan ? plan : await resolvePlanRecord(plan);
					if (!record) return;
					actionMenu = new PlanActionMenuComponent(
						theme,
						record,
						(action) => {
							void (async () => {
								const result = await applyPlanAction(record, action);
								if (result === "stay") setActiveComponent(selector);
							})();
						},
						() => setActiveComponent(selector),
					);
					setActiveComponent(actionMenu);
				};

				selector = new PlanSelectorComponent(
					tui, theme, plans,
					(plan) => { void showActionMenu(plan); },
					() => done(),
					trimmedArgs || undefined,
					currentSessionId,
					(plan, action) => {
						void (async () => {
							const record = await resolvePlanRecord(plan);
							if (!record) return;
							await applyPlanAction(record, action);
						})();
					},
				);

				setActiveComponent(selector);

				return {
					get focused() { return wrapperFocused; },
					set focused(value: boolean) {
						wrapperFocused = value;
						if (activeComponent && "focused" in activeComponent) activeComponent.focused = value;
					},
					render(width: number) { return activeComponent ? activeComponent.render(width) : []; },
					invalidate() { activeComponent?.invalidate(); },
					handleInput(data: string) { activeComponent?.handleInput?.(data); },
				};
			});

			if (nextPrompt) {
				ctx.ui.setEditorText(nextPrompt);
				rootTui?.requestRender();
			}
		},
	});

	// Register Ctrl+X shortcut for planning mode toggle
	pi.registerShortcut("ctrl+x", {
		description: "Toggle planning mode",
		handler: async (ctx) => {
			togglePlanningMode(ctx);
		},
	});

	// Initialize on session start
	pi.on("session_start", async (_event, ctx) => {
		const plansDir = getPlansDir(ctx.cwd);
		await ensurePlansDir(plansDir);
		const settings = await readPlanSettings(plansDir);
		await garbageCollectPlans(plansDir, settings);

		// Check CLI flag
		if (pi.getFlag("plan") === true) {
			planningModeEnabled = true;
			pi.setActiveTools(PLAN_MODE_TOOLS);
		}

		updateStatus(ctx);
		updateWidget(ctx);
	});

	// Restore on session switch
	pi.on("session_switch", async (_event, ctx) => {
		updateStatus(ctx);
		updateWidget(ctx);
	});
}
