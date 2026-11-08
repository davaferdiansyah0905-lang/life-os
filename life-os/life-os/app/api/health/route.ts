import { NextResponse } from "next/server";
import { llmConfig, providerLabel } from "@/lib/server/llm";
import { storeConfig, tokenConfigured } from "@/lib/server/inbox";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Reports which optional integrations are configured (booleans only — never secrets). */
export async function GET() {
  const llm = llmConfig();
  return NextResponse.json({
    ok: true,
    time: new Date().toISOString(),
    llm: { configured: llm.configured, label: providerLabel() },
    ingest: { tokenConfigured: tokenConfigured(), storageConfigured: storeConfig().configured },
  });
}
