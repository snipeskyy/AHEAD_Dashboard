import { z } from "zod";
import {
  CONTRACT_VERSION,
  ContractAccountSchema,
  ContractActivitySchema,
  ContractContactSchema,
  ContractNoteSchema,
  ContractOpportunitySchema,
  ContractPartnerRepSchema,
  ContractSchema,
  ContractTaskSchema,
} from "./schema";

/** OpenAPI 3.1 description of the local read-only API (docs/contract/openapi.json). Generated, not hand-written. */
export function openApiDocument() {
  const js = (s: z.ZodType) => {
    const { $schema: _s, ...rest } = z.toJSONSchema(s, {
      target: "draft-2020-12",
      io: "input",
    }) as Record<string, unknown>;
    return rest;
  };
  const params = [
    {
      name: "visibility",
      in: "query",
      schema: { type: "string", enum: ["internal", "customer-safe"], default: "internal" },
    },
    {
      name: "account",
      in: "query",
      description: "Only records of this ACC account id",
      schema: { type: "string" },
    },
    {
      name: "limit",
      in: "query",
      schema: { type: "integer", minimum: 1, maximum: 5000, default: 500 },
    },
    { name: "offset", in: "query", schema: { type: "integer", minimum: 0, default: 0 } },
  ];
  const errors = {
    "401": { description: "Missing or invalid token" },
    "403": { description: "The local API is turned off (Settings → Data contract & API)" },
  };
  const list = (name: string, ref: string, summary: string) => ({
    get: {
      summary,
      operationId: `list${name}`,
      parameters: params,
      responses: {
        "200": {
          description: "A page of records",
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["format", "version", "visibility", "total", "items"],
                properties: {
                  format: { const: "acc-data" },
                  version: { type: "string" },
                  visibility: { type: "string", enum: ["internal", "customer-safe"] },
                  total: { type: "integer" },
                  offset: { type: "integer" },
                  limit: { type: "integer" },
                  items: { type: "array", items: { $ref: `#/components/schemas/${ref}` } },
                },
              },
            },
          },
        },
        ...errors,
      },
    },
  });
  return {
    openapi: "3.1.0",
    info: {
      title: "ACC local read-only API",
      version: CONTRACT_VERSION,
      description:
        "Read-only access to an ACC workspace on the same computer, in the ACC Data Contract format. Off by default; every request needs `Authorization: Bearer <token>` (Settings → Data contract & API). Writing is file-based (contract import with preview and undo).",
    },
    servers: [{ url: "http://localhost:3000" }],
    security: [{ bearer: [] }],
    paths: {
      "/api/v1": {
        get: {
          summary: "API index",
          operationId: "index",
          responses: { "200": { description: "Endpoints and contract version" }, ...errors },
        },
      },
      "/api/v1/accounts": list("Accounts", "Account", "Accounts"),
      "/api/v1/accounts/{id}": {
        get: {
          summary: "One account with its related records",
          operationId: "getAccount",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
            params[0],
          ],
          responses: {
            "200": { description: "Account read model" },
            "404": { description: "Not found (or a demo account)" },
            ...errors,
          },
        },
      },
      "/api/v1/contacts": list(
        "Contacts",
        "Contact",
        "Buying-committee contacts (no personal contact details)",
      ),
      "/api/v1/opportunities": list("Opportunities", "Opportunity", "Opportunities"),
      "/api/v1/activities": list("Activities", "Activity", "Activities (touches)"),
      "/api/v1/tasks": list("Tasks", "Task", "Tasks"),
      "/api/v1/export": {
        get: {
          summary: "The whole workspace as one contract file",
          operationId: "exportContract",
          parameters: [params[0]],
          responses: {
            "200": {
              description: "Contract file",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/Contract" } },
              },
            },
            ...errors,
          },
        },
      },
    },
    components: {
      securitySchemes: { bearer: { type: "http", scheme: "bearer" } },
      schemas: {
        Contract: js(ContractSchema),
        Account: js(ContractAccountSchema),
        Contact: js(ContractContactSchema),
        Opportunity: js(ContractOpportunitySchema),
        Activity: js(ContractActivitySchema),
        Note: js(ContractNoteSchema),
        Task: js(ContractTaskSchema),
        PartnerRep: js(ContractPartnerRepSchema),
      },
    },
  };
}
