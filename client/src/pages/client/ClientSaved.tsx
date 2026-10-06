import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";
import { Package, Truck, MapPin, Home, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { SavedAddress } from "@shared/schema";

export default function ClientSaved() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<SavedAddress | null>(null);
  const [formData, setFormData] = useState({
    label: "",
    fullAddress: "",
  });

  const isSpanish = i18n.language === "es";

  const sidebarLinks = [
    { href: "/dashboard", label: t('dashboard.client.nav.overview'), icon: Home },
    { href: "/dashboard/moves", label: t('dashboard.client.nav.moves'), icon: Truck },
    { href: "/dashboard/quotes", label: t('dashboard.client.nav.quotes'), icon: Package },
    { href: "/dashboard/saved", label: t('dashboard.client.nav.saved'), icon: MapPin },
  ];

  const { data: addressesData, isLoading } = useQuery({
    queryKey: ["/api/addresses"],
    queryFn: async () => {
      const res = await fetch("/api/addresses", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch addresses");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create address");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/addresses"] });
      toast.success(isSpanish ? "Dirección guardada" : "Address saved");
      closeDialog();
    },
    onError: () => {
      toast.error(isSpanish ? "Error al guardar" : "Failed to save");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const res = await fetch(`/api/addresses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update address");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/addresses"] });
      toast.success(isSpanish ? "Dirección actualizada" : "Address updated");
      closeDialog();
    },
    onError: () => {
      toast.error(isSpanish ? "Error al actualizar" : "Failed to update");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/addresses/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete address");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/addresses"] });
      toast.success(isSpanish ? "Dirección eliminada" : "Address deleted");
    },
    onError: () => {
      toast.error(isSpanish ? "Error al eliminar" : "Failed to delete");
    },
  });

  const closeDialog = () => {
    setIsAddDialogOpen(false);
    setEditingAddress(null);
    setFormData({
      label: "",
      fullAddress: "",
    });
  };

  const openEditDialog = (address: SavedAddress) => {
    setEditingAddress(address);
    setFormData({
      label: address.label || "",
      fullAddress: address.fullAddress || "",
    });
    setIsAddDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.label || !formData.fullAddress) {
      toast.error(isSpanish ? "Nombre y dirección son requeridos" : "Name and address are required");
      return;
    }
    if (editingAddress) {
      updateMutation.mutate({ id: editingAddress.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const addresses: SavedAddress[] = addressesData?.addresses || [];

  return (
    <DashboardLayout links={sidebarLinks} userType="client">
      <div className="flex flex-col gap-4 lg:gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--usg-ink)]">
              {isSpanish ? "Direcciones Guardadas" : "Saved Addresses"}
            </h1>
            <p className="text-muted-foreground">
              {isSpanish ? "Administra tus direcciones frecuentes" : "Manage your frequent addresses"}
            </p>
          </div>
          <Button 
            className="bg-[var(--usg-orange)] text-[var(--usg-ink)] hover:bg-orange-600"
            data-testid="button-add-address"
            onClick={() => setIsAddDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            {isSpanish ? "Agregar Dirección" : "Add Address"}
          </Button>
        </div>

        <Card className="workspace-card">
          <CardHeader>
            <CardTitle>{isSpanish ? "Mis Direcciones" : "My Addresses"}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-[var(--usg-orange)]" />
              </div>
            ) : addresses.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>{isSpanish ? "No tienes direcciones guardadas" : "No saved addresses yet"}</p>
                <p className="text-sm mt-1">
                  {isSpanish 
                    ? "Agrega direcciones para usarlas rápidamente en tus cotizaciones" 
                    : "Add addresses to quickly use them in your quotes"}
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {addresses.map((address) => (
                  <div 
                    key={address.id}
                    className="flex items-center justify-between p-4 border rounded-lg bg-white hover:shadow-sm transition-shadow"
                    data-testid={`address-card-${address.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="bg-slate-100 p-2 rounded-full">
                        <MapPin className="h-5 w-5 text-[var(--usg-purple)]" />
                      </div>
                      <div>
                        <h4 className="font-semibold">{address.label}</h4>
                        <p className="text-sm text-slate-500">{address.fullAddress}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => openEditDialog(address)}
                        data-testid={`button-edit-address-${address.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => {
                          if (confirm(isSpanish ? "¿Eliminar esta dirección?" : "Delete this address?")) {
                            deleteMutation.mutate(address.id);
                          }
                        }}
                        data-testid={`button-delete-address-${address.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isAddDialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingAddress 
                ? (isSpanish ? "Editar Dirección" : "Edit Address") 
                : (isSpanish ? "Nueva Dirección" : "New Address")}
            </DialogTitle>
            <DialogDescription>
              {isSpanish 
                ? "Ingresa los detalles de la dirección" 
                : "Enter the address details"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="label">{isSpanish ? "Nombre" : "Name"} *</Label>
                <Input
                  id="label"
                  placeholder={isSpanish ? "Ej: Casa, Oficina, Bodega..." : "E.g.: Home, Office, Warehouse..."}
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  data-testid="input-address-label"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">{isSpanish ? "Dirección" : "Address"} *</Label>
                <AddressAutocomplete
                  value={formData.fullAddress}
                  onChange={(value) => setFormData({ ...formData, fullAddress: value })}
                  placeholder={isSpanish ? "Buscar dirección..." : "Search address..."}
                  data-testid="input-address-full"
                />
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={closeDialog}>
                {isSpanish ? "Cancelar" : "Cancel"}
              </Button>
              <Button 
                type="submit" 
                className="bg-[var(--usg-orange)] text-[var(--usg-ink)] hover:bg-orange-600"
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-address"
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {isSpanish ? "Guardar" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
