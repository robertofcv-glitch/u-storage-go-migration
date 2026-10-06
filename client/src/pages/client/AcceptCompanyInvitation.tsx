import { useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AcceptCompanyInvitation() {
  const { i18n } = useTranslation();
  const es = i18n.language.startsWith("es");
  const [, params] = useRoute("/accept-company-invitation/:token");
  const [, setLocation] = useLocation();
  const accept = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/companies/invitations/${params?.token}/accept`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" } });
      if (res.status === 401) throw new Error(es ? "Inicia sesión con el correo que recibió la invitación." : "Sign in with the email that received this invitation.");
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || (es ? "La invitación no es válida." : "The invitation is not valid."));
      return res.json();
    },
  });
  return <main className="flex min-h-screen items-center justify-center bg-[var(--usg-paper)] p-4"><Card className="workspace-card w-full max-w-md"><CardHeader><CardTitle>{es ? "Invitación de empresa" : "Company invitation"}</CardTitle></CardHeader><CardContent className="space-y-4 text-center">
    {accept.isSuccess ? <><CheckCircle2 className="mx-auto h-12 w-12 text-green-600" /><p>{es ? "Te uniste correctamente al equipo." : "You successfully joined the team."}</p><Button onClick={() => setLocation(accept.data?.company?.classification === "partner" || accept.data?.company?.classification === "both" ? "/mover/dashboard/company" : "/dashboard/company")}>{es ? "Ir a mi equipo" : "Go to my team"}</Button></> : <><p className="text-muted-foreground">{es ? "Acepta la invitación usando la cuenta del correo invitado." : "Accept using the account for the invited email address."}</p>{accept.isError && <p className="rounded bg-red-50 p-3 text-sm text-red-700">{(accept.error as Error).message}</p>}<Button disabled={accept.isPending || !params?.token} onClick={() => accept.mutate()}>{accept.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{es ? "Aceptar invitación" : "Accept invitation"}</Button>{accept.isError && <Button variant="outline" onClick={() => setLocation(`/login?redirect=${encodeURIComponent(window.location.pathname)}`)}>{es ? "Iniciar sesión" : "Sign in"}</Button>}</>}
  </CardContent></Card></main>;
}