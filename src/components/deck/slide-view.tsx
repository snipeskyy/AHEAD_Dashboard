import type { CSSProperties, ReactNode } from "react";
import type { DeckTheme, Slide } from "@/lib/deck/types";
import type { Block } from "@/lib/export/types";

/** Base canvas; scaled with CSS for thumbnails, the presenter and 16:9 PDF pages. */
export const SLIDE_W = 1280;
export const SLIDE_H = 720;

const hex = (c: string) => `#${c}`;
type Ctx = { t: DeckTheme; footer: string; index: number; total: number };

/**
 * One slide in HTML (same layouts as the PPTX renderer). Pure presentational component used by the
 * PDF deck route, builder thumbnails and the presenter. Charts use the server-rendered SVG.
 */
export function SlideView({ slide, theme, footer, index, total, scale = 1 }: { slide: Slide; theme: DeckTheme; footer: string; index: number; total: number; scale?: number }) {
  const t = theme;
  const ctx: Ctx = { t, footer, index, total };
  const full = slide.layout === "title" || slide.layout === "divider";
  const bg = slide.layout === "divider" ? hex(t.primary) : slide.layout === "closing" ? hex(t.soft) : hex(t.surface);
  return (
    <div style={{ width: SLIDE_W * scale, height: SLIDE_H * scale, overflow: "hidden" }} aria-label={`Slide ${index + 1}: ${slide.title}`} role="img">
      <div
        className="relative"
        style={{ width: SLIDE_W, height: SLIDE_H, background: bg, color: hex(t.ink), fontFamily: `${t.fontBody}, Helvetica, sans-serif`, transform: `scale(${scale})`, transformOrigin: "top left", outline: slide.redacted ? "4px dashed #EDA100" : undefined }}
        data-slide-layout={slide.layout}
      >
        {LAYOUT[slide.layout](slide, ctx)}
        {!full && <Footer {...ctx} />}
        {/* eslint-disable-next-line @next/next/no-img-element -- local brand asset as a data URL */}
        {!full && t.logo && <img src={t.logo} alt="" style={{ position: "absolute", top: 30, right: 58, height: 40, maxWidth: 160, objectFit: "contain" }} />}
      </div>
    </div>
  );
}

function Footer({ t, footer, index, total }: Ctx) {
  return (
    <div style={{ position: "absolute", left: 58, right: 58, bottom: 18, borderTop: `1px solid ${hex(t.rule)}`, paddingTop: 8, display: "flex", justifyContent: "space-between", fontSize: 13, color: hex(t.muted) }}>
      <span>{footer}</span>
      <span>
        {index + 1} / {total}
      </span>
    </div>
  );
}

function Header({ s, t }: { s: Slide; t: DeckTheme }) {
  return (
    <div style={{ position: "absolute", left: 58, top: 32, right: 260 }}>
      {s.kicker && <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: hex(t.primary) }}>{s.kicker}</div>}
      <div style={{ fontSize: 36, fontWeight: 700, lineHeight: 1.15, marginTop: 4, fontFamily: `${t.fontHead}, Helvetica, sans-serif` }}>{s.title}</div>
      {s.subtitle && <div style={{ fontSize: 15, color: hex(t.muted), marginTop: 4 }}>{s.subtitle}</div>}
    </div>
  );
}

const Body = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div style={{ position: "absolute", left: 58, right: 58, top: 150, bottom: 70, ...style }}>{children}</div>
);

/** Metric tiles: big for short numbers, smaller for words and long values so tiles stay balanced. */
export const kpiSize = (v: string) => (v.length > 16 ? 24 : v.length > 9 || !/\d/.test(v) ? 30 : 44);

const items = (blocks: Block[]) => blocks.flatMap((b) => (b.kind === "paragraph" ? [{ text: b.text, sub: undefined as string | undefined }] : b.kind === "list" ? b.items : []));

function Bullets({ list, t, size = 24 }: { list: Array<{ text: string; sub?: string }>; t: DeckTheme; size?: number }) {
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: size * 0.6 }}>
      {list.map((i, n) => (
        <li key={n} style={{ display: "flex", gap: 14, fontSize: size, lineHeight: 1.3 }}>
          <span style={{ width: 8, height: 8, borderRadius: 8, background: hex(t.primary), marginTop: size * 0.5, flexShrink: 0 }} />
          <span>
            {i.text}
            {i.sub && <span style={{ display: "block", fontSize: size * 0.68, color: hex(t.muted), marginTop: 2 }}>{i.sub}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ChartBox({ b }: { b: Block | undefined }) {
  if (b?.kind !== "chart") return null;
  if (b.svg) return <div className="[&_svg]:h-full [&_svg]:w-full" style={{ width: "100%", height: "100%" }} dangerouslySetInnerHTML={{ __html: b.svg }} />;
  return (
    <table style={{ fontSize: 16, width: "100%" }}>
      <tbody>
        {b.spec.categories.map((c, i) => (
          <tr key={c}>
            <td>{c}</td>
            {b.spec.series.map((s) => <td key={s.name} style={{ textAlign: "right" }}>{s.values[i]}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type L = (s: Slide, c: Ctx) => ReactNode;
const LAYOUT: Record<Slide["layout"], L> = {
  title: (s, { t }) => (
    <>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 440, background: hex(t.primary) }} />
      {/* eslint-disable-next-line @next/next/no-img-element -- local brand asset as a data URL */}
      {t.logo && <img src={t.logo} alt="" style={{ position: "absolute", left: 500, top: 58, height: 56, maxWidth: 220, objectFit: "contain" }} />}
      <div style={{ position: "absolute", left: 500, right: 70, bottom: 330, fontSize: 52, fontWeight: 700, lineHeight: 1.1, fontFamily: `${t.fontHead}, Helvetica, sans-serif` }}>{s.title}</div>
      {s.subtitle && <div style={{ position: "absolute", left: 500, right: 70, top: 405, fontSize: 22, color: hex(t.muted) }}>{s.subtitle}</div>}
      {s.kicker && <div style={{ position: "absolute", left: 500, bottom: 56, fontSize: 16, color: hex(t.muted) }}>{s.kicker}</div>}
    </>
  ),
  agenda: (s, { t }) => (
    <>
      <Header s={s} t={t} />
      <Body>
        <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 18 }}>
          {items(s.blocks).map((i, n) => (
            <li key={n} style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 26 }}>
              <span style={{ width: 44, height: 44, borderRadius: 44, background: hex(t.primary), color: hex(t.onPrimary), display: "grid", placeItems: "center", fontWeight: 700, fontSize: 20 }}>{n + 1}</span>
              {i.text}
            </li>
          ))}
        </ol>
      </Body>
    </>
  ),
  divider: (s, { t }) => <div style={{ position: "absolute", left: 100, right: 100, top: 290, fontSize: 56, fontWeight: 700, color: hex(t.onPrimary) }}>{s.title}</div>,
  kpis: (s, { t }) => {
    const b = s.blocks[0];
    const list = b?.kind === "kv" ? b.items : [];
    const cols = Math.min(4, Math.max(1, list.length));
    return (
      <>
        <Header s={s} t={t} />
        <Body style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 24, alignContent: "start", paddingTop: 20 }}>
          {list.map((i) => (
            <div key={i.label} style={{ background: hex(t.soft), borderRadius: 12, padding: "26px 26px 22px", minHeight: 170, display: "flex", flexDirection: "column", justifyContent: "flex-end", outline: i.redacted ? "3px dashed #EDA100" : undefined }}>
              <div style={{ fontSize: kpiSize(i.value), fontWeight: 700, lineHeight: 1.1 }}>{i.value}</div>
              <div style={{ fontSize: 17, color: hex(t.muted), marginTop: 8 }}>{i.label}</div>
            </div>
          ))}
        </Body>
      </>
    );
  },
  facts: (s, { t }) => {
    const b = s.blocks[0];
    const list = b?.kind === "kv" ? b.items : [];
    return (
      <>
        <Header s={s} t={t} />
        <Body style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 48, alignContent: "start" }}>
          {list.map((i) => (
            <div key={i.label} style={{ display: "flex", justifyContent: "space-between", gap: 16, borderBottom: `1px solid ${hex(t.rule)}`, padding: "12px 0", fontSize: 18 }}>
              <span style={{ color: hex(t.muted) }}>{i.label}</span>
              <span style={{ fontWeight: 700, textAlign: "right" }}>{i.value}</span>
            </div>
          ))}
        </Body>
      </>
    );
  },
  chart: (s, { t }) => (
    <>
      <Header s={s} t={t} />
      <Body>
        <ChartBox b={s.blocks[0]} />
      </Body>
    </>
  ),
  "chart-takeaway": (s, { t }) => (
    <>
      <Header s={s} t={t} />
      <Body style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 40 }}>
        <ChartBox b={s.blocks[0]} />
        <div style={{ borderLeft: `6px solid ${hex(t.primary)}`, paddingLeft: 22, fontSize: 26, fontWeight: 700, lineHeight: 1.3, alignSelf: "start", marginTop: 20 }}>{s.takeaway}</div>
      </Body>
    </>
  ),
  table: (s, { t }) => {
    const b = s.blocks[0];
    if (b?.kind !== "table") return <Header s={s} t={t} />;
    return (
      <>
        <Header s={s} t={t} />
        <Body>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 17 }}>
            <thead>
              <tr>{b.columns.map((c) => <th key={c.key} style={{ background: hex(t.primary), color: hex(t.onPrimary), textAlign: c.align ?? "left", padding: "10px 12px" }}>{c.label}</th>)}</tr>
            </thead>
            <tbody>
              {b.rows.map((r, i) => (
                <tr key={i} style={{ background: i % 2 ? hex(t.soft) : hex(t.surface) }}>
                  {b.columns.map((c) => <td key={c.key} style={{ padding: "9px 12px", textAlign: c.align ?? "left", borderBottom: `1px solid ${hex(t.rule)}` }}>{r[c.key]?.text}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          {b.caption && <div style={{ fontSize: 14, color: hex(t.muted), marginTop: 10, fontStyle: "italic" }}>{b.caption}</div>}
        </Body>
      </>
    );
  },
  bullets: (s, { t }) => (
    <>
      <Header s={s} t={t} />
      <Body>
        <Bullets list={items(s.blocks)} t={t} />
      </Body>
    </>
  ),
  "two-column": (s, { t }) => {
    const l = items(s.blocks);
    const half = Math.ceil(l.length / 2);
    return (
      <>
        <Header s={s} t={t} />
        <Body style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48 }}>
          <Bullets list={l.slice(0, half)} t={t} size={20} />
          <Bullets list={l.slice(half)} t={t} size={20} />
        </Body>
      </>
    );
  },
  quote: (s, { t }) => {
    const b = s.blocks[0];
    return (
      <>
        <Header s={s} t={t} />
        <Body style={{ display: "flex", alignItems: "center" }}>
          <div style={{ borderLeft: `10px solid ${b?.kind === "callout" && b.tone === "warning" ? "#EDA100" : hex(t.primary)}`, paddingLeft: 36, fontSize: 38, lineHeight: 1.3 }}>{b?.kind === "callout" ? b.text : ""}</div>
        </Body>
      </>
    );
  },
  image: (s, { t }) => {
    const b = s.blocks[0];
    return (
      <>
        <Header s={s} t={t} />
        <Body style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          {b?.kind === "image" && <div role="img" aria-label={b.alt} className="[&_svg]:h-full [&_svg]:max-h-full [&_svg]:w-auto [&_svg]:max-w-full" style={{ height: "100%", width: "100%", display: "flex", justifyContent: "center" }} dangerouslySetInnerHTML={{ __html: b.svg }} />}
        </Body>
      </>
    );
  },
  closing: (s, { t }) => {
    const l = items(s.blocks);
    return (
      <>
        <Header s={{ ...s, kicker: undefined }} t={t} />
        <Body>{l.length ? <Bullets list={l} t={t} /> : <div style={{ fontSize: 30, color: hex(t.muted), marginTop: 120 }}>Questions and discussion</div>}</Body>
        {s.kicker && <div style={{ position: "absolute", left: 58, bottom: 70, fontSize: 18, fontWeight: 700 }}>{s.kicker}</div>}
      </>
    );
  },
};

/** The footer line used on every content slide (same text as the PPTX master). */
export function deckFooter(doc: { audience: string; watermark: string; dateStamp: boolean; generatedAt: string; version: number }, t: DeckTheme) {
  return [t.footerNote, doc.audience === "customer" ? null : "Internal", doc.watermark || null, doc.dateStamp ? doc.generatedAt.slice(0, 10) : null, `v${doc.version}`].filter(Boolean).join("  ·  ");
}
