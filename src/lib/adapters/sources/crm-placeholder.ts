import { AdapterNotConfiguredError, type DataAdapter, type NormalizedSignal } from "../types";

/**
 * Placeholder slot for future, company-APPROVED integrations (CRM, marketing automation, calendar).
 * Intentionally not implemented. Do not build connectors without explicit company approval.
 */
export const crmPlaceholderAdapter: DataAdapter<NormalizedSignal, never> = {
  id: "crm-placeholder",
  label: "CRM / marketing automation",
  kind: "private-future",
  description: "Not configured — requires company approval.",
  eligible: () => false,
  async fetch() {
    throw new AdapterNotConfiguredError(
      "crm-placeholder",
      "requires company approval before any connector is built",
    );
  },
  normalize() {
    throw new AdapterNotConfiguredError(
      "crm-placeholder",
      "requires company approval before any connector is built",
    );
  },
};
