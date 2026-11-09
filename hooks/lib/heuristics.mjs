export const STOP_TOOL_THRESHOLD = 5;
export const STOP_EDIT_THRESHOLD = 3;

// `notes\b` covers the plan fixture ("notes say about"); `notes about` alone does not.
const PROMPT_RE = /second-brain|silverbullet|indexgraph|aprendizado|learning|preference|preferences|my way of working|jeito de|notas\b|notes about|notes\b|sb\b/i;

export function promptMatches(prompt) {
  return typeof prompt === 'string' && PROMPT_RE.test(prompt);
}

function readCount(input, camel, snake) {
  const raw = input?.[camel] ?? input?.[snake];
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function isSubstantial(input = {}) {
  const tools = readCount(input, 'toolCallCount', 'tool_call_count');
  const edits = readCount(input, 'editCount', 'edit_count');
  return tools >= STOP_TOOL_THRESHOLD || edits >= STOP_EDIT_THRESHOLD;
}

/** True when the payload carries tool/edit counts (subagentStop does; stop does not). */
export function hasCountFields(input = {}) {
  return (
    input.toolCallCount != null
    || input.tool_call_count != null
    || input.editCount != null
    || input.edit_count != null
  );
}
