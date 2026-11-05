"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { PublicBrand } from "@/lib/brand/brand-pack";

const BrandContext = createContext<PublicBrand | null>(null);

/** The local brand pack as seen by the client (names, which logo files exist). */
export function BrandProvider({ brand, children }: { brand: PublicBrand; children: ReactNode }) {
  return <BrandContext value={brand}>{children}</BrandContext>;
}

export const useBrand = () => useContext(BrandContext);

/** URL of a brand asset served by /api/brand/asset (only when the file exists). */
export const brandAssetUrl = (b: PublicBrand | null, key: "logo" | "logoDark" | "mark") =>
  b?.assets.includes(key) ? `/api/brand/asset?name=${key}` : null;
