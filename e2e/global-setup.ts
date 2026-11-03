import { execSync } from "node:child_process";

/** Every e2e run starts from the deterministic demo dataset (tests create/launch things). */
export default function globalSetup() {
  execSync("npm run seed", { stdio: "inherit" });
}
