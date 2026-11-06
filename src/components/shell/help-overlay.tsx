"use client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { registry } from "@/modules/registry";
import { useUiStore } from "@/stores/ui-store";

const GLOBAL: Array<[string, string]> = [
  ["⌘K / Ctrl+K", "Command palette: jump to anything, run actions"],
  ["T", "New task"],
  ["C", "Quick capture (meeting notes → note + tasks)"],
  ["?", "This help"],
  ["Esc", "Close dialogs and panels"],
];
export const TRIAGE_KEYS: Array<[string, string]> = [
  ["J / K", "Next / previous signal"],
  ["S", "Star"],
  ["D", "Dismiss"],
  ["P", "Convert to play"],
  ["O", "Convert to opportunity"],
  ["N", "Add note"],
  ["T", "Create task"],
  ["Enter", "Open details"],
  ["E", "Mark handled (read)"],
];

function Keys({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-1.5 text-[13px]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt><kbd className="bg-muted rounded border px-1.5 py-0.5 font-mono text-[11px]">{k}</kbd></dt>
          <dd className="text-muted-foreground">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** "?" — every keyboard shortcut, including the G-sequences registered by modules. */
export function HelpOverlay() {
  const open = useUiStore((s) => s.helpOpen);
  const setOpen = useUiStore((s) => s.setHelpOpen);
  const flags = useFeatureFlags();
  const seq = registry.commands(flags).filter((c) => c.shortcut).map((c) => [c.shortcut!, c.label] as [string, string]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Single keys work anywhere except while typing in a field.</DialogDescription>
        </DialogHeader>
        <section className="grid gap-2"><h3 className="text-xs font-semibold tracking-wide uppercase">Everywhere</h3><Keys rows={GLOBAL} /></section>
        <section className="grid gap-2"><h3 className="text-xs font-semibold tracking-wide uppercase">Go to (press G, then the key)</h3><Keys rows={seq} /></section>
        <section className="grid gap-2"><h3 className="text-xs font-semibold tracking-wide uppercase">Signal triage</h3><Keys rows={TRIAGE_KEYS} /></section>
      </DialogContent>
    </Dialog>
  );
}
