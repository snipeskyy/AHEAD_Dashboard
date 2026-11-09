import { EyeOff, FlaskConical } from "lucide-react";
import type { Block, DocSection, ExportDocument } from "@/lib/export/types";
import { cn } from "@/lib/utils";

/**
 * Renders an ExportDocument as "paper" (always light, print-safe colors). Used by the builder's
 * live preview and by the /print route that Playwright turns into a PDF. Pure presentational.
 */
export function DocumentView({ doc, print = false }: { doc: ExportDocument; print?: boolean }) {
  const date = new Date(doc.generatedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return (
    <article
      className={cn(
        "export-doc relative bg-white text-[#121211]",
        print ? "px-0" : "rounded-md border border-[#e3e2dc] px-10 py-10 shadow-sm",
      )}
      style={{
        colorScheme: "light",
        fontFamily: "var(--font-geist-sans), Helvetica, Arial, sans-serif",
      }}
    >
      {doc.watermark && (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none select-none",
            print
              ? "fixed inset-0 z-0 flex items-center justify-center"
              : "absolute inset-0 z-0 flex items-start justify-center overflow-hidden pt-64",
          )}
        >
          <span className="-rotate-[24deg] text-[88px] leading-none font-bold tracking-widest whitespace-nowrap text-[#121211]/[0.06]">
            {doc.watermark}
          </span>
        </div>
      )}
      <header className="relative z-10 mb-8 border-b border-[#e3e2dc] pb-6">
        <div className="mb-3 h-1 w-12 rounded-full bg-[#256abf]" />
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight">{doc.title}</h1>
        <p className="mt-1 text-[15px] text-[#5c5b57]">{doc.subtitle}</p>
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[#5c5b57]">
          <span>{doc.scopeLabel}</span>
          {doc.dateStamp && <span>{date}</span>}
          <span>Version {doc.version}</span>
          {doc.preparedBy && <span>Prepared by {doc.preparedBy}</span>}
          {doc.watermark && (
            <span className="font-semibold tracking-wide text-[#121211]">{doc.watermark}</span>
          )}
        </p>
        {doc.isDemo && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded border border-dashed border-[#b17800] bg-[#fff7e6] px-2 py-1 text-[11px] font-semibold tracking-wide text-[#8a5a00] uppercase">
            <FlaskConical className="size-3" aria-hidden /> Demo data — fictional companies
          </p>
        )}
      </header>
      <div className="relative z-10 grid gap-9">
        {doc.sections.map((s) => (
          <SectionView key={s.id} s={s} />
        ))}
      </div>
    </article>
  );
}

function Hidden({
  children,
  redacted,
  label = "Hidden in this export",
}: {
  children: React.ReactNode;
  redacted?: boolean;
  label?: string;
}) {
  if (!redacted) return <>{children}</>;
  return (
    <div
      data-redacted="true"
      className="relative rounded-md p-1"
      style={{
        backgroundImage:
          "repeating-linear-gradient(135deg, rgba(208,59,59,0.07) 0 6px, transparent 6px 12px)",
        outline: "1px dashed rgba(208,59,59,0.5)",
      }}
    >
      <span className="absolute -top-2 right-2 inline-flex items-center gap-1 rounded bg-white px-1 text-[10px] font-medium text-[#b42323]">
        <EyeOff className="size-3" aria-hidden /> {label}
      </span>
      <div className="line-through decoration-[#b42323]/40 opacity-60">{children}</div>
    </div>
  );
}

function SectionView({ s }: { s: DocSection }) {
  return (
    <section className="break-inside-avoid-page" aria-label={s.title}>
      <Hidden redacted={s.redacted} label="Internal-only section — removed">
        <h2 className="mb-3 border-b border-[#e3e2dc] pb-1.5 text-[17px] font-semibold">
          {s.title}
        </h2>
        <div className="grid gap-3">
          {s.blocks.map((b, i) => (
            <Hidden key={i} redacted={b.redacted}>
              <BlockView b={b} />
            </Hidden>
          ))}
        </div>
      </Hidden>
    </section>
  );
}

const cellCls = (right?: boolean, redacted?: boolean) =>
  cn(
    "border-b border-[#ecebe6] px-2 py-1.5 text-left align-top",
    right && "text-right tabular-nums",
    redacted && "bg-[#fbeaea] text-[#b42323]/60 line-through",
  );

function BlockView({ b }: { b: Block }) {
  switch (b.kind) {
    case "image":
      return (
        <figure className="grid gap-1 break-inside-avoid">
          <div role="img" aria-label={b.alt} className="[&_svg]:h-auto [&_svg]:max-w-full" dangerouslySetInnerHTML={{ __html: b.svg }} />
          {b.caption && <figcaption className="text-[11px] text-[#5c5b57]">{b.caption}</figcaption>}
        </figure>
      );
    case "heading":
      return <h3 className="mt-1 text-[14px] font-semibold">{b.text}</h3>;
    case "paragraph":
      return <p className="text-[13px] leading-relaxed">{b.text}</p>;
    case "callout":
      return (
        <p
          className={cn(
            "rounded border-l-2 px-3 py-2 text-[12px]",
            b.tone === "warning"
              ? "border-[#b17800] bg-[#fff7e6] text-[#8a5a00]"
              : "border-[#256abf] bg-[#f2f6fc] text-[#33445c]",
          )}
        >
          {b.text}
        </p>
      );
    case "kv":
      return (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
          {b.items.map((i, n) => (
            <Hidden key={n} redacted={i.redacted}>
              <div>
                <dt className="text-[11px] text-[#5c5b57]">{i.label}</dt>
                <dd className="text-[15px] font-semibold">{i.value}</dd>
              </div>
            </Hidden>
          ))}
        </dl>
      );
    case "list": {
      const L = b.ordered ? "ol" : "ul";
      return (
        <L className={cn("grid gap-1 pl-5 text-[13px]", b.ordered ? "list-decimal" : "list-disc")}>
          {b.items.map((i, n) => (
            <li key={n} className={cn(i.redacted && "bg-[#fbeaea] text-[#b42323]/60 line-through")}>
              {i.href ? (
                <a href={i.href} className="text-[#1c5cab] underline">
                  {i.text}
                </a>
              ) : (
                i.text
              )}
              {i.sub && <span className="text-[#5c5b57]"> — {i.sub}</span>}
            </li>
          ))}
        </L>
      );
    }
    case "table":
      return (
        <div
          className="overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label={b.caption ?? "Table"}
        >
          <table className="w-full border-collapse text-[11.5px]">
            {b.caption && (
              <caption className="mb-1 text-left text-[11px] text-[#5c5b57]">{b.caption}</caption>
            )}
            <thead>
              <tr>
                {b.columns.map((c) => (
                  <th
                    key={c.key}
                    scope="col"
                    className={cn(
                      cellCls(c.align === "right", c.redacted),
                      "bg-[#f6f6f4] font-semibold text-[#5c5b57]",
                    )}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((r, n) => (
                <tr key={n} className="break-inside-avoid">
                  {b.columns.map((c) => {
                    const cell = r[c.key];
                    return (
                      <td key={c.key} className={cellCls(c.align === "right", c.redacted)}>
                        {cell?.href ? (
                          <a href={cell.href} className="text-[#1c5cab] underline">
                            {cell.text}
                          </a>
                        ) : (
                          (cell?.text ?? "")
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "chart":
      return (
        <figure className="break-inside-avoid">
          <figcaption className="mb-1 text-[12px] font-medium">{b.title}</figcaption>
          {/* SVG is generated server-side by ECharts from our own data with escaped labels. */}
          {b.svg ? (
            <div
              role="img"
              aria-label={b.title}
              className="[&_svg]:h-auto [&_svg]:max-w-full"
              dangerouslySetInnerHTML={{ __html: b.svg }}
            />
          ) : (
            <p className="text-[12px] text-[#5c5b57]">Chart unavailable.</p>
          )}
          <table className="sr-only">
            <caption>{b.title}</caption>
            <thead>
              <tr>
                <th>Category</th>
                {b.spec.series.map((s) => (
                  <th key={s.name}>{s.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.spec.categories.map((c, i) => (
                <tr key={c}>
                  <th>{c}</th>
                  {b.spec.series.map((s) => (
                    <td key={s.name}>{s.values[i]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </figure>
      );
  }
}
