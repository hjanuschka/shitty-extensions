/**
 * Funny Working Message Extension
 *
 * Replaces the built-in "Working..." label shown next to the spinner while PI
 * is streaming.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const DEBUG_FORCE_MESSAGE: string | undefined = "<<< FUN-WORKING ACTIVE >>>";

const WORDS = [
	"Simmering... (esc to interrupt)",
	"Julienning... (esc to interrupt)",
	"Shimmering... (esc to interrupt)",
	"Braising... (esc to interrupt)",
	"Reducing... (esc to interrupt)",
	"Caramelizing... (esc to interrupt)",
	"Whisking... (esc to interrupt)",
	"Deglazing... (esc to interrupt)",
	"Proofing... (esc to interrupt)",
	"Kneading... (esc to interrupt)",
	"Plating... (esc to interrupt)",
	"Garnishing... (esc to interrupt)",
	"Seasoning... (esc to interrupt)",
	"Grinding pepper... (esc to interrupt)",
	"Zesting... (esc to interrupt)",
	"Chiffonading... (esc to interrupt)",
	"Mise en placing... (esc to interrupt)",
	"Sauce whispering... (esc to interrupt)",
	"Fondanting... (esc to interrupt)",
	"Emulsifying... (esc to interrupt)",
	"Clarifying butter... (esc to interrupt)",
	"Toasting spices... (esc to interrupt)",
	"Blooming gelatin... (esc to interrupt)",
	"Tempering chocolate... (esc to interrupt)",
	"Folding gently... (esc to interrupt)",
	"Sifting... (esc to interrupt)",
	"Preheating... (esc to interrupt)",
	"Basting... (esc to interrupt)",
	"Resting dough... (esc to interrupt)",
	"Resting the roast... (esc to interrupt)",
	"Crisping edges... (esc to interrupt)",
	"Rendering fat... (esc to interrupt)",
	"Glazing... (esc to interrupt)",
	"Torching... (esc to interrupt)",
	"Blanching... (esc to interrupt)",
	"Shocking... (esc to interrupt)",
	"Finishing with a squeeze of lemon... (esc to interrupt)",
	"Counting microseconds... (esc to interrupt)",
	"Indexing neurons... (esc to interrupt)",
	"Compiling vibes... (esc to interrupt)",
	"Refactoring reality... (esc to interrupt)",
	"Reticulating splines... (esc to interrupt)",
	"Tightening feedback loops... (esc to interrupt)",
	"Calibrating taste buds... (esc to interrupt)",
	"Stirring the semantic soup... (esc to interrupt)",
	"Resolving dependencies... (esc to interrupt)",
	"Aligning parentheses... (esc to interrupt)",
	"Normalizing whitespace... (esc to interrupt)",
	"Polishing edge cases... (esc to interrupt)",
	"Negotiating with entropy... (esc to interrupt)",
	"Petting the garbage collector... (esc to interrupt)",
	"Waking up the type checker... (esc to interrupt)",
	"Summoning documentation... (esc to interrupt)",
	"Searching for the missing semicolon... (esc to interrupt)",
	"Assembling breadcrumbs... (esc to interrupt)",
	"Rolling back time... (esc to interrupt)",
	"Spinning up tiny hamsters... (esc to interrupt)",
	"Charging the flux capacitor... (esc to interrupt)",
	"Tuning the banjo of truth... (esc to interrupt)",
	"Consulting the rubber duck... (esc to interrupt)",
	"Offering snacks to the linter... (esc to interrupt)",
	"Negotiating with the CI... (esc to interrupt)",
	"Herding bytes... (esc to interrupt)",
	"Routing packets politely... (esc to interrupt)",
	"Untangling spaghetti... (esc to interrupt)",
	"Converting coffee to code... (esc to interrupt)",
	"Decompressing thoughts... (esc to interrupt)",
	"Spooling wisdom... (esc to interrupt)",
	"Focusing the laser pointer... (esc to interrupt)",
	"Weighing trade-offs... (esc to interrupt)",
	"Sanding rough edges... (esc to interrupt)",
	"Measuring twice, cutting once... (esc to interrupt)",
	"Counting to infinity... (esc to interrupt)",
	"Almost done™... (esc to interrupt)",
	"Doing it live... (esc to interrupt)",
	"Spinning in place... (esc to interrupt)",
	"Casting spells... (esc to interrupt)",
	"Whispering to sockets... (esc to interrupt)",
	"Hugging the cache... (esc to interrupt)",
	"Rehearsing apologies to future me... (esc to interrupt)",
	"Planting TODOs... (esc to interrupt)",
	"Harvesting TODOs... (esc to interrupt)",
	"Stacking brackets... (esc to interrupt)",
	"Leveling up the logs... (esc to interrupt)",
	"Subdividing dragons... (esc to interrupt)",
	"Warming up the electrons... (esc to interrupt)",
	"Squeezing latency... (esc to interrupt)",
	"Shaving yaks... (esc to interrupt)",
	"Appeasing the build gods... (esc to interrupt)",
	"Nudging bits into place... (esc to interrupt)",
	"Greasing the gears... (esc to interrupt)",
	"Summarizing the unsummarizable... (esc to interrupt)",
	"Drafting a tiny masterpiece... (esc to interrupt)",
	"Checking the map, not the territory... (esc to interrupt)",
	"Spinning up hypotheses... (esc to interrupt)",
	"Chasing the last 1%... (esc to interrupt)",
	"Hunting heisenbugs... (esc to interrupt)",
	"Crossing the streams... (esc to interrupt)",
	"Aligning chakras (and tabs)... (esc to interrupt)",
	"Buffering... (esc to interrupt)",
	"Unbuffering... (esc to interrupt)",
	"Rebuffering... (esc to interrupt)",
	"Transpiling punchlines... (esc to interrupt)",
	"Sharpening pencils... (esc to interrupt)",
	"Sharpening knives (metaphorically)... (esc to interrupt)",
];

function pickWord(): string {
	if (DEBUG_FORCE_MESSAGE) return DEBUG_FORCE_MESSAGE;
	return WORDS[Math.floor(Math.random() * WORDS.length)] ?? "Working... (esc to interrupt)";
}

export default function (pi: ExtensionAPI) {
	let enabled = false;

	pi.registerCommand("fun-working", {
		description: "Toggle funny working message next to spinner",
		handler: async (_args, ctx) => {
			enabled = !enabled;
			if (!enabled) {
				ctx.ui.setWorkingMessage();
				ctx.ui.notify("Restored default working message", "info");
				return;
			}

			// If we toggle while the agent is already streaming, apply immediately.
			if (!ctx.isIdle()) {
				const msg = pickWord();
				ctx.ui.setStatus("fun-working-debug", `command: setWorkingMessage=${JSON.stringify(msg)}`);
				ctx.ui.setWorkingMessage(msg);
			}
			ctx.ui.notify("Funny working message enabled", "info");
		},
	});

	pi.on("agent_start", (_event, ctx) => {
		if (!enabled) return;
		if (!ctx.hasUI) return;
		const msg = pickWord();
		ctx.ui.setStatus("fun-working-debug", `agent_start: setWorkingMessage=${JSON.stringify(msg)}`);
		ctx.ui.setWorkingMessage(msg);
	});

	pi.on("agent_end", (_event, ctx) => {
		if (!enabled) return;
		if (!ctx.hasUI) return;
		ctx.ui.setStatus("fun-working-debug", "agent_end: restore default working message");
		ctx.ui.setWorkingMessage();
	});
}
