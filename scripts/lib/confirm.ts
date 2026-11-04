import { createInterface } from "node:readline/promises";

/** Asks for an exact typed answer; `--yes` on the command line skips the prompt. */
export async function confirm(question: string, expected = "yes") {
  if (process.argv.includes("--yes")) return true;
  if (!process.stdin.isTTY) {
    console.error("[acc] Not an interactive terminal. Re-run with --yes to confirm.");
    return false;
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(`${question} Type "${expected}" to continue: `)).trim();
  rl.close();
  return answer === expected;
}
