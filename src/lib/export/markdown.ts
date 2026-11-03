import type { Block, ExportDocument } from "./types";

const fmtCell = (c: { text: string; href?: string } | undefined) => {
  if (!c) return "";
  const t = c.text.replace(/\|/g, "\\|").replace(/\n/g, " ");
  return c.href ? `[${t}](${c.href})` : t;
};

function blockToMd(b: Block): string {
  switch (b.kind) {
    case "heading":
      return `${"#".repeat((b.level ?? 3) + 1)} ${b.text}`;
    case "paragraph":
      return b.text;
    case "callout":
      return `> ${b.text}`;
    case "kv":
      return b.items.map((i) => `- **${i.label}:** ${i.value}`).join("\n");
    case "list":
      return b.items
        .map(
          (i, n) =>
            `${b.ordered ? `${n + 1}.` : "-"} ${i.href ? `[${i.text}](${i.href})` : i.text}${i.sub ? ` — ${i.sub}` : ""}`,
        )
        .join("\n");
    case "table": {
      if (!b.columns.length) return "";
      const head = `| ${b.columns.map((c) => c.label).join(" | ")} |`;
      const sep = `| ${b.columns.map((c) => (c.align === "right" ? "---:" : "---")).join(" | ")} |`;
      const rows = b.rows.map((r) => `| ${b.columns.map((c) => fmtCell(r[c.key])).join(" | ")} |`);
      return [b.caption ? `*${b.caption}*\n` : "", head, sep, ...rows].join("\n");
    }
    case "chart": {
      // Charts become their accessible table equivalent in Markdown.
      const head = `| ${["", ...b.spec.series.map((s) => s.name)].join(" | ")} |`;
      const sep = `| ${["---", ...b.spec.series.map(() => "---:")].join(" | ")} |`;
      const rows = b.spec.categories.map(
        (c, i) =>
          `| ${[c, ...b.spec.series.map((s) => String(Math.round(s.values[i] * 100) / 100))].join(" | ")} |`,
      );
      return [`**${b.title}**`, "", head, sep, ...rows].join("\n");
    }
  }
}

/** Markdown rendering of an already-redacted document. */
export function documentToMarkdown(doc: ExportDocument): string {
  const lines: string[] = [];
  lines.push(`# ${doc.title}`, "");
  lines.push(`_${doc.subtitle}_`, "");
  const meta = [
    doc.scopeLabel,
    doc.dateStamp ? new Date(doc.generatedAt).toISOString().slice(0, 10) : null,
    `v${doc.version}`,
    doc.preparedBy ? `Prepared by ${doc.preparedBy}` : null,
  ].filter(Boolean);
  lines.push(meta.join(" · "), "");
  if (doc.watermark) lines.push(`> **${doc.watermark}**`, "");
  if (doc.isDemo) lines.push("> DEMO DATA — fictional companies and synthetic signals.", "");
  for (const s of doc.sections) {
    lines.push(`## ${s.title}`, "");
    for (const b of s.blocks) {
      const md = blockToMd(b);
      if (md) lines.push(md, "");
    }
  }
  return (
    lines
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trimEnd() + "\n"
  );
}
