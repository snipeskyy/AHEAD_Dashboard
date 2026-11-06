import { htmlToText, sentenceAround } from "../../html";
import type { ProposalInput } from "../../types";
import { SECTIONS, THEMES } from "./rules";

const NEXT_ITEM = /\n\s*item\s*\d+[a-c]?\.?\s/gi;

/**
 * Splits a 10-K into the items we mine. The table of contents repeats every heading, so for each item
 * we take the occurrence followed by the longest body (the real section, not the TOC line).
 */
export function splitSections(text: string) {
  const out: Array<{ id: string; label: string; body: string }> = [];
  for (const s of SECTIONS) {
    let best = "";
    for (const m of text.matchAll(s.re)) {
      const start = m.index! + m[0].length;
      NEXT_ITEM.lastIndex = start;
      const nxt = NEXT_ITEM.exec(text);
      const body = text.slice(start, nxt ? nxt.index : Math.min(text.length, start + 400_000));
      if (body.length > best.length) best = body;
    }
    if (best.length > 150) out.push({ id: s.id, label: s.label, body: best });
  }
  return out;
}

/** Filing text → initiative evidence proposals (one per theme, best sentence, confidence by frequency). */
export function mineFiling(
  html: string,
  meta: { url: string; form: string; filed: string },
): ProposalInput[] {
  const sections = splitSections(htmlToText(html));
  const out: ProposalInput[] = [];
  for (const t of THEMES) {
    let hits = 0;
    let best: { section: string; snippet: string } | null = null;
    for (const s of sections)
      for (const re of t.patterns) {
        const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
        for (const m of s.body.matchAll(g)) {
          hits++;
          if (!best || (s.id !== "1A" && best.section.includes("1A")))
            best = { section: s.label, snippet: sentenceAround(s.body, m.index!) };
        }
      }
    if (!hits || !best) continue;
    out.push({
      field: `evidence.initiative:${t.id}`,
      value: {
        title: t.title,
        practiceAreas: t.practiceAreas,
        section: `${meta.form} ${best.section}`,
        description: `${hits} mention${hits === 1 ? "" : "s"} in the ${meta.form} filed ${meta.filed}`,
        kind: "filing",
      },
      sourceUrl: meta.url,
      confidence: hits >= 5 ? "high" : hits >= 2 ? "medium" : "low",
      evidenceSnippet: best.snippet,
      source: `SEC ${meta.form}`,
    });
  }
  return out;
}
