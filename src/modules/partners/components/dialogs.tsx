"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AccountPicker } from "@/components/account-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import { TOUCH_CHANNELS } from "@/lib/domain/enums";

const sel = "border-input dark:bg-input/30 h-8 w-full rounded-md border bg-transparent px-2 text-sm";
type Acc = { id: string; name: string };

function useSave(path: string, done: string, close: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (json: unknown) => api(path, { method: "POST", json }),
    onSuccess: () => {
      toast.success(done);
      qc.invalidateQueries({ queryKey: ["partners"] });
      close();
    },
    onError: (e) => toast.error(e.message),
  });
}

function Shell({ trigger, title, children, open, setOpen }: { trigger: ReactNode; title: string; children: ReactNode; open: boolean; setOpen: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        {open && children}
      </DialogContent>
    </Dialog>
  );
}

export function AddRepDialog({ trigger, company = "" }: { trigger: ReactNode; company?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Shell trigger={trigger} title="Add partner rep" open={open} setOpen={setOpen}>
      <RepForm company={company} close={() => setOpen(false)} />
    </Shell>
  );
}
function RepForm({ company, close }: { company: string; close: () => void }) {
  const [f, setF] = useState({ partnerCompany: company, name: "", title: "", territory: "" });
  const [accs, setAccs] = useState<Acc[]>([]);
  const save = useSave("/api/partner-reps", "Partner rep added", close);
  return (
    <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); save.mutate({ ...f, accountIds: accs.map((a) => a.id) }); }}>
      {([["partnerCompany", "Partner company", "e.g. Compute OEM A"], ["name", "Rep name", ""], ["title", "Title", ""], ["territory", "Territory", ""]] as const).map(([k, l, ph]) => (
        <div key={k} className="grid gap-1.5"><Label htmlFor={`rep-${k}`}>{l}</Label><Input id={`rep-${k}`} value={f[k]} placeholder={ph} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
      ))}
      <div className="grid gap-1.5">
        <Label htmlFor="rep-acc">Accounts they cover</Label>
        <AccountPicker id="rep-acc" value={null} onChange={(a) => a && !accs.some((x) => x.id === a.id) && setAccs([...accs, a])} />
        <div className="flex flex-wrap gap-1">{accs.map((a) => <Badge key={a.id} variant="secondary" className="gap-1 font-normal">{a.name}<button type="button" aria-label={`Remove ${a.name}`} onClick={() => setAccs(accs.filter((x) => x.id !== a.id))}><X className="size-3" /></button></Badge>)}</div>
      </div>
      <DialogFooter><Button type="submit" disabled={f.partnerCompany.trim().length < 2 || f.name.trim().length < 2 || save.isPending}>Add rep</Button></DialogFooter>
    </form>
  );
}

export function JointTouchDialog({ trigger, rep }: { trigger: ReactNode; rep: { id: string; name: string; accounts: Acc[] } }) {
  const [open, setOpen] = useState(false);
  return (
    <Shell trigger={trigger} title={`Log a joint touch with ${rep.name}`} open={open} setOpen={setOpen}>
      <TouchForm rep={rep} close={() => setOpen(false)} />
    </Shell>
  );
}
function TouchForm({ rep, close }: { rep: { id: string; accounts: Acc[] }; close: () => void }) {
  const [account, setAccount] = useState<Acc | null>(rep.accounts[0] ?? null);
  const [channel, setChannel] = useState("meeting");
  const [persona, setPersona] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const save = useSave("/api/touches", "Joint touch logged", close);
  return (
    <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); save.mutate({ accountId: account!.id, channel, persona: persona || "Customer team", scheduledAt: new Date(`${date}T12:00:00`).toISOString(), completed: true, outcome: "meeting", partnerRepId: rep.id }); }}>
      <div className="grid gap-1.5"><Label htmlFor="jt-acc">Account</Label><AccountPicker id="jt-acc" value={account} onChange={setAccount} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5"><Label htmlFor="jt-ch">Channel</Label><select id="jt-ch" className={sel} value={channel} onChange={(e) => setChannel(e.target.value)}>{TOUCH_CHANNELS.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div className="grid gap-1.5"><Label htmlFor="jt-date">Date</Label><Input id="jt-date" type="date" className="h-8" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      </div>
      <div className="grid gap-1.5"><Label htmlFor="jt-p">With (persona)</Label><Input id="jt-p" value={persona} placeholder="e.g. VP Infrastructure" onChange={(e) => setPersona(e.target.value)} /></div>
      <DialogFooter><Button type="submit" disabled={!account || save.isPending}>Log touch</Button></DialogFooter>
    </form>
  );
}

export function RegistrationDialog({ trigger, company, reps }: { trigger: ReactNode; company: string; reps: Array<{ id: string; name: string }> }) {
  const [open, setOpen] = useState(false);
  return (
    <Shell trigger={trigger} title={`New deal registration · ${company}`} open={open} setOpen={setOpen}>
      <RegForm company={company} reps={reps} close={() => setOpen(false)} />
    </Shell>
  );
}
function RegForm({ company, reps, close }: { company: string; reps: Array<{ id: string; name: string }>; close: () => void }) {
  const [account, setAccount] = useState<Acc | null>(null);
  const [f, setF] = useState({ repId: reps[0]?.id ?? "", reference: "", status: "submitted", expiresAt: "" });
  const save = useSave("/api/registrations", "Registration added", close);
  return (
    <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); save.mutate({ partnerCompany: company, accountId: account!.id, repId: f.repId || null, reference: f.reference || null, status: f.status, expiresAt: f.expiresAt ? new Date(`${f.expiresAt}T12:00:00`).toISOString() : null }); }}>
      <div className="grid gap-1.5"><Label htmlFor="rg-acc">Account</Label><AccountPicker id="rg-acc" value={account} onChange={setAccount} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5"><Label htmlFor="rg-rep">Rep</Label><select id="rg-rep" className={sel} value={f.repId} onChange={(e) => setF({ ...f, repId: e.target.value })}><option value="">—</option>{reps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
        <div className="grid gap-1.5"><Label htmlFor="rg-st">Status</Label><select id="rg-st" className={sel} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{["submitted", "approved", "rejected", "expired"].map((s) => <option key={s}>{s}</option>)}</select></div>
        <div className="grid gap-1.5"><Label htmlFor="rg-ref">Reference #</Label><Input id="rg-ref" className="h-8" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></div>
        <div className="grid gap-1.5"><Label htmlFor="rg-exp">Expires</Label><Input id="rg-exp" type="date" className="h-8" value={f.expiresAt} onChange={(e) => setF({ ...f, expiresAt: e.target.value })} /></div>
      </div>
      <DialogFooter><Button type="submit" disabled={!account || save.isPending}>Add registration</Button></DialogFooter>
    </form>
  );
}
