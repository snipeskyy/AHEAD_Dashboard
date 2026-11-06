/** Tiny, dependency-free HTML helpers for enrichers (pure; tolerant of messy markup). */

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  reg: "®",
  trade: "™",
  copy: "©",
};

export function decodeEntities(s: string) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Visible text: drops scripts/styles/hidden XBRL headers, keeps block boundaries as newlines. */
export function htmlToText(html: string) {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|ix:header)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<(br|\/p|\/div|\/tr|\/li|\/h[1-6]|\/td)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t ]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

const attr = (tag: string, name: string) => {
  const m = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag);
  return m ? decodeEntities(m[2] ?? m[3] ?? m[4] ?? "").trim() : null;
};

export function metaContent(html: string, key: string) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const k = (attr(tag, "name") ?? attr(tag, "property") ?? "").toLowerCase();
    if (k === key.toLowerCase()) return attr(tag, "content");
  }
  return null;
}

export function linkTags(html: string) {
  return (html.match(/<link\b[^>]*>/gi) ?? []).map((t) => ({
    rel: (attr(t, "rel") ?? "").toLowerCase(),
    type: (attr(t, "type") ?? "").toLowerCase(),
    href: attr(t, "href"),
    title: attr(t, "title"),
  }));
}

/** Anchors with absolute hrefs and their visible text. */
export function anchors(html: string, base: string) {
  const out: Array<{ href: string; text: string }> = [];
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = attr(m[1], "href");
    if (!href || href.startsWith("#") || /^(mailto|tel|javascript):/i.test(href)) continue;
    try {
      out.push({ href: new URL(href, base).toString(), text: htmlToText(m[2]).slice(0, 120) });
    } catch {
      /* ignore malformed */
    }
  }
  return out;
}

/** All JSON-LD objects on the page, flattened (@graph expanded). Invalid blocks are skipped. */
export function jsonLd(html: string): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  for (const m of html.matchAll(
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const v = JSON.parse(m[1].trim());
      const push = (x: unknown) => {
        if (Array.isArray(x)) x.forEach(push);
        else if (x && typeof x === "object") {
          const o = x as Record<string, unknown>;
          out.push(o);
          if (o["@graph"]) push(o["@graph"]);
        }
      };
      push(v);
    } catch {
      /* skip */
    }
  }
  return out;
}

/** Sentence around a match, trimmed to `max` characters (evidence snippets, never whole sections). */
export function sentenceAround(text: string, index: number, max = 300) {
  const start = Math.max(
    text.lastIndexOf(". ", index) + 2,
    text.lastIndexOf("\n", index) + 1,
    index - max,
  );
  let end = text.indexOf(". ", index);
  end = end === -1 ? Math.min(text.length, index + max) : end + 1;
  let s = text
    .slice(start, Math.min(end, start + max))
    .replace(/\s+/g, " ")
    .trim();
  if (end - start > max) s += "…";
  return s;
}
