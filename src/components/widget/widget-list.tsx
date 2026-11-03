import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Dense list primitive used by list-style widgets (scrolls within the widget body). */
export function WidgetList({
  height,
  children,
  empty,
}: {
  height: number;
  children: ReactNode;
  empty?: string;
}) {
  const hasItems = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <div className="-mx-4 overflow-y-auto" style={{ height }}>
      {hasItems ? (
        <ul className="divide-y">{children}</ul>
      ) : (
        <p className="text-muted-foreground px-4 py-6 text-center text-[13px]">
          {empty ?? "Nothing to show."}
        </p>
      )}
    </div>
  );
}

export function WidgetRow({ children, className }: { children: ReactNode; className?: string }) {
  return <li className={cn("px-4 py-2", className)}>{children}</li>;
}
