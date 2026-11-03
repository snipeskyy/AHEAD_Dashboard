import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export const json = <T>(data: T, init?: ResponseInit) => NextResponse.json(data, init);

export function errorResponse(e: unknown) {
  if (e instanceof ZodError) {
    return NextResponse.json({ error: "Invalid request", issues: e.issues }, { status: 400 });
  }
  if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error(e);
  return NextResponse.json(
    { error: e instanceof Error ? e.message : "Unexpected error" },
    { status: 500 },
  );
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Wraps a route handler with consistent error handling. */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "Body must be valid JSON");
  }
}
