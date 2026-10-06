import { differenceInCalendarDays, eachDayOfInterval, format, getISODay, parseISO, startOfMonth, startOfToday } from "date-fns";
import { es, enUS } from "date-fns/locale";
import { CalendarDays, Star, Ban, Check } from "lucide-react";
import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import "./move-date-calendar.css";

interface MoveDatePreferencesProps {
  availabilityStart: string;
  availabilityEnd: string;
  preferredDates: string[];
  blockedDates: string[];
  onAvailabilityStartChange: (value: string) => void;
  onAvailabilityEndChange: (value: string) => void;
  onPreferredDatesChange: (value: string[]) => void;
  onBlockedDatesChange: (value: string[]) => void;
  isSpanish: boolean;
  primaryColor: string;
  error?: string;
}

const toIsoDate = (date: Date) => format(date, "yyyy-MM-dd");

export function MoveDatePreferences({
  availabilityStart,
  availabilityEnd,
  preferredDates,
  blockedDates = [],
  onAvailabilityStartChange,
  onAvailabilityEndChange,
  onPreferredDatesChange,
  onBlockedDatesChange,
  isSpanish,
  primaryColor,
  error,
}: MoveDatePreferencesProps) {
  const locale = isSpanish ? es : enUS;
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() =>
    startOfMonth(availabilityStart ? parseISO(availabilityStart) : startOfToday()));
  const selectedRange: DateRange | undefined = availabilityStart
    ? {
      from: parseISO(availabilityStart),
      to: availabilityEnd ? parseISO(availabilityEnd) : undefined,
    }
    : undefined;
  const availableDays = availabilityStart && availabilityEnd
    ? eachDayOfInterval({ start: parseISO(availabilityStart), end: parseISO(availabilityEnd) }).map(toIsoDate)
    : [];

  const updateRange = (start: string, end: string) => {
    const nextBlocked = blockedDates.filter((date) => (!start || date >= start) && (!end || date <= end));
    const nextPreferred = preferredDates.filter((date) =>
      (!start || date >= start)
      && (!end || date <= end)
      && !nextBlocked.includes(date)
    );
    onBlockedDatesChange(nextBlocked);
    onPreferredDatesChange(nextPreferred);
  };

  const setDateStatus = (date: string, status: "available" | "preferred" | "unavailable") => {
    if (status === "unavailable" && !blockedDates.includes(date)
      && availableDays.length - blockedDates.length <= 1) return;
    onBlockedDatesChange(status === "unavailable"
      ? [...blockedDates.filter((value) => value !== date), date]
      : blockedDates.filter((value) => value !== date));
    onPreferredDatesChange(status === "preferred"
      ? preferredDates.includes(date) ? preferredDates : [...preferredDates, date]
      : preferredDates.filter((value) => value !== date));
  };

  return (
    <div className="space-y-4 rounded-xl border bg-slate-50/70 p-3 sm:p-4">
      <div>
        <div className="flex items-center gap-2 font-semibold">
          <CalendarDays className="h-4 w-4" style={{ color: primaryColor }} />
          {isSpanish ? "Disponibilidad para la mudanza" : "Moving availability"}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {isSpanish
            ? "Selecciona hasta 14 días. Después, indica tus preferencias o los días que no te funcionan."
            : "Choose up to 14 days. Then mark your preferences or any dates that don't work."}
        </p>
      </div>

      <div className="space-y-1.5">
        <div className="text-sm font-medium">
          {isSpanish ? "Fecha o rango disponible" : "Available date or range"}
        </div>
        <Popover open={calendarOpen} onOpenChange={(open) => {
          setCalendarOpen(open);
          if (open) {
            setCalendarMonth(startOfMonth(availabilityStart ? parseISO(availabilityStart) : startOfToday()));
          }
        }}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className={cn(
                "h-12 w-full justify-start bg-white px-4 text-left font-normal",
                !availabilityStart && "text-muted-foreground",
              )}
              data-testid="button-move-availability-calendar"
            >
              <CalendarDays className="mr-2 h-4 w-4" />
              {!availabilityStart
                ? (isSpanish ? "Selecciona una fecha o un rango" : "Select a date or range")
                : availabilityEnd && availabilityEnd !== availabilityStart
                  ? `${format(parseISO(availabilityStart), "d MMM", { locale })} – ${format(parseISO(availabilityEnd), "d MMM yyyy", { locale })}`
                  : format(parseISO(availabilityStart), isSpanish ? "d 'de' MMMM 'de' yyyy" : "MMMM d, yyyy", { locale })}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[min(44rem,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl border-slate-200 bg-white p-0 shadow-2xl shadow-slate-900/10"
            align="start"
            collisionPadding={12}
            style={{ maxHeight: "min(44rem, var(--radix-popover-content-available-height))" }}
          >
            <div
              className="overflow-hidden px-3 py-3 sm:px-5 sm:py-4"
              style={{
                "--move-date-brand": primaryColor,
                "--move-date-range": `${primaryColor}18`,
              } as Record<string, string>}
            >
              <Calendar
                mode="range"
                numberOfMonths={2}
                month={calendarMonth}
                onMonthChange={setCalendarMonth}
                showOutsideDays={false}
                fixedWeeks
                selected={selectedRange}
                onSelect={(range) => {
                  if (!range?.from) {
                    onAvailabilityStartChange("");
                    onAvailabilityEndChange("");
                    onPreferredDatesChange([]);
                    onBlockedDatesChange([]);
                    return;
                  }

                  const start = toIsoDate(range.from);
                  const isStartingNewRange = !availabilityStart || Boolean(availabilityEnd);
                  if (isStartingNewRange) {
                    onAvailabilityStartChange(start);
                    onAvailabilityEndChange("");
                    onPreferredDatesChange([]);
                    onBlockedDatesChange([]);
                    setCalendarMonth(startOfMonth(range.from));
                    return;
                  }

                  const end = range.to ? toIsoDate(range.to) : "";
                  if (range.to && differenceInCalendarDays(range.to, range.from) > 13) return;

                  onAvailabilityStartChange(start);
                  onAvailabilityEndChange(end);
                  updateRange(start, end);
                }}
                disabled={{ before: startOfToday() }}
                max={14}
                locale={locale}
                initialFocus
                className="move-booking-calendar"
                classNames={{
                   months: "relative grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8",
                   month: "min-w-0 gap-3",
                  nav: "pointer-events-none absolute inset-x-0 top-0 z-10 flex w-full items-center justify-between",
                  button_previous: "pointer-events-auto h-10 w-10 rounded-full border-0 bg-transparent p-0 text-slate-500 shadow-none transition-colors hover:bg-slate-100 hover:text-slate-950 disabled:opacity-20",
                  button_next: "pointer-events-auto h-10 w-10 rounded-full border-0 bg-transparent p-0 text-slate-500 shadow-none transition-colors hover:bg-slate-100 hover:text-slate-950 disabled:opacity-20",
                  month_caption: "flex h-10 items-center justify-center px-12",
                  caption_label: "text-base font-semibold capitalize tracking-tight text-slate-900",
                  weekdays: "mb-1 flex",
                  weekday: "flex-1 text-center text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-slate-400",
                  week: "mt-2 flex w-full",
                  day: "group/day relative aspect-square h-full w-full select-none p-0 text-center",
                  day_button:
                    "h-[--cell-size] w-[--cell-size] min-w-0 rounded-xl text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 data-[selected-single=true]:!bg-[var(--move-date-brand)] data-[selected-single=true]:!text-white data-[range-start=true]:!bg-[var(--move-date-brand)] data-[range-start=true]:!text-white data-[range-end=true]:!bg-[var(--move-date-brand)] data-[range-end=true]:!text-white data-[range-middle=true]:!bg-[var(--move-date-range)] data-[range-middle=true]:!text-slate-900",
                  range_start: "rounded-l-xl bg-[var(--move-date-range)]",
                  range_end: "rounded-r-xl bg-[var(--move-date-range)]",
                  range_middle: "rounded-none bg-[var(--move-date-range)]",
                  today: "rounded-xl bg-slate-100 font-semibold text-slate-950",
                  outside: "text-slate-300",
                  disabled: "text-slate-300 opacity-60",
                }}
              />
            </div>
            {availabilityStart && (
              <div className="border-t border-slate-100 bg-slate-50/60 p-3 sm:px-5">
                <Button
                  type="button"
                  className="w-full text-white hover:text-white shadow-sm"
                  style={{ backgroundColor: primaryColor, color: "#ffffff" }}
                  onClick={() => {
                    if (!availabilityEnd) {
                      onAvailabilityEndChange(availabilityStart);
                      onPreferredDatesChange([availabilityStart]);
                      onBlockedDatesChange([]);
                    }
                    setCalendarOpen(false);
                  }}
                >
                  {availabilityEnd
                    ? (isSpanish ? "Confirmar fechas" : "Confirm dates")
                    : (isSpanish ? "Usar solo este día" : "Use only this day")}
                </Button>
              </div>
            )}
            <p className="border-t border-slate-100 bg-slate-50/50 px-5 py-3 text-center text-xs leading-relaxed text-slate-500">
              {isSpanish
                ? "Selecciona un día o marca el inicio y fin de una ventana de hasta 14 días."
                : "Choose one day or select the start and end of a window of up to 14 days."}
            </p>
          </PopoverContent>
        </Popover>
      </div>

      {availableDays.length > 1 && (
        <div className="space-y-1.5 rounded-xl border bg-white p-2" data-testid="move-date-status-list">
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            {isSpanish
              ? "Toca un día para cambiarlo. El orden en que marcas tus preferidos define su prioridad."
              : "Tap a date to change it. The order you mark preferred dates sets their priority."}
          </p>
          <div className="grid grid-cols-7 text-center text-[11px] font-bold uppercase text-slate-500" aria-hidden="true">
            {(isSpanish ? ["L", "M", "X", "J", "V", "S", "D"] : ["M", "T", "W", "T", "F", "S", "S"]).map((day, index) => (
              <span key={`${day}-${index}`} className="py-1">{day}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: getISODay(parseISO(availableDays[0])) - 1 }, (_, index) => (
              <span key={`blank-${index}`} aria-hidden="true" />
            ))}
            {availableDays.map((date) => {
              const blocked = blockedDates.includes(date);
              const rank = preferredDates.indexOf(date);
              const status = blocked ? "unavailable" : rank >= 0 ? "preferred" : "available";
              const cannotBlock = !blocked && availableDays.length - blockedDates.length <= 1;
              const label = format(parseISO(date), isSpanish ? "EEEE d 'de' MMMM" : "EEEE, MMMM d", { locale });
              return (
                <Popover key={date} open={activeDate === date}
                  onOpenChange={(open) => setActiveDate(open ? date : null)}>
                  <PopoverTrigger asChild>
                    <button type="button"
                      data-status={status}
                      data-testid={`date-row-${date}`}
                      aria-label={`${label}: ${status === "preferred" ? `${isSpanish ? "preferencia" : "preference"} ${rank + 1}` : status === "unavailable" ? (isSpanish ? "no disponible" : "unavailable") : (isSpanish ? "disponible" : "available")}`}
                      className={cn("relative flex aspect-square min-w-0 items-center justify-center rounded-md border text-xs font-semibold transition-colors sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-700 focus-visible:ring-offset-1",
                        status === "available" && "border-emerald-200 bg-white text-slate-700 hover:bg-emerald-50",
                        status === "unavailable" && "border-red-200 bg-red-50 text-red-700",
                        status === "preferred" && "border-transparent text-white shadow-sm")}
                      style={status === "preferred" ? { backgroundColor: primaryColor, color: "#fff" } : undefined}>
                      {format(parseISO(date), "d")}
                      {status === "available" && <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-emerald-500" aria-hidden="true" />}
                      {rank >= 0 && <span
                        className="absolute right-0 top-0 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white text-[9px] font-extrabold leading-none shadow-sm ring-1 ring-purple-200 sm:h-4 sm:w-4 sm:text-[10px]"
                        style={{ color: primaryColor }}
                        aria-label={`${isSpanish ? "Prioridad" : "Priority"} ${rank + 1}`}
                        title={`${isSpanish ? "Prioridad" : "Priority"} ${rank + 1}`}>
                        {rank + 1}
                      </span>}
                      {blocked && <Ban className="absolute right-0.5 top-0.5 h-2.5 w-2.5" aria-hidden="true" />}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 rounded-xl p-1.5 shadow-xl" align="center" sideOffset={5}>
                    <div className="mb-1 px-2 py-1 text-xs font-semibold capitalize text-slate-700">{label}</div>
                    {([
                      { value: "preferred", text: isSpanish ? "Preferido" : "Preferred", Icon: Star, style: "text-purple-800 hover:bg-purple-50" },
                      { value: "available", text: isSpanish ? "Disponible" : "Available", Icon: Check, style: "text-emerald-700 hover:bg-emerald-50" },
                      { value: "unavailable", text: isSpanish ? "No disponible" : "Unavailable", Icon: Ban, style: "text-red-700 hover:bg-red-50" },
                    ] as const).map(({ value, text, Icon, style }) => (
                      <button key={value} type="button"
                        aria-pressed={status === value}
                        disabled={value === "unavailable" && cannotBlock}
                        onClick={() => {
                          setDateStatus(date, value);
                          setActiveDate(null);
                        }}
                        className={cn("flex h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40", style,
                          status === value && "bg-slate-100")}>
                        <span className={cn("flex h-7 w-7 items-center justify-center rounded-full",
                          value === "preferred" && "bg-purple-100",
                          value === "available" && "bg-emerald-100",
                          value === "unavailable" && "bg-red-100")}>
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <span className="flex-1">{text}</span>
                        {status === value && <Check className="h-4 w-4" aria-hidden="true" />}
                      </button>
                    ))}
                    {cannotBlock && <p className="px-2 pb-1 pt-2 text-[10px] leading-tight text-muted-foreground">
                      {isSpanish ? "Al menos un día debe quedar disponible." : "At least one date must remain available."}
                    </p>}
                  </PopoverContent>
                </Popover>
              );
            })}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span><strong className="text-slate-700">{preferredDates.length}</strong> {isSpanish ? "preferidos" : "preferred"}</span>
            <span><strong className="text-red-700">{blockedDates.length}</strong> {isSpanish ? "no disponibles" : "unavailable"}</span>
          </div>
        </div>
      )}

      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
    </div>
  );
}