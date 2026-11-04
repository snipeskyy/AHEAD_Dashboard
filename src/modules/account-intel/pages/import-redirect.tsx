"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Old /accounts/import links now open the general import wizard. */
export default function ImportRedirect() {
  const router = useRouter();
  useEffect(() => router.replace("/import?kind=accounts"), [router]);
  return null;
}
