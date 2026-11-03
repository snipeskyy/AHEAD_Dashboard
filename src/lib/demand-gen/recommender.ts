import { practiceLabel } from "@/config/practice-areas";
import { SIGNAL_TYPE_LABELS } from "@/lib/domain/enums";

/**
 * Explainable play recommender. Pure: every point a play earns comes with a human-readable reason.
 * Inputs: whitespace, initiatives, recent signals, buying-committee coverage, running campaigns.
 */
export interface PlayLite {
  id: string;
  name: string;
  practiceArea: string;
  targetPersonas: string[];
  triggerKeywords: string[];
  triggerSignalTypes: string[];
}

export interface RecommenderContext {
  practiceStatus: Record<string, string>;
  initiatives: Array<{ title: string; practiceAreas: string[]; confidence: number }>;
  signals: Array<{
    id: string;
    title: string;
    type: string;
    practiceTags: string[];
    relevance: number;
  }>;
  personas: Array<{ title: string; buyingRole: string; engagement: string }>;
  runningPlayIds: string[];
}

export interface Reason {
  kind: "whitespace" | "initiative" | "signal" | "committee" | "penalty";
  text: string;
  points: number;
  evidenceId?: string;
}

export interface PlayRecommendation {
  play: PlayLite;
  score: number;
  reasons: Reason[];
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Whole-word, case-insensitive keyword match ("AI" must not match "maintain"). */
export const kwMatch = (text: string, kws: string[]) =>
  kws.find((k) =>
    new RegExp(`(^|[^\\p{L}\\p{N}])${esc(k)}s?(?=$|[^\\p{L}\\p{N}])`, "iu").test(text),
  );

export function signalMatchesPlay(
  play: PlayLite,
  s: { title: string; type: string; practiceTags: string[] },
): string | null {
  const kw = kwMatch(s.title, play.triggerKeywords);
  if (kw) return `mentions “${kw}”`;
  if (play.triggerSignalTypes.includes(s.type) && s.practiceTags.includes(play.practiceArea))
    return `${(SIGNAL_TYPE_LABELS as Record<string, string>)[s.type] ?? s.type} signal in ${practiceLabel(play.practiceArea, true)}`;
  return null;
}

export function recommendPlays(
  plays: PlayLite[],
  ctx: RecommenderContext,
  max = 5,
): PlayRecommendation[] {
  const recs = plays.map((play) => {
    const reasons: Reason[] = [];
    const status = ctx.practiceStatus[play.practiceArea] ?? "NotEngaged";
    const label = practiceLabel(play.practiceArea);
    if (status === "NotEngaged")
      reasons.push({
        kind: "whitespace",
        text: `Whitespace: no engagement yet in ${label}`,
        points: 20,
      });
    else if (status === "Exploring")
      reasons.push({
        kind: "whitespace",
        text: `${label} is in exploration — a play can convert it`,
        points: 14,
      });
    else if (status === "ActiveOpp")
      reasons.push({
        kind: "whitespace",
        text: `Supports the active ${label} opportunity`,
        points: 6,
      });

    for (const i of ctx.initiatives
      .filter((x) => x.practiceAreas.includes(play.practiceArea))
      .slice(0, 2)) {
      reasons.push({
        kind: "initiative",
        text: `Initiative: ${i.title}`,
        points: Math.round(25 * i.confidence),
      });
    }

    let sigPts = 0;
    let sigCount = 0;
    const seenTitles = new Set<string>();
    for (const s of [...ctx.signals].sort((a, b) => b.relevance - a.relevance)) {
      const why = signalMatchesPlay(play, s);
      if (!why || sigPts >= 30 || sigCount >= 3 || seenTitles.has(s.title)) continue;
      seenTitles.add(s.title);
      sigCount++;
      const pts = Math.max(3, Math.round(s.relevance / 8));
      sigPts += pts;
      reasons.push({
        kind: "signal",
        text: `Signal: ${s.title} (${why})`,
        points: pts,
        evidenceId: s.id,
      });
    }

    const unengaged = ctx.personas.filter(
      (p) =>
        play.targetPersonas.includes(p.title) &&
        (p.engagement === "None" || p.engagement === "Light"),
    );
    if (unengaged.length)
      reasons.push({
        kind: "committee",
        text: `Targets ${unengaged[0].title}${unengaged.length > 1 ? ` +${unengaged.length - 1}` : ""} (not yet engaged)`,
        points: 6,
      });
    const hasEB = ctx.personas.some((p) => p.buyingRole === "EconomicBuyer");
    if (!hasEB && play.targetPersonas.some((t) => /chief|cio|cfo|cto|ciso/i.test(t)))
      reasons.push({
        kind: "committee",
        text: "Helps reach an Economic Buyer (none identified yet)",
        points: 8,
      });

    if (ctx.runningPlayIds.includes(play.id))
      reasons.push({ kind: "penalty", text: "Already running for this account", points: -40 });

    const raw = reasons.reduce((s, r) => s + r.points, 0);
    return {
      play,
      score: Math.max(0, Math.min(100, raw)),
      reasons: reasons.sort((a, b) => b.points - a.points),
    };
  });
  return recs
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, max);
}

/** Plays that fit a single signal (for "convert signal to play"). */
export function playsForSignal(
  plays: PlayLite[],
  s: { title: string; type: string; practiceTags: string[] },
) {
  return plays
    .map((p) => ({
      play: p,
      why:
        signalMatchesPlay(p, s) ??
        (s.practiceTags.includes(p.practiceArea)
          ? `same practice area (${practiceLabel(p.practiceArea, true)})`
          : null),
    }))
    .filter((x): x is { play: PlayLite; why: string } => !!x.why)
    .sort((a, b) => Number(b.why.startsWith("mentions")) - Number(a.why.startsWith("mentions")));
}
