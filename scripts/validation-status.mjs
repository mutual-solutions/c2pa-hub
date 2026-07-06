const HARD_FAILURE_FRAGMENTS = [".mismatch", ".missing", ".malformed", ".invalid"];

export function isHardFailureCode(code) {
  const normalized = String(code || "");
  if (!normalized) return false;
  if (normalized.includes(".untrusted")) return false;
  return HARD_FAILURE_FRAGMENTS.some((fragment) => normalized.includes(fragment));
}
