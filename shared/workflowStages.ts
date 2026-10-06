export const QUOTE_STAGE = {
  DRAFT: "draft",
  UNDER_REVIEW: "under_review",
  SENT: "sent",
  AWAITING_DECISION: "awaiting_decision",
  ACCEPTED_PENDING_BOOKING_PAYMENT: "accepted_pending_booking_payment",
  CLOSED_WON: "closed_won",
  CLOSED_LOST: "closed_lost",
  CANCELLED: "cancelled",
  EXPIRED: "expired",
} as const;

export type QuoteStage = typeof QUOTE_STAGE[keyof typeof QUOTE_STAGE];
export const QUOTE_STAGES = Object.values(QUOTE_STAGE) as QuoteStage[];

export const SERVICE_STAGE_V2 = {
  CONFIRMED: "confirmed",
  SCHEDULED: "scheduled",
  TEAM_ASSIGNED: "team_assigned",
  EN_ROUTE: "en_route",
  IN_PROGRESS: "in_progress",
  FINISHED: "finished",
  ON_HOLD: "on_hold",
  CANCELLED: "cancelled",
} as const;

export type ServiceStage = typeof SERVICE_STAGE_V2[keyof typeof SERVICE_STAGE_V2];

export const QUOTE_STAGE_TRANSITIONS: Record<QuoteStage, readonly QuoteStage[]> = {
  draft: ["under_review", "cancelled"],
  under_review: ["sent", "closed_lost", "cancelled"],
  sent: ["awaiting_decision", "closed_lost", "cancelled", "expired"],
  awaiting_decision: ["accepted_pending_booking_payment", "under_review", "closed_lost", "cancelled", "expired"],
  accepted_pending_booking_payment: ["closed_won", "under_review", "closed_lost", "cancelled", "expired"],
  closed_won: [],
  closed_lost: [],
  cancelled: [],
  expired: [],
};

export const SERVICE_STAGE_TRANSITIONS: Record<ServiceStage, readonly ServiceStage[]> = {
  confirmed: ["scheduled", "on_hold", "cancelled"],
  scheduled: ["team_assigned", "on_hold", "cancelled"],
  team_assigned: ["en_route", "on_hold", "cancelled"],
  en_route: ["in_progress", "on_hold", "cancelled"],
  in_progress: ["finished", "on_hold", "cancelled"],
  finished: [],
  on_hold: ["confirmed", "scheduled", "team_assigned", "cancelled"],
  cancelled: [],
};

export const QUOTE_STAGE_LABELS: Record<QuoteStage, { en: string; es: string; descriptionEn: string; descriptionEs: string }> = {
  draft: { en: "Draft", es: "Borrador", descriptionEn: "Quote is being prepared.", descriptionEs: "La cotización está en preparación." },
  under_review: { en: "Under review", es: "En revisión", descriptionEn: "The team is reviewing the request.", descriptionEs: "El equipo está revisando la solicitud." },
  sent: { en: "Sent to customer", es: "Enviada al cliente", descriptionEn: "The offer has been sent.", descriptionEs: "La oferta fue enviada." },
  awaiting_decision: { en: "Awaiting decision", es: "Esperando decisión", descriptionEn: "The customer is deciding.", descriptionEs: "El cliente está evaluando la oferta." },
  accepted_pending_booking_payment: { en: "Accepted — booking and payment pending", es: "Aceptada — reserva y pago pendientes", descriptionEn: "Customer accepted; booking and payment are still pending.", descriptionEs: "El cliente aceptó; la reserva y el pago siguen pendientes." },
  closed_won: { en: "Closed won", es: "Ganada", descriptionEn: "Booking and required payment are complete.", descriptionEs: "La reserva y el pago requerido están completos." },
  closed_lost: { en: "Closed lost", es: "Perdida", descriptionEn: "The opportunity was not won.", descriptionEs: "La oportunidad no fue ganada." },
  cancelled: { en: "Cancelled", es: "Cancelada", descriptionEn: "The quote was cancelled.", descriptionEs: "La cotización fue cancelada." },
  expired: { en: "Expired", es: "Vencida", descriptionEn: "The quote expired before completion.", descriptionEs: "La cotización venció antes de completarse." },
};

export const SERVICE_STAGE_LABELS: Record<ServiceStage, { en: string; es: string; descriptionEn: string; descriptionEs: string }> = {
  confirmed: { en: "Confirmed", es: "Confirmado", descriptionEn: "The paid booking is confirmed.", descriptionEs: "La reserva pagada está confirmada." },
  scheduled: { en: "Scheduled", es: "Programado", descriptionEn: "A service date is scheduled.", descriptionEs: "El servicio tiene fecha programada." },
  team_assigned: { en: "Team assigned", es: "Equipo asignado", descriptionEn: "The operating team and resources are assigned.", descriptionEs: "El equipo y los recursos están asignados." },
  en_route: { en: "En route", es: "En camino", descriptionEn: "The team is travelling to the service.", descriptionEs: "El equipo está en camino al servicio." },
  in_progress: { en: "In progress", es: "En curso", descriptionEn: "The service is being performed.", descriptionEs: "El servicio está en ejecución." },
  finished: { en: "Finished", es: "Finalizado", descriptionEn: "The service is complete.", descriptionEs: "El servicio terminó." },
  on_hold: { en: "On hold", es: "En pausa", descriptionEn: "The service is paused pending action.", descriptionEs: "El servicio está pausado a la espera de una acción." },
  cancelled: { en: "Cancelled", es: "Cancelado", descriptionEn: "The service was cancelled.", descriptionEs: "El servicio fue cancelado." },
};

const quoteLegacyMap: Record<string, QuoteStage> = {
  intake: "draft", pending: "draft", draft: "draft",
  triage: "under_review", reviewing: "under_review", under_review: "under_review",
  bidding_open: "sent", bidding: "sent", solicited: "sent", sent: "sent",
  price_awaiting_client: "awaiting_decision", awaiting_decision: "awaiting_decision",
  accepted_pending_booking_payment: "accepted_pending_booking_payment",
  dispatch_planning: "accepted_pending_booking_payment", assignment_pending_partner: "accepted_pending_booking_payment",
  confirmed: "accepted_pending_booking_payment", scheduled: "accepted_pending_booking_payment",
  in_progress: "accepted_pending_booking_payment",
  completed: "closed_won", closed_won: "closed_won",
  lost: "closed_lost", closed_lost: "closed_lost",
  cancelled: "cancelled", expired: "expired",
};

const serviceLegacyMap: Record<string, ServiceStage> = {
  planning: "confirmed", awaiting_collection: "confirmed", confirmed: "confirmed",
  pre_service: "scheduled", ready: "team_assigned", scheduled: "scheduled",
  team_assigned: "team_assigned", en_route: "en_route", in_progress: "in_progress",
  post_service: "finished", completed: "finished", finished: "finished",
  exception: "on_hold", on_hold: "on_hold", cancelled: "cancelled",
};

export function normalizeQuoteStage(value: string | null | undefined): QuoteStage {
  return quoteLegacyMap[String(value || "").toLowerCase()] || "draft";
}

export function isQuoteStage(value: string | null | undefined): value is QuoteStage {
  return typeof value === "string" && (QUOTE_STAGES as string[]).includes(value);
}

export function normalizeServiceStage(value: string | null | undefined): ServiceStage {
  return serviceLegacyMap[String(value || "").toLowerCase()] || "confirmed";
}

export function canTransitionQuoteStage(from: string, to: string): boolean {
  const source = normalizeQuoteStage(from);
  const target = normalizeQuoteStage(to);
  return QUOTE_STAGE_TRANSITIONS[source].includes(target);
}

export function canTransitionServiceStage(from: string, to: string): boolean {
  const source = normalizeServiceStage(from);
  const target = normalizeServiceStage(to);
  return SERVICE_STAGE_TRANSITIONS[source].includes(target);
}