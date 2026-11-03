/**
 * Pluggable AI provider (spec §10 add-on). OFF by default: ACC ships only the NullAiProvider and
 * never sends data anywhere. A future provider must receive ONLY the fields the user explicitly
 * chooses to send (see `AiRequest.payload`), and must be enabled per-feature in Settings.
 */
export interface AiRequest {
  task: "draft-message" | "summarize-signals" | "account-brief" | "meeting-prep";
  /** Exactly what the user approved to send — nothing else may be read by the provider. */
  payload: Record<string, unknown>;
}

export interface AiResponse {
  text: string;
  provider: string;
}

export interface AiProvider {
  id: string;
  label: string;
  enabled: boolean;
  complete(req: AiRequest): Promise<AiResponse>;
}

export class AiDisabledError extends Error {
  constructor() {
    super("AI assistant is not enabled. It is an optional add-on and is off by default.");
    this.name = "AiDisabledError";
  }
}

export const nullAiProvider: AiProvider = {
  id: "none",
  label: "Disabled",
  enabled: false,
  async complete() {
    throw new AiDisabledError();
  },
};

export const getAiProvider = (): AiProvider => nullAiProvider;
