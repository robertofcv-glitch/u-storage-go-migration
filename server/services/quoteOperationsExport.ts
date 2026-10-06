import { getStorageMoveContext, type StorageMoveQuoteLike } from "@shared/storageMoveContext";

type OperationsQuote = StorageMoveQuoteLike & {
  id: string;
  quoteNumber?: string | null;
  workflowStatus?: string | null;
  fromAddress?: string | null;
  toAddress?: string | null;
  moveDate?: Date | string | null;
  createdAt?: Date | string | null;
};

export function toQuoteOperationsRow(quote: OperationsQuote) {
  const context = getStorageMoveContext(quote);
  const branch = context.branch;
  return {
    quote_id: quote.id,
    quote_number: quote.quoteNumber ?? "",
    workflow_status: quote.workflowStatus ?? "",
    service_mode: context.serviceMode,
    is_storage_connected: context.isBranchConnected ? "true" : "false",
    move_direction: context.direction ?? "",
    branch_id: branch?.id ?? "",
    branch_external_id: branch?.externalId ?? "",
    branch_brand: branch?.brand ?? "",
    branch_name: branch?.name ?? "",
    branch_address: branch?.address ?? "",
    branch_google_place_id: branch?.googlePlaceId ?? "",
    origin_address: quote.fromAddress ?? "",
    destination_address: quote.toAddress ?? "",
    move_date: quote.moveDate ? new Date(quote.moveDate).toISOString().slice(0, 10) : "",
    eligibility_checked_at: context.eligibilityCheckedAt
      ? new Date(context.eligibilityCheckedAt).toISOString()
      : "",
    eligibility_version: context.eligibilityVersion?.toString() ?? "",
    created_at: quote.createdAt ? new Date(quote.createdAt).toISOString() : "",
  };
}

function csvCell(value: unknown): string {
  const raw = value == null ? "" : String(value);
  // Quoting alone does not stop Excel/Sheets from evaluating a formula.
  const text = /^[\t\r\n ]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${text.replace(/"/g, '""')}"`;
}

export function quoteOperationsCsv(quotes: OperationsQuote[]): string {
  const rows = quotes.map(toQuoteOperationsRow);
  const headers = Object.keys(rows[0] ?? toQuoteOperationsRow({
    id: "",
    serviceMode: "general_point_to_point",
  }));
  return [
    headers.map(csvCell).join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header as keyof typeof row])).join(",")),
  ].join("\n");
}