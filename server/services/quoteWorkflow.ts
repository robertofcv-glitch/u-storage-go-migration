import { canTransitionQuoteStage, normalizeQuoteStage, type QuoteStage } from "@shared/workflowStages";

export function canTransitionQuote(fromStage: string | null | undefined, toStage: string): boolean {
  return canTransitionQuoteStage(fromStage || "draft", toStage);
}

export function normalizeQuoteWorkflowStage(value: string | null | undefined): QuoteStage {
  return normalizeQuoteStage(value);
}

export function assertQuoteTransition(fromStage: string | null | undefined, toStage: string): QuoteStage {
  const normalizedTarget = normalizeQuoteStage(toStage);
  if (!canTransitionQuote(fromStage, normalizedTarget)) {
    throw new Error(`Cannot transition quote from ${normalizeQuoteStage(fromStage)} to ${normalizedTarget}`);
  }
  return normalizedTarget;
}