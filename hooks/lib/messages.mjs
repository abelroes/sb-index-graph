export const SESSION = `Second-brain skills may be installed (second-brain manager, second-brain-retrieval, setup-second-brain, managing-learnings). If this session involves notes, preferences, or learnings, route via second-brain. Setup is optional and never blocks retrieval.`;

export const PROMPT_MATCH = `This prompt looks note/preference/learning related. Prefer the second-brain manager handoff to the right specialist. For new learnings, cite candidates before persist.`;

export const STOP_FOLLOWUP = `If this turn produced a durable preference or lesson, offer managing-learnings cite-before-persist. If answers still depend on your notes, use second-brain-retrieval.`;

export const SUBAGENT_FOLLOWUP = `Subagent finished. If it surfaced a lesson worth keeping, cite via managing-learnings; if it needed SilverBullet context, consider second-brain-retrieval.`;

export const PRECOMPACT = `About to compact context. Preserve any second-brain anchors (page names, tags, open questions). After compact, re-run indexGraph digest if work still depends on notes.`;
