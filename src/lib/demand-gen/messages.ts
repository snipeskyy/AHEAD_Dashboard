/**
 * Template-based message builder (no AI). Templates use {{variable}} placeholders; the builder
 * fills them from account context + chosen evidence and reports anything left unfilled.
 */
export type MessageChannel = "email" | "linkedin" | "call";

export interface MessageTemplate {
  id: string;
  channel: MessageChannel;
  name: string;
  subject?: string;
  body: string;
}

export interface MessageVars {
  firstName?: string;
  persona: string;
  account: string;
  industry?: string;
  practice?: string;
  playName?: string;
  valueHypothesis?: string;
  talkTrack1?: string;
  evidenceTitle?: string;
  evidenceUrl?: string;
  evidenceWhen?: string;
  senderName?: string;
  meetingAsk?: string;
}

export const MESSAGE_TEMPLATES: MessageTemplate[] = [
  {
    id: "email-evidence",
    channel: "email",
    name: "Evidence-led intro",
    subject: "{{account}} + {{practice}}: a quick idea",
    body: `Hi {{firstName}},

I noticed {{evidenceTitle}}{{evidenceWhen}}. Teams in {{industry}} that are moving on this usually run into the same question: {{talkTrack1}}

{{valueHypothesis}}

Would {{meetingAsk}} be useful? Happy to share what we've seen work at similar organizations.

Best,
{{senderName}}

Source: {{evidenceUrl}}`,
  },
  {
    id: "email-play",
    channel: "email",
    name: "Play point of view",
    subject: "{{playName}} for {{account}}",
    body: `Hi {{firstName}},

As {{persona}} at {{account}}, you're likely weighing {{practice}} priorities for next year. We put together a short point of view on {{playName}}:

{{valueHypothesis}}

One question to start: {{talkTrack1}}

Open to {{meetingAsk}}?

{{senderName}}`,
  },
  {
    id: "email-followup",
    channel: "email",
    name: "Short follow-up",
    subject: "Re: {{practice}} at {{account}}",
    body: `Hi {{firstName}}, following up on my note — given {{evidenceTitle}}, I thought this might be timely. Worth {{meetingAsk}}?

{{senderName}}`,
  },
  {
    id: "linkedin-connect",
    channel: "linkedin",
    name: "Connection note (≤300 chars)",
    body: `Hi {{firstName}} — saw {{evidenceTitle}}. I work with {{industry}} teams on {{practice}} and would value connecting to compare notes.`,
  },
  {
    id: "linkedin-message",
    channel: "linkedin",
    name: "Message after connecting",
    body: `Thanks for connecting, {{firstName}}. Curious how {{account}} is approaching {{practice}} — {{talkTrack1}} We recently shared a perspective on {{playName}}; happy to send it over.`,
  },
  {
    id: "call-opener",
    channel: "call",
    name: "Call opener",
    body: `Hi {{firstName}}, this is {{senderName}}. I'll be brief — I saw {{evidenceTitle}} and I'm calling {{persona}}s in {{industry}} about {{practice}}.

Question for you: {{talkTrack1}}

[If engaged] {{valueHypothesis}} — would {{meetingAsk}} make sense?`,
  },
];

const PLACEHOLDER = /\{\{(\w+)\}\}/g;

export interface RenderedMessage {
  subject: string | null;
  body: string;
  missing: string[];
  charCount: number;
}

/** Fills placeholders; missing values become visible [brackets] so nothing is silently invented. */
export function renderMessage(t: MessageTemplate, vars: MessageVars): RenderedMessage {
  const v: Record<string, string | undefined> = {
    ...vars,
    firstName: vars.firstName || undefined,
    evidenceWhen: vars.evidenceWhen ? ` (${vars.evidenceWhen})` : "",
    meetingAsk: vars.meetingAsk || "a 20-minute conversation next week",
    senderName: vars.senderName || undefined,
  };
  const missing = new Set<string>();
  const fill = (s: string) =>
    s.replace(PLACEHOLDER, (_m, key: string) => {
      const val = v[key];
      if (val === undefined || val === null || val === "") {
        if (key !== "evidenceWhen") missing.add(key);
        return key === "evidenceWhen" ? "" : `[${key}]`;
      }
      return String(val);
    });
  // Drop a trailing "Source: [evidenceUrl]" line when there is no URL (e.g. demo/hypothesis evidence).
  let body = fill(t.body);
  if (!vars.evidenceUrl) {
    body = body.replace(/\n*Source: \[evidenceUrl\]\s*$/, "");
    missing.delete("evidenceUrl");
  }
  return {
    subject: t.subject ? fill(t.subject) : null,
    body,
    missing: [...missing],
    charCount: body.length,
  };
}
