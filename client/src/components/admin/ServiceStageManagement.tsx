import { useEffect, useMemo, useState } from "react";
import { Check, GripVertical, Pencil, ShieldCheck, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SERVICE_STAGE_LABELS, SERVICE_STAGE_V2, type ServiceStage } from "@shared/workflowStages";

type StagePresentation = {
  key: ServiceStage;
  labelEs: string;
  labelEn: string;
  descriptionEs: string;
  descriptionEn: string;
  color: string;
  bgColor: string;
  isActive: boolean;
  isFinal: boolean;
};

const DEFAULT_PRESENTATION: StagePresentation[] = [
  [SERVICE_STAGE_V2.CONFIRMED, "#2563eb", "#dbeafe"],
  [SERVICE_STAGE_V2.SCHEDULED, "#7c3aed", "#ede9fe"],
  [SERVICE_STAGE_V2.TEAM_ASSIGNED, "#0891b2", "#cffafe"],
  [SERVICE_STAGE_V2.EN_ROUTE, "#0f766e", "#ccfbf1"],
  [SERVICE_STAGE_V2.IN_PROGRESS, "#d97706", "#fef3c7"],
  [SERVICE_STAGE_V2.FINISHED, "#15803d", "#dcfce7"],
  [SERVICE_STAGE_V2.ON_HOLD, "#b45309", "#fef3c7"],
  [SERVICE_STAGE_V2.CANCELLED, "#b91c1c", "#fee2e2"],
].map(([key, color, bgColor]) => {
  const definition = SERVICE_STAGE_LABELS[key as ServiceStage];
  return {
    key: key as ServiceStage,
    labelEs: definition.es,
    labelEn: definition.en,
    descriptionEs: definition.descriptionEs,
    descriptionEn: definition.descriptionEn,
    color,
    bgColor,
    isActive: true,
    isFinal: key === SERVICE_STAGE_V2.FINISHED || key === SERVICE_STAGE_V2.CANCELLED,
  };
});

export function ServiceStageManagement() {
  const { i18n } = useTranslation();
  const lang = i18n.language === "es" ? "es" : "en";
  const [stages, setStages] = useState<StagePresentation[]>(() => {
    try {
      const saved = window.localStorage.getItem("admin-service-stage-presentation");
      return saved ? JSON.parse(saved) : DEFAULT_PRESENTATION;
    } catch {
      return DEFAULT_PRESENTATION;
    }
  });
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [editing, setEditing] = useState<StagePresentation | null>(null);
  const [draft, setDraft] = useState<StagePresentation | null>(null);
  useEffect(() => {
    try { window.localStorage.setItem("admin-service-stage-presentation", JSON.stringify(stages)); } catch { /* storage is optional */ }
  }, [stages]);

  const protectedKeys = useMemo(() => new Set<ServiceStage>([
    SERVICE_STAGE_V2.CONFIRMED,
    SERVICE_STAGE_V2.SCHEDULED,
    SERVICE_STAGE_V2.TEAM_ASSIGNED,
    SERVICE_STAGE_V2.EN_ROUTE,
    SERVICE_STAGE_V2.IN_PROGRESS,
    SERVICE_STAGE_V2.FINISHED,
    SERVICE_STAGE_V2.ON_HOLD,
    SERVICE_STAGE_V2.CANCELLED,
  ]), []);

  const openEdit = (stage: StagePresentation) => {
    setEditing(stage);
    setDraft({ ...stage });
  };

  const saveEdit = () => {
    if (!draft) return;
    setStages((current) => current.map((stage) => stage.key === draft.key ? draft : stage));
    setEditing(null);
    setDraft(null);
  };

  const handleDrop = (event: React.DragEvent, dropIndex: number) => {
    event.preventDefault();
    if (draggedIndex == null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }
    setStages((current) => {
      const next = [...current];
      const [moved] = next.splice(draggedIndex, 1);
      next.splice(dropIndex, 0, moved);
      return next;
    });
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-service-stages-title">
            {lang === "es" ? "Etapas del flujo de servicios" : "Service workflow stages"}
          </h2>
          <p className="text-muted-foreground">
            {lang === "es" ? "Administra la presentación del flujo operativo sin cambiar sus reglas." : "Manage the operational flow presentation without changing its rules."}
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{lang === "es"
          ? "Las claves y las transiciones están protegidas. Puedes reordenar y editar la presentación, pero no crear, eliminar ni cambiar la lógica de una etapa."
          : "Keys and transitions are protected. You can reorder and edit presentation, but cannot create, delete, or change stage logic."}</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GripVertical className="h-5 w-5 text-muted-foreground" />
            {lang === "es" ? "Orden del flujo operativo" : "Operational flow order"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stages.map((stage, index) => (
              <div
                key={stage.key}
                draggable
                onDragStart={() => setDraggedIndex(index)}
                onDragOver={(event) => { event.preventDefault(); setDragOverIndex(index); }}
                onDragLeave={() => setDragOverIndex(null)}
                onDragEnd={() => { setDraggedIndex(null); setDragOverIndex(null); }}
                onDrop={(event) => handleDrop(event, index)}
                className={`flex items-center gap-3 rounded-lg border bg-card p-3 transition-all ${draggedIndex === index ? "scale-95 opacity-50" : dragOverIndex === index ? "border-primary border-2 bg-primary/5" : "hover:bg-accent/50"}`}
                data-testid={`service-stage-row-${stage.key}`}
              >
                <div className="cursor-grab rounded p-1 hover:bg-accent active:cursor-grabbing" data-testid={`service-stage-drag-${stage.key}`}>
                  <GripVertical className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex min-w-[120px] items-center gap-2">
                  <div className="h-4 w-4 rounded-full border" style={{ backgroundColor: stage.color }} />
                  <span className="rounded px-2 py-1 text-sm font-medium" style={{ backgroundColor: stage.bgColor, color: stage.color }}>{index + 1}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{lang === "es" ? stage.labelEs : stage.labelEn}</div>
                  <div className="text-sm text-muted-foreground">
                    <code className="rounded bg-muted px-1">{stage.key}</code> · {lang === "es" ? stage.descriptionEs : stage.descriptionEn}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {stage.isFinal && <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-800">{lang === "es" ? "Final" : "Final"}</span>}
                  {stage.isActive ? <Check className="h-4 w-4 text-green-600" /> : <X className="h-4 w-4 text-red-600" />}
                </div>
                <Button variant="ghost" size="icon" onClick={() => openEdit(stage)} data-testid={`service-stage-edit-${stage.key}`}>
                  <Pencil className="h-4 w-4" />
                </Button>
                {!protectedKeys.has(stage.key) && <Badge variant="outline">{lang === "es" ? "Personalizada" : "Custom"}</Badge>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) { setEditing(null); setDraft(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{lang === "es" ? "Editar presentación de etapa" : "Edit stage presentation"}</DialogTitle></DialogHeader>
          {draft && <div className="space-y-4">
            <div className="rounded-lg border bg-muted/50 p-3 text-sm">
              <span className="text-muted-foreground">{lang === "es" ? "Clave protegida" : "Protected key"}: </span><code>{draft.key}</code>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label>{lang === "es" ? "Nombre (Español)" : "Name (Spanish)"}</Label><Input value={draft.labelEs} onChange={(e) => setDraft({ ...draft, labelEs: e.target.value })} /></div>
              <div><Label>{lang === "es" ? "Nombre (Inglés)" : "Name (English)"}</Label><Input value={draft.labelEn} onChange={(e) => setDraft({ ...draft, labelEn: e.target.value })} /></div>
            </div>
            <div><Label>{lang === "es" ? "Descripción (Español)" : "Description (Spanish)"}</Label><Input value={draft.descriptionEs} onChange={(e) => setDraft({ ...draft, descriptionEs: e.target.value })} /></div>
            <div><Label>{lang === "es" ? "Descripción (Inglés)" : "Description (English)"}</Label><Input value={draft.descriptionEn} onChange={(e) => setDraft({ ...draft, descriptionEn: e.target.value })} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label>{lang === "es" ? "Color del texto" : "Text color"}</Label><Input type="color" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} className="h-10 w-16 p-1" /></div>
              <div><Label>{lang === "es" ? "Color de fondo" : "Background color"}</Label><Input type="color" value={draft.bgColor} onChange={(e) => setDraft({ ...draft, bgColor: e.target.value })} className="h-10 w-16 p-1" /></div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={draft.isActive} onCheckedChange={(checked) => setDraft({ ...draft, isActive: checked })} /><Label>{lang === "es" ? "Activo" : "Active"}</Label></div>
          </div>}
          <DialogFooter><Button variant="outline" onClick={() => { setEditing(null); setDraft(null); }}>{lang === "es" ? "Cancelar" : "Cancel"}</Button><Button onClick={saveEdit}>{lang === "es" ? "Guardar" : "Save"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}