import type { CategoryRule } from "./types";
import { normalizeKey } from "./format";
import { nowLocal } from "./time";

/** Build/update a learned merchant → category rule from a manual correction. */
export function learnRule(rules: CategoryRule[], merchant: string | undefined, category: string): CategoryRule | null {
  const key = normalizeKey(merchant ?? "");
  if (!key || key.length < 3) return null;
  const existing = rules.find((r) => r.id === key);
  if (existing && existing.category === category) return null;
  return { id: key, merchant: merchant!.trim(), category, hits: (existing?.hits ?? 0) + 1, updatedAt: nowLocal() };
}
