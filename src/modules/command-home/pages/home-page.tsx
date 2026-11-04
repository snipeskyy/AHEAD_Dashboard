"use client";
import { Skeleton } from "@/components/ui/skeleton";
import { useMeta } from "@/hooks/use-meta";
import { HomeDashboard } from "../components/home-dashboard";
import { Onboarding } from "../components/onboarding";

export default function HomePage() {
  const { data, isLoading } = useMeta();
  if (isLoading) return <Skeleton className="m-6 h-64" />;
  return data?.empty ? <Onboarding /> : <HomeDashboard />;
}
