import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, ExternalLink, MapPin, Navigation } from "lucide-react";
import { getStorageMoveContext, type StorageMoveQuoteLike } from "@shared/storageMoveContext";

type StorageMoveContextProps = {
  quote: StorageMoveQuoteLike;
  lang: "es" | "en";
  compact?: boolean;
};

const copy = (lang: "es" | "en", es: string, en: string) => lang === "es" ? es : en;

export function StorageMoveContext({ quote, lang, compact = false }: StorageMoveContextProps) {
  const context = getStorageMoveContext(quote);
  const branch = context.branch;
  const serviceLabel = lang === "es" ? context.labels.serviceEs : context.labels.serviceEn;
  const directionLabel = lang === "es" ? context.labels.directionEs : context.labels.directionEn;

  return (
    <Card className={compact ? "border-[#d9c4bd] bg-[#fffaf6]" : "border-[#d9c4bd] bg-[#fff8f2]"} data-testid="storage-move-context">
      <CardContent className={compact ? "p-3 sm:p-4" : "p-4 sm:p-5"}>
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg bg-[#351d3d] p-2 text-[#f7b17c]">
            {context.isBranchConnected ? <Building2 className="h-4 w-4" /> : <Navigation className="h-4 w-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#351d3d]">
                {copy(lang, "Tipo de servicio", "Service type")}
              </p>
              <Badge className="border-0 bg-[#351d3d] text-[#fff8f2]">{serviceLabel}</Badge>
              {directionLabel && <Badge variant="outline" className="border-[#b85631] text-[#8d3f3a]">{directionLabel}</Badge>}
            </div>
            {context.isBranchConnected && branch ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {copy(lang, "Bodega al reservar", "Branch at booking")}
                  </p>
                  <p className="mt-1 truncate font-semibold text-[#351d3d]">{branch.brand} · {branch.name}</p>
                  <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span>{branch.address}</span>
                  </p>
                </div>
                <div className="min-w-0 rounded-md border border-[#ead9d0] bg-white/60 px-3 py-2 text-xs">
                  <p className="font-semibold text-[#644f59]">{copy(lang, "Identidad histórica", "Historical identity")}</p>
                  <p className="mt-1 break-all text-muted-foreground">Google Place ID: {branch.googlePlaceId}</p>
                  {branch.region && <p className="mt-1 text-muted-foreground">{branch.region}</p>}
                  {branch.mapsUrl && <a href={branch.mapsUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 font-medium text-[#8d3f3a] underline"><ExternalLink className="h-3 w-3" />{copy(lang, "Abrir mapa", "Open map")}</a>}
                </div>
              </div>
            ) : context.isBranchConnected ? (
              <p className="mt-2 text-sm text-muted-foreground">{copy(lang, "Los datos históricos de la sucursal no están completos.", "Historical branch details are incomplete.")}</p>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">{copy(lang, "Este servicio no está conectado a una bodega.", "This service is not connected to a storage branch.")}</p>
            )}
            {(() => {
              const extended = quote as StorageMoveQuoteLike & {
                storageContractStatus?: string | null;
                storageSizeLabel?: string | null;
                storageReservationStatus?: string | null;
                storageSelectedUnitSnapshot?: {
                  code?: string;
                  usableSizeM2?: number | string;
                  dimensions?: string;
                  floor?: string | number;
                  priceMxn?: number | string;
                  promotion?: string;
                } | null;
              };
              const unit = extended.storageSelectedUnitSnapshot;
              return (extended.storageContractStatus || unit) ? (
                <div className="mt-3 rounded-md border border-[#ead9d0] bg-white/60 px-3 py-2 text-xs" data-testid="storage-booking-snapshot">
                  <p className="font-semibold text-[#644f59]">{copy(lang, "Decisión de bodega", "Storage decision")}</p>
                  {extended.storageContractStatus === "existing" && <p className="mt-1 text-muted-foreground">{copy(lang, "Cliente con contrato existente", "Customer has an existing contract")}</p>}
                  {extended.storageContractStatus === "needs_unit" && <p className="mt-1 text-muted-foreground">{copy(lang, "Cliente necesita una unidad", "Customer needs a unit")}</p>}
                  {extended.storageSizeLabel && <p className="mt-1 text-muted-foreground">{copy(lang, "Tamaño recomendado", "Recommended size")}: {extended.storageSizeLabel}</p>}
                  {unit && <p className="mt-1 text-muted-foreground">{unit.usableSizeM2} m² · {unit.dimensions || "—"} · {copy(lang, "Piso", "Floor")} {unit.floor || "—"}{unit.priceMxn != null ? ` · $${Number(unit.priceMxn).toLocaleString()} MXN/mes` : ""}</p>}
                  {unit?.promotion && <p className="mt-1 text-green-700">{unit.promotion}</p>}
                  {extended.storageReservationStatus === "handed_off" && <p className="mt-1 font-medium text-[#8d3f3a]">{copy(lang, "Reserva iniciada en U-Storage", "Reservation started on U-Storage")}</p>}
                </div>
              ) : null;
            })()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}