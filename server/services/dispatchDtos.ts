import { getStorageMoveContext } from "@shared/storageMoveContext";

export function toPartnerSafeQuote(quote: any) {
  const moveContext = getStorageMoveContext(quote);
  return {
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    fromAddress: quote.fromAddress,
    toAddress: quote.toAddress,
    moveDate: quote.moveDate,
    moveAvailabilityStart: quote.moveAvailabilityStart,
    moveAvailabilityEnd: quote.moveAvailabilityEnd,
    preferredMoveDates: quote.preferredMoveDates,
    blockedMoveDates: quote.blockedMoveDates,
    homeSize: quote.homeSize,
    storageOption: quote.storageOption,
    needsInsurance: quote.needsInsurance,
    needsPacking: quote.needsPacking,
    needsUnpacking: quote.needsUnpacking,
    needsBox: quote.needsBox,
    workflowStatus: quote.workflowStatus,
    priceProposalAmount: quote.priceProposalAmount,
    priceProposalCurrency: quote.priceProposalCurrency,
    // Every partner handoff carries one canonical, persisted move context.
    // Branch details are sourced only from the quote snapshot, never catalog data.
    moveContext,
  };
}