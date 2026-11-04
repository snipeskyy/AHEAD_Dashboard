import { execSync } from "node:child_process";

/** Every e2e run starts from the deterministic fixture dataset in the TEST database. */
export default function globalSetup() {
  execSync("npm run test:db:seed", { stdio: "inherit" });
}
