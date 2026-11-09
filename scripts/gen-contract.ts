/**
 * `npm run contract:schema`: writes the ACC Data Contract JSON Schema an example file and the local API's OpenAPI description to docs/contract/.
 * A unit test fails if the committed schema drifts from src/lib/contract/schema.ts.
 */
import { writeFileSync } from "node:fs";
import { contractJsonSchema } from "../src/lib/contract/schema";
import { CONTRACT_EXAMPLE } from "../src/lib/contract/example";
import { openApiDocument } from "../src/lib/contract/openapi";

writeFileSync(
  "docs/contract/acc-data-v1.schema.json",
  JSON.stringify(contractJsonSchema(), null, 2) + "\n",
);
writeFileSync(
  "docs/contract/example.acc-data.json",
  JSON.stringify(CONTRACT_EXAMPLE, null, 2) + "\n",
);
writeFileSync("docs/contract/openapi.json", JSON.stringify(openApiDocument(), null, 2) + "\n");
console.log(
  "[contract] wrote docs/contract/{acc-data-v1.schema.json,example.acc-data.json,openapi.json}",
);
