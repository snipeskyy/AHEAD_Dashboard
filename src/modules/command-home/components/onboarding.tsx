"use client";
import { ArrowRight, BookOpen, Lock, Target, Upload } from "lucide-react";
import Link from "next/link";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ONBOARDING_STEPS } from "@/lib/onboarding/steps";
import { cn } from "@/lib/utils";

/** Command Home on an empty database: a guided first run instead of a grid of empty widgets. */
export function Onboarding() {
  return (
    <PageContainer>
      <PageHeader
        title="Welcome to Account Command Center"
        description="Your workspace is empty. Start by importing the accounts you cover; everything else builds on them."
      />
      <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Getting started">
        {ONBOARDING_STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <li
              key={s.id}
              className={cn(
                "bg-card flex flex-col gap-3 rounded-lg border p-4",
                i === 0 && "border-primary/60 ring-primary/20 ring-2",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  Step {i + 1}
                </span>
                {!s.available && (
                  <Badge variant="outline" className="text-muted-foreground gap-1 font-normal">
                    <Lock className="size-3" aria-hidden /> Coming next
                  </Badge>
                )}
              </div>
              <div className="flex items-start gap-3">
                <Icon className="text-primary mt-0.5 size-5 shrink-0" aria-hidden />
                <div>
                  <h2 className="text-sm font-semibold">{s.title}</h2>
                  <p className="text-muted-foreground mt-1 text-[13px]">{s.description}</p>
                </div>
              </div>
              <div className="mt-auto">
                {s.available ? (
                  <Button size="sm" variant={i === 0 ? "default" : "outline"} asChild>
                    <Link href={s.href}>
                      {i === 0 ? <Upload /> : null}
                      {s.cta}
                      {i !== 0 ? <ArrowRight /> : null}
                    </Link>
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" disabled>
                    {s.cta}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        <aside className="flex items-start gap-3 rounded-lg border border-dashed p-4">
          <Target className="text-muted-foreground mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="text-[13px]">
            <h2 className="font-semibold">Set your targets</h2>
            <p className="text-muted-foreground mt-1">
              Pipeline target and coverage ratio start blank. Set them under Settings → Modules →
              Opportunities.
            </p>
            <Link
              href="/settings?tab=modules"
              className="text-primary mt-2 inline-block underline-offset-2 hover:underline"
            >
              Open settings
            </Link>
          </div>
        </aside>
        <aside className="flex items-start gap-3 rounded-lg border border-dashed p-4">
          <BookOpen className="text-muted-foreground mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="text-[13px]">
            <h2 className="font-semibold">Starter Plays are ready</h2>
            <p className="text-muted-foreground mt-1">
              Generic demand-gen plays for each practice area. Edit them, add your own, or clear
              them in Settings → Data.
            </p>
            <Link
              href="/demand-gen?tab=plays"
              className="text-primary mt-2 inline-block underline-offset-2 hover:underline"
            >
              Browse plays
            </Link>
          </div>
        </aside>
      </div>
    </PageContainer>
  );
}
