// Server-only LLM helper. API keys are read from environment variables and never reach the browser.

export type Provider = "anthropic" | "openai";

export function llmConfig() {
  const key = process.env.LLM_API_KEY?.trim();
  const raw = (process.env.LLM_PROVIDER || "").trim().toLowerCase();
  const provider: Provider | null = !key ? null : raw === "anthropic" || raw === "claude" ? "anthropic" : "openai";
  const model =
    process.env.LLM_MODEL?.trim() || (provider === "anthropic" ? "claude-haiku-5-5" : "gpt-4o-mini");
  const baseUrl = (process.env.LLM_BASE_URL?.trim() || (provider === "anthropic" ? "https://api.anthropic.com/v1" : "https://api.openai.com/v1")).replace(/\/+$/, "");
  return { configured: !!provider, provider, model, baseUrl, key };
}

export function providerLabel() {
  const c = llmConfig();
  if (!c.configured) return null;
  let host = c.baseUrl;
  try {
    host = new URL(c.baseUrl).host;
  } catch {}
  return `${c.provider === "anthropic" ? "Anthropic" : "OpenAI-compatible"} · ${c.model} · ${host}`;
}

export async function completeJSON(system: string, user: string, opts: { maxTokens?: number; timeoutMs?: number } = {}): Promise<string> {
  const c = llmConfig();
  if (!c.configured || !c.key) throw new Error("LLM belum dikonfigurasi");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 25_000);
  try {
    if (c.provider === "anthropic") {
      const res = await fetch(`${c.baseUrl}/messages`, {
        method: "POST",
        signal: ctrl.signal,
        headers: { "content-type": "application/json", "x-api-key": c.key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: c.model, max_tokens: opts.maxTokens ?? 900, system, messages: [{ role: "user", content: user }] }),
      });
      if (!res.ok) throw new Error(`LLM error ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const j = (await res.json()) as { content?: { type: string; text?: string }[] };
      return (j.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
    }
    const res = await fetch(`${c.baseUrl}/chat/completions`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${c.key}` },
      body: JSON.stringify({
        model: c.model,
        max_tokens: opts.maxTokens ?? 900,
        temperature: 0.2,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) throw new Error(`LLM error ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return j.choices?.[0]?.message?.content ?? "";
  } finally {
    clearTimeout(timer);
  }
}

/** Extract the first JSON object from a model response (tolerates code fences / prose). */
export function extractJSON<T = unknown>(text: string): T | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const src = fenced ? fenced[1] : text;
  const start = src.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(src.slice(start, i + 1)) as T;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}
