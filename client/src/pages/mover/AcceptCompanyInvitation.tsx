import { useState } from "react";
import { Link, useParams } from "wouter";
import { Building2, CheckCircle2, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AcceptCompanyInvitation() {
  const { token } = useParams<{ token: string }>();
  const { user, isLoading } = useAuth();
  const { i18n } = useTranslation();
  const es = i18n.language === "es";
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);

  const accept = async () => {
    setAccepting(true);
    setError("");
    try {
      const response = await fetch(`/api/partner/company/invitations/${encodeURIComponent(token)}/accept`, {
        method: "POST",
        credentials: "include",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || (es ? "No se pudo aceptar la invitación" : "Could not accept invitation"));
      setAccepted(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (es ? "No se pudo aceptar la invitación" : "Could not accept invitation"));
    } finally {
      setAccepting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--usg-paper)] px-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <Building2 className="mx-auto h-10 w-10 text-[var(--usg-purple)]" />
          <CardTitle>{es ? "Invitación a empresa" : "Company invitation"}</CardTitle>
          <CardDescription>
            {es ? "Únete con tu propia cuenta para colaborar con el equipo." : "Join with your own account to collaborate with the team."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {isLoading ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : accepted ? (
            <>
              <CheckCircle2 className="mx-auto h-10 w-10 text-green-600" />
              <p>{es ? "La invitación fue aceptada." : "The invitation was accepted."}</p>
              <Button asChild><Link href="/mover/dashboard">{es ? "Abrir espacio de empresa" : "Open company workspace"}</Link></Button>
            </>
          ) : !user ? (
            <>
              <p className="text-sm text-muted-foreground">{es ? "Inicia sesión con el correo que recibió esta invitación y vuelve a abrir este enlace." : "Sign in with the email that received this invitation, then reopen this link."}</p>
              <Button asChild><Link href="/login">{es ? "Iniciar sesión" : "Sign in"}</Link></Button>
            </>
          ) : (
            <>
              <p className="text-sm">{user.email}</p>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button onClick={accept} disabled={accepting}>
                {accepting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {es ? "Aceptar invitación" : "Accept invitation"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}