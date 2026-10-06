import { useState, useRef } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { LayoutDashboard, FileText, Car, Building2, Truck, Users, Upload, CheckCircle2, AlertCircle, Clock, XCircle, File, Eye, Trash2, Loader2, FileCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface DocumentType {
  id: string;
  key: string;
  nameEs: string;
  nameEn: string;
  descriptionEs: string | null;
  descriptionEn: string | null;
  isRequired: boolean;
  isActive: boolean;
  sortOrder: number;
}

interface PartnerDocument {
  id: string;
  moverProfileId: string;
  documentTypeId: string;
  fileName: string;
  fileType: string | null;
  fileSize: number | null;
  status: string;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  documentType?: DocumentType;
}

export default function MoverDocuments() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploadingTypeId, setUploadingTypeId] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<PartnerDocument | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isSpanish = i18n.language === 'es';

  const sidebarLinks = [
    { href: "/mover/dashboard", label: t('dashboard.mover.nav.overview'), icon: LayoutDashboard },
    { href: "/mover/dashboard/profile", label: t('dashboard.mover.nav.profile'), icon: Building2 },
    { href: "/mover/dashboard/documents", label: isSpanish ? 'Documentos' : 'Documents', icon: FileCheck },
    { href: "/mover/dashboard/jobs", label: t('dashboard.mover.nav.jobs'), icon: Truck },
    { href: "/mover/dashboard/quotes", label: t('dashboard.mover.nav.quotes'), icon: FileText },
    { href: "/mover/dashboard/fleet", label: t('dashboard.mover.nav.fleet'), icon: Car },
    { href: "/mover/dashboard/drivers", label: t('dashboard.mover.nav.drivers'), icon: Users },
  ];

  const { data: documentTypes = [], isLoading: typesLoading } = useQuery<DocumentType[]>({
    queryKey: ['mover-document-types'],
    queryFn: async () => {
      const response = await fetch('/api/mover/document-types');
      if (!response.ok) throw new Error('Failed to fetch document types');
      return response.json();
    },
  });

  const { data: myDocuments = [], isLoading: docsLoading } = useQuery<PartnerDocument[]>({
    queryKey: ['mover-documents'],
    queryFn: async () => {
      const response = await fetch('/api/mover/documents');
      if (!response.ok) throw new Error('Failed to fetch documents');
      return response.json();
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ documentTypeId, file }: { documentTypeId: string; file: File }) => {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const response = await fetch('/api/mover/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentTypeId,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          fileData: base64,
        }),
      });

      if (!response.ok) throw new Error('Failed to upload document');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mover-documents'] });
      setUploadingTypeId(null);
      toast({
        title: isSpanish ? 'Documento subido' : 'Document uploaded',
        description: isSpanish ? 'Tu documento ha sido enviado para revisión' : 'Your document has been submitted for review',
      });
    },
    onError: () => {
      setUploadingTypeId(null);
      toast({
        title: isSpanish ? 'Error' : 'Error',
        description: isSpanish ? 'No se pudo subir el documento' : 'Failed to upload document',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const response = await fetch(`/api/mover/documents/${documentId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete document');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mover-documents'] });
      toast({
        title: isSpanish ? 'Documento eliminado' : 'Document deleted',
      });
    },
    onError: () => {
      toast({
        title: isSpanish ? 'Error' : 'Error',
        description: isSpanish ? 'No se pudo eliminar el documento' : 'Failed to delete document',
        variant: 'destructive',
      });
    },
  });

  const handleFileSelect = (documentTypeId: string) => {
    setUploadingTypeId(documentTypeId);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && uploadingTypeId) {
      uploadMutation.mutate({ documentTypeId: uploadingTypeId, file });
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getDocumentForType = (typeId: string) => {
    return myDocuments.find(doc => doc.documentTypeId === typeId);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <Badge className="bg-green-100 text-green-700 border-green-200">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            {isSpanish ? 'Aprobado' : 'Approved'}
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-red-100 text-red-700 border-red-200">
            <XCircle className="h-3 w-3 mr-1" />
            {isSpanish ? 'Rechazado' : 'Rejected'}
          </Badge>
        );
      case 'submitted':
        return (
          <Badge className="bg-blue-100 text-blue-700 border-blue-200">
            <Clock className="h-3 w-3 mr-1" />
            {isSpanish ? 'En revisión' : 'Under Review'}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-slate-500">
            <AlertCircle className="h-3 w-3 mr-1" />
            {isSpanish ? 'Pendiente' : 'Pending'}
          </Badge>
        );
    }
  };

  const requiredTypes = documentTypes.filter(t => t.isRequired);
  const approvedCount = requiredTypes.filter(t => {
    const doc = getDocumentForType(t.id);
    return doc?.status === 'approved';
  }).length;
  const progressPercent = requiredTypes.length > 0 ? (approvedCount / requiredTypes.length) * 100 : 0;

  const isLoading = typesLoading || docsLoading;

  if (isLoading) {
    return (
      <DashboardLayout links={sidebarLinks} userType="mover">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--usg-orange)]" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout links={sidebarLinks} userType="mover">
      <div className="flex flex-col gap-4 lg:gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--usg-ink)]">
            {isSpanish ? 'Mis Documentos' : 'My Documents'}
          </h1>
          <p className="text-muted-foreground">
            {isSpanish 
              ? 'Sube los documentos requeridos para verificar tu cuenta de partner' 
              : 'Upload required documents to verify your partner account'}
          </p>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={handleFileChange}
          data-testid="file-input"
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-[var(--usg-orange)]" />
              {isSpanish ? 'Progreso de Verificación' : 'Verification Progress'}
            </CardTitle>
            <CardDescription>
              {isSpanish 
                ? `${approvedCount} de ${requiredTypes.length} documentos requeridos aprobados`
                : `${approvedCount} of ${requiredTypes.length} required documents approved`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={progressPercent} className="h-3" />
            <div className="flex justify-between mt-2 text-sm text-muted-foreground">
              <span>{Math.round(progressPercent)}%</span>
              <span>
                {progressPercent === 100 
                  ? (isSpanish ? 'Documentación completa' : 'Documentation complete')
                  : (isSpanish ? 'Documentos pendientes' : 'Documents pending')}
              </span>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          {documentTypes.map((docType) => {
            const existingDoc = getDocumentForType(docType.id);
            const isUploading = uploadMutation.isPending && uploadingTypeId === docType.id;

            return (
              <Card key={docType.id} className="relative" data-testid={`doc-card-${docType.key}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {isSpanish ? docType.nameEs : docType.nameEn}
                        {docType.isRequired && (
                          <span className="text-red-500 ml-1">*</span>
                        )}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {isSpanish ? docType.descriptionEs : docType.descriptionEn}
                      </CardDescription>
                    </div>
                    {existingDoc && getStatusBadge(existingDoc.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  {existingDoc ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                        <File className="h-5 w-5 text-slate-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{existingDoc.fileName}</p>
                          <p className="text-xs text-muted-foreground">
                            {existingDoc.fileSize 
                              ? `${(existingDoc.fileSize / 1024).toFixed(1)} KB` 
                              : ''}
                            {existingDoc.createdAt && ` - ${new Date(existingDoc.createdAt).toLocaleDateString()}`}
                          </p>
                        </div>
                      </div>

                      {existingDoc.reviewNote && existingDoc.status === 'rejected' && (
                        <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                          <p className="text-sm text-red-700">
                            <strong>{isSpanish ? 'Motivo:' : 'Reason:'}</strong> {existingDoc.reviewNote}
                          </p>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => setPreviewDoc(existingDoc)}
                              data-testid={`view-doc-${docType.key}`}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              {isSpanish ? 'Ver' : 'View'}
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[90vh]">
                            <DialogHeader>
                              <DialogTitle>{existingDoc.fileName}</DialogTitle>
                              <DialogDescription>
                                {isSpanish ? 'Vista previa del documento' : 'Document preview'}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="flex-1 overflow-auto">
                              {existingDoc.fileType?.startsWith('image/') ? (
                                <img 
                                  src={`/api/mover/documents/${existingDoc.id}/file`} 
                                  alt={existingDoc.fileName}
                                  className="max-w-full h-auto"
                                />
                              ) : (
                                <iframe
                                  src={`/api/mover/documents/${existingDoc.id}/file`}
                                  className="w-full h-[70vh]"
                                  title={existingDoc.fileName}
                                />
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>

                        {existingDoc.status !== 'approved' && (
                          <>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleFileSelect(docType.id)}
                              disabled={isUploading}
                              data-testid={`replace-doc-${docType.key}`}
                            >
                              {isUploading ? (
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              ) : (
                                <Upload className="h-4 w-4 mr-1" />
                              )}
                              {isSpanish ? 'Reemplazar' : 'Replace'}
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => deleteMutation.mutate(existingDoc.id)}
                              disabled={deleteMutation.isPending}
                              data-testid={`delete-doc-${docType.key}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg bg-slate-50/50">
                      <Upload className="h-8 w-8 text-slate-400 mb-2" />
                      <p className="text-sm text-muted-foreground mb-3 text-center">
                        {isSpanish 
                          ? 'Arrastra o selecciona un archivo' 
                          : 'Drag or select a file'}
                      </p>
                      <Button 
                        onClick={() => handleFileSelect(docType.id)}
                        disabled={isUploading}
                        data-testid={`upload-doc-${docType.key}`}
                      >
                        {isUploading ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        {isSpanish ? 'Subir documento' : 'Upload document'}
                      </Button>
                      <p className="text-xs text-muted-foreground mt-2">
                        PDF, JPG, PNG (max 10MB)
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {documentTypes.length === 0 && (
          <Card>
            <CardContent className="p-8">
              <div className="flex flex-col items-center justify-center text-slate-400">
                <FileText className="h-12 w-12 mb-2" />
                <p>{isSpanish ? 'No hay tipos de documentos configurados' : 'No document types configured'}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
