"use client";
import { CheckCircle2, CircleSlash, TriangleAlert } from "lucide-react";
import { brandAssetUrl, useBrand } from "@/components/providers/brand-provider";
import { SettingsSection } from "./section";

const LABEL = { logo: "Logo", logoDark: "Logo (dark mode)", mark: "Square icon" } as const;

/** Shows what the local brand pack (brand/brand.json) provides, or how to set one up. */
export function BrandPackStatus() {
  const b = useBrand();
  const logo = brandAssetUrl(b, "logo");
  const configured = !!b && (b.assets.length > 0 || b.hasColors || !!b.appName);
  return (
    <SettingsSection
      title="Brand pack"
      description="Company logos and colors load from the local brand/ folder, which is never committed to git."
    >
      <div className="grid gap-3 text-[13px]">
        {b?.error ? (
          <p className="text-critical-text flex items-start gap-2" role="alert">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> {b.error}
          </p>
        ) : configured ? (
          <>
            <p className="text-good-text flex items-center gap-2">
              <CheckCircle2 className="size-4" aria-hidden /> Brand pack loaded
              {b.appName ? ` (${b.appName})` : ""}
            </p>
            {logo && (
              // eslint-disable-next-line @next/next/no-img-element -- local brand asset preview
              <img
                src={logo}
                alt="Brand logo preview"
                className="h-8 w-auto max-w-[220px] object-contain object-left"
              />
            )}
            <ul className="text-muted-foreground grid gap-0.5 text-xs">
              {(Object.keys(LABEL) as Array<keyof typeof LABEL>).map((k) => (
                <li key={k}>
                  {LABEL[k]}: {b.assets.includes(k) ? "found" : "not set"}
                </li>
              ))}
              <li>Brand color: {b.hasColors ? b.swatch : "not set"}</li>
            </ul>
            {b.adjusted && (
              <p className="text-warning-text flex items-start gap-2 text-xs">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />A brand color was
                adjusted to a readable shade of the same hue (WCAG AA 4.5:1 on the app background).
              </p>
            )}
          </>
        ) : (
          <p className="text-muted-foreground flex items-start gap-2">
            <CircleSlash className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              Not set up. Put your approved logo files and a <code>brand.json</code> in the{" "}
              <code>brand/</code> folder (see <code>brand/README.md</code>), then restart the app.
            </span>
          </p>
        )}
      </div>
    </SettingsSection>
  );
}
