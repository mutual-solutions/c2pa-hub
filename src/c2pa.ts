export type C2paClassification = "c2pa-present" | "ai-disclosed" | "unknown";

export interface C2paEvidence {
  hasC2pa: boolean;
  hasAiDisclosure: boolean;
  classification: C2paClassification;
  markers: string[];
  warning?: string;
}

const MARKERS = [
  { name: "c2pa", pattern: "c2pa" },
  { name: "jumbf", pattern: "jumbf" },
  { name: "content-credentials", pattern: "content credentials" },
  { name: "ai-disclosure", pattern: "c2pa.ai-disclosure" },
  { name: "trained-algorithmic-media", pattern: "trainedalgorithmicmedia" },
  { name: "digital-source-type", pattern: "digitalsourcetype" },
] as const;

export function classifyC2paEvidence(input: Uint8Array): C2paEvidence {
  const text = new TextDecoder("utf-8", { fatal: false, ignoreBOM: false }).decode(input).toLowerCase();
  const markers = MARKERS.filter((marker) => text.includes(marker.pattern)).map((marker) => marker.name);
  const hasC2pa = markers.some((marker) => marker === "c2pa" || marker === "jumbf" || marker === "content-credentials");
  const hasAiDisclosure = markers.some(
    (marker) => marker === "ai-disclosure" || marker === "trained-algorithmic-media",
  );

  if (hasAiDisclosure) {
    return {
      hasC2pa: true,
      hasAiDisclosure: true,
      classification: "ai-disclosed",
      markers,
    };
  }

  if (hasC2pa) {
    return {
      hasC2pa: true,
      hasAiDisclosure: false,
      classification: "c2pa-present",
      markers,
    };
  }

  return {
    hasC2pa: false,
    hasAiDisclosure: false,
    classification: "unknown",
    markers,
    warning: "The absence of C2PA markers is not evidence that an asset is AI-generated.",
  };
}
