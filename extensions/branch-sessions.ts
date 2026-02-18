/**
 * Branch Sessions Extension
 *
 * Organizes pi sessions by git branch for seamless context switching.
 * Each branch gets its own session directory so you can switch branches
 * without losing conversation context.
 *
 * Session structure:
 * ~/.pi/agent/sessions/
 *   --Users-hjanuschka-myproject--/
 *     --main--/
 *       2026-02-16T...jsonl
 *     --feature-auth--/
 *       2026-02-16T...jsonl
 *     --bugfix-login--/
 *       2026-02-16T...jsonl
 *
 * Note: Switching git branches mid-session will confuse the session context.
 * Start a new pi session after switching branches to get the right context.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

/**
 * Get current git branch name, or null if not in a git repo.
 */
function getGitBranch(cwd: string): string | null {
	try {
		const branch = execSync("git rev-parse --abbrev-ref HEAD", {
			cwd,
			encoding: "utf8",
			stdio: ["pipe", "pipe", "pipe"],
		}).trim();
		return branch || null;
	} catch {
		return null;
	}
}

/**
 * Sanitize branch name for use in filesystem paths.
 * Replaces slashes and colons with dashes, other special chars with underscores.
 */
function sanitizeBranchName(branch: string): string {
	return branch.replace(/[/:]/g, "-").replace(/[^a-zA-Z0-9._-]/g, "_");
}

/**
 * Encode cwd path for use as directory name (same format as pi default).
 * Strips leading slash and replaces path separators with dashes.
 */
function encodeCwd(cwd: string): string {
	return cwd.replace(/^[/\\]/, "").replace(/[/\\:]/g, "-");
}

export default function (pi: ExtensionAPI) {
	pi.on("session_directory", async (event, ctx) => {
		// Skip if CLI provided explicit --session-dir (takes precedence)
		if (event.cliSessionDir) {
			return;
		}

		// Get current git branch
		const branch = getGitBranch(event.cwd);
		if (!branch) {
			// Not in a git repo, let pi use default location
			return;
		}

		// Build session path: ~/.pi/agent/sessions/--{cwd}--/--{branch}--/
		const basePath = join(homedir(), ".pi", "agent");
		const safeCwd = `--${encodeCwd(event.cwd)}--`;
		const safeBranch = `--${sanitizeBranchName(branch)}--`;
		const sessionDir = join(basePath, "sessions", safeCwd, safeBranch);

		// Ensure directory exists
		if (!existsSync(sessionDir)) {
			mkdirSync(sessionDir, { recursive: true });
		}

		return { sessionDir };
	});
}
