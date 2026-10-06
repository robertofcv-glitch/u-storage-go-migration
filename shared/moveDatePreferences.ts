import { z } from "zod";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function utcDay(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function isCalendarDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

const calendarDateSchema = z.string().refine(isCalendarDate, "Invalid calendar date");

export const moveDatePreferencesSchema = z.object({
  availabilityStart: calendarDateSchema,
  availabilityEnd: calendarDateSchema,
  preferredDates: z.array(calendarDateSchema),
  blockedDates: z.array(calendarDateSchema).default([]),
}).superRefine((value, context) => {
  const start = utcDay(value.availabilityStart);
  const end = utcDay(value.availabilityEnd);
  const span = Math.round((end - start) / 86_400_000);

  if (span < 0) {
    context.addIssue({ code: "custom", path: ["availabilityEnd"], message: "End date must be after start date" });
  } else if (span > 13) {
    context.addIssue({ code: "custom", path: ["availabilityEnd"], message: "Availability cannot exceed 14 calendar days" });
  }

  if (new Set(value.preferredDates).size !== value.preferredDates.length) {
    context.addIssue({ code: "custom", path: ["preferredDates"], message: "Preferred dates must be unique" });
  }
  if (new Set(value.blockedDates).size !== value.blockedDates.length) {
    context.addIssue({ code: "custom", path: ["blockedDates"], message: "Blocked dates must be unique" });
  }

  const validateInRange = (date: string, path: (string | number)[]) => {
    const day = utcDay(date);
    if (day < start || day > end) {
      context.addIssue({
        code: "custom",
        path,
        message: "Dates must be within the availability range",
      });
    }
  };

  value.preferredDates.forEach((date, index) => validateInRange(date, ["preferredDates", index]));
  value.blockedDates.forEach((date, index) => validateInRange(date, ["blockedDates", index]));

  const blocked = new Set(value.blockedDates);
  value.preferredDates.forEach((date, index) => {
    if (blocked.has(date)) {
      context.addIssue({
        code: "custom",
        path: ["preferredDates", index],
        message: "A preferred date cannot also be blocked",
      });
    }
  });

  if (span >= 0 && value.blockedDates.length >= span + 1) {
    context.addIssue({ code: "custom", path: ["blockedDates"], message: "At least one date must remain available" });
  }
}).transform((value) => ({
  ...value,
  // A one-day window is necessarily the customer's preferred day. Multi-day
  // windows may intentionally have no preferences at all.
  preferredDates: value.availabilityStart === value.availabilityEnd && value.preferredDates.length === 0
    ? [value.availabilityStart]
    : value.preferredDates,
}));

export function firstNonBlockedAvailableDate(
  availabilityStart: string,
  availabilityEnd: string,
  blockedDates: string[],
): string | null {
  if (!isCalendarDate(availabilityStart) || !isCalendarDate(availabilityEnd)) return null;

  const end = utcDay(availabilityEnd);
  const blocked = new Set(blockedDates);
  for (let day = utcDay(availabilityStart); day <= end; day += 86_400_000) {
    const candidate = new Date(day).toISOString().slice(0, 10);
    if (!blocked.has(candidate)) return candidate;
  }
  return null;
}

export function legacyMoveDateForPreferences(
  preferences: MoveDatePreferences,
): string | null {
  return preferences.preferredDates[0] ?? firstNonBlockedAvailableDate(
    preferences.availabilityStart,
    preferences.availabilityEnd,
    preferences.blockedDates,
  );
}

export type MoveDatePreferences = z.infer<typeof moveDatePreferencesSchema>;

export function parseMoveDatePreferences(input: unknown): MoveDatePreferences {
  return moveDatePreferencesSchema.parse(input);
}