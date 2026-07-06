export type ValidationStatus = "valid" | "invalid" | "no_manifest" | "fetch_failed" | "unsupported_format";

export type CorpusClassification =
  | "trusted_camera_capture"
  | "trusted_edited"
  | "ai_disclosed"
  | "c2pa_present_trusted_non_capture"
  | "c2pa_present_untrusted"
  | "c2pa_invalid"
  | "stripped_or_unknown"
  | "source_context_unverified"
  | "soft_binding_candidate"
  | "soft_binding_recovered"
  | "fetch_failed"
  | "unsupported_format";

export type PublicCategory = "real" | "edited" | "excluded_ai_generated" | "diagnostic";

export interface ValidationSignal {
  manifestPresent: boolean;
  signatureTrusted: boolean;
  validationStatus: ValidationStatus;
  digitalSourceType?: string | null;
  actions: string[];
  ingredientsCount: number;
  aiDisclosurePresent: boolean;
  softBindingCandidate?: boolean;
  softBindingRecovered?: boolean;
}

export interface NormalizedValidation {
  classification: CorpusClassification;
  publicCategory: PublicCategory;
  warning?: string;
}

export function normalizeValidation(signal: ValidationSignal): NormalizedValidation {
  if (signal.validationStatus === "fetch_failed") {
    return { classification: "fetch_failed", publicCategory: "diagnostic" };
  }

  if (signal.validationStatus === "unsupported_format") {
    return { classification: "unsupported_format", publicCategory: "diagnostic" };
  }

  if (signal.softBindingCandidate) {
    return { classification: "soft_binding_candidate", publicCategory: "diagnostic" };
  }

  if (signal.softBindingRecovered) {
    return { classification: "soft_binding_recovered", publicCategory: "diagnostic" };
  }

  if (!signal.manifestPresent || signal.validationStatus === "no_manifest") {
    return {
      classification: "stripped_or_unknown",
      publicCategory: "diagnostic",
      warning: "The absence of C2PA is not evidence that an asset is AI-generated.",
    };
  }

  if (signal.validationStatus === "invalid") {
    return { classification: "c2pa_invalid", publicCategory: "diagnostic" };
  }

  if (!signal.signatureTrusted) {
    return { classification: "c2pa_present_untrusted", publicCategory: "diagnostic" };
  }

  if (isAiGenerated(signal)) {
    return { classification: "ai_disclosed", publicCategory: "excluded_ai_generated" };
  }

  if (isTrustedEditSource(signal)) {
    return { classification: "trusted_edited", publicCategory: "edited" };
  }

  if (isCameraCapture(signal)) {
    if (hasEditHistory(signal)) {
      return { classification: "trusted_edited", publicCategory: "edited" };
    }
    return { classification: "trusted_camera_capture", publicCategory: "real" };
  }

  return { classification: "c2pa_present_trusted_non_capture", publicCategory: "diagnostic" };
}

export function isPublicSearchCategory(category: PublicCategory): boolean {
  return category === "real" || category === "edited";
}

function isCameraCapture(signal: ValidationSignal): boolean {
  const sourceType = normalizeToken(signal.digitalSourceType);
  return sourceType.includes("digitalcapture") || sourceType.includes("computationalcapture");
}

function isAiGenerated(signal: ValidationSignal): boolean {
  const sourceType = normalizeToken(signal.digitalSourceType);
  return signal.aiDisclosurePresent || sourceType.includes("trainedalgorithmicmedia") || sourceType.includes("compositewithtrainedalgorithmicmedia");
}

function isTrustedEditSource(signal: ValidationSignal): boolean {
  const sourceType = normalizeToken(signal.digitalSourceType);
  return sourceType.includes("humanedits") || sourceType.includes("algorithmicallyenhanced");
}

function hasEditHistory(signal: ValidationSignal): boolean {
  return (
    signal.ingredientsCount > 0 ||
    signal.actions.some((action) => {
      const normalized = action.toLowerCase();
      return normalized !== "c2pa.created" && normalized !== "c2pa.opened";
    })
  );
}

function normalizeToken(value: string | null | undefined): string {
  return String(value ?? "").replace(/[^a-z0-9]/gi, "").toLowerCase();
}
