"use client";
import { ClipboardPaste, Download, FileSpreadsheet, FileUp } from "lucide-react";
import Papa from "papaparse";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { KIND_DEFS } from "@/lib/import/kinds";
import { parsePastedList } from "@/lib/import/mapping";
import type { ImportKind, InputType } from "@/lib/import/types";
import { cn } from "@/lib/utils";

export interface SourceTable {
  fileName: string | null;
  inputType: InputType;
  headers: string[];
  rows: Array<Record<string, string>>;
  truncated?: boolean;
}

/** Step 2: upload a CSV / XLSX file or paste rows. Files are parsed by the local server. */
export function SourceStep({
  kind,
  onLoaded,
}: {
  kind: ImportKind;
  onLoaded: (t: SourceTable) => void;
}) {
  const def = KIND_DEFS[kind];
  const [mode, setMode] = useState<"file" | "paste">("file");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch("/api/import/parse", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Could not read the file");
      if (!data.rows.length) throw new Error("The file has a header row but no data rows");
      if (data.truncated) toast.warning("Only the first 5,000 rows were loaded");
      onLoaded({
        fileName: data.fileName,
        inputType: data.inputType,
        headers: data.headers,
        rows: data.rows,
        truncated: data.truncated,
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const usePaste = () => {
    const first = text.split(/\r?\n/).find((l) => l.trim()) ?? "";
    // Rows copied from a spreadsheet are tab-separated with a header row; otherwise a plain list.
    if (first.includes("\t") || (kind !== "accounts" && first.includes(","))) {
      const r = Papa.parse<string[]>(text.trim(), {
        skipEmptyLines: "greedy",
        delimiter: first.includes("\t") ? "\t" : ",",
      });
      const [head = [], ...body] = r.data;
      if (!body.length) return toast.error("Include the header row and at least one data row");
      const headers = head.map((h, i) => h.trim() || `Column ${i + 1}`);
      onLoaded({
        fileName: null,
        inputType: "paste",
        headers,
        rows: body.map((cells) =>
          Object.fromEntries(headers.map((h, i) => [h, (cells[i] ?? "").trim()])),
        ),
      });
      return;
    }
    if (kind !== "accounts")
      return toast.error("Paste rows copied from a spreadsheet, including the header row");
    const rows = parsePastedList(text);
    if (!rows.length) return toast.error("Paste at least one company");
    onLoaded({
      fileName: null,
      inputType: "paste",
      headers: ["Company", "Domain"],
      rows: rows.slice(0, 5000),
    });
  };

  return (
    <section className="bg-card grid gap-4 rounded-lg border p-4" aria-labelledby="src-h">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="src-h" className="text-sm font-semibold">
            Add your {def.label.toLowerCase()}
          </h2>
          <p className="text-muted-foreground text-xs">{def.description}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={`/api/import/template?kind=${kind}&format=csv`} download>
              <Download /> CSV template
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={`/api/import/template?kind=${kind}&format=xlsx`} download>
              <FileSpreadsheet /> Excel template
            </a>
          </Button>
        </div>
      </header>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={mode}
        onValueChange={(v) => v && setMode(v as "file" | "paste")}
        aria-label="Input method"
        className="w-fit"
      >
        <ToggleGroupItem value="file">
          <FileUp className="size-3.5" /> Upload file
        </ToggleGroupItem>
        <ToggleGroupItem value="paste">
          <ClipboardPaste className="size-3.5" /> Paste
        </ToggleGroupItem>
      </ToggleGroup>
      {mode === "file" ? (
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            const f = e.dataTransfer.files[0];
            if (f) upload(f);
          }}
          className={cn(
            "focus-within:ring-ring flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center focus-within:ring-2",
            over && "border-primary bg-primary/5",
          )}
        >
          <FileUp className="text-muted-foreground size-6" aria-hidden />
          <span className="text-sm font-medium">
            {busy ? "Reading…" : "Drop a CSV or Excel file, or click to choose"}
          </span>
          <span className="text-muted-foreground text-xs">
            .csv or .xlsx, up to 10 MB / 5,000 rows. Parsed on this machine.
          </span>
          <input
            type="file"
            accept=".csv,.xlsx,.xlsm,text/csv"
            className="sr-only"
            aria-label="Choose a CSV or Excel file"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
            }}
          />
        </label>
      ) : (
        <div className="grid gap-2">
          <Label htmlFor="paste">
            {kind === "accounts"
              ? "One company per line, optionally with a domain (e.g. “Example Holdings, example.com”). Rows copied from a spreadsheet work too."
              : "Rows copied from a spreadsheet, including the header row."}
          </Label>
          <Textarea
            id="paste"
            rows={10}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="font-mono text-xs"
          />
          <Button size="sm" className="w-fit" disabled={!text.trim()} onClick={usePaste}>
            Continue
          </Button>
        </div>
      )}
    </section>
  );
}
