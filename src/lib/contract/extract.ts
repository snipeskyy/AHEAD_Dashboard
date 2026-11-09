/**
 * Pulls the contract JSON out of pasted text (Phase 15). AI tools such as Glean often wrap JSON in a Markdown code
 * fence or add a sentence before or after it. Pure; throws a readable error when no JSON object is found.
 */
export function extractJson(text: string): unknown {
  const t = text.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(t);
  const body = fenced ? fenced[1] : t;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start)
    throw new Error("No JSON object found. Paste the whole acc-data file.");
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch (e) {
    throw new Error(
      `The pasted text isn't valid JSON (${e instanceof Error ? e.message : "parse error"}).`,
    );
  }
}
