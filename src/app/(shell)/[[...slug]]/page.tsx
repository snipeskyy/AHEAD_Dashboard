import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSetting } from "@/lib/settings/server";
import { registry } from "@/modules/registry";

/**
 * Registry-driven router: every module page is resolved from src/modules/<id>/module.ts.
 * Adding a module never requires touching this file.
 */
type Props = {
  params: Promise<{ slug?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function resolve(props: Props) {
  const { slug = [] } = await props.params;
  const match = registry.matchRoute(slug);
  if (!match) return null;
  const flags = await getSetting("featureFlags");
  if (match.module.featureFlag && flags[match.module.featureFlag] === false) return null;
  return match;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const match = await resolve(props);
  return { title: match?.route.title ?? "Not found" };
}

export default async function ModulePage(props: Props) {
  const match = await resolve(props);
  if (!match) notFound();
  const { default: Page } = await match.route.load();
  return <Page params={match.params} />;
}
