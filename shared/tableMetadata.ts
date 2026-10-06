export interface RelationshipMetadata {
  column: string;
  targetTable: string;
  targetColumn: string;
  displayColumn: string;
  type: 'many-to-one' | 'one-to-many';
}

export interface ColumnMetadata {
  name: string;
  type: 'text' | 'number' | 'boolean' | 'date' | 'json' | 'array' | 'multiselect';
  label: { en: string; es: string };
  editable: boolean;
  required: boolean;
  hidden?: boolean;
  relation?: RelationshipMetadata;
  options?: { value: string; label: { en: string; es: string } }[];
  virtual?: boolean;
}

export const ROLE_OPTIONS = [
  { value: 'client', label: { en: 'Client', es: 'Cliente' } },
  { value: 'mover', label: { en: 'Mover/Partner', es: 'Mudador/Socio' } },
  { value: 'admin', label: { en: 'Administrator', es: 'Administrador' } },
];

export interface TableMetadata {
  name: string;
  displayName: { en: string; es: string };
  description: { en: string; es: string };
  category: 'users' | 'quotes' | 'services' | 'config' | 'logs';
  primaryKey: string;
  permissions: {
    read: boolean;
    create: boolean;
    update: boolean;
    delete: boolean;
  };
  columns: ColumnMetadata[];
}

export const tableMetadataConfig: Record<string, TableMetadata> = {
  users: {
    name: 'users',
    displayName: { en: 'Users', es: 'Usuarios' },
    description: { en: 'Platform users (clients, movers, admins)', es: 'Usuarios de la plataforma (clientes, mudadores, admins)' },
    category: 'users',
    primaryKey: 'id',
    permissions: { read: true, create: true, update: true, delete: false },
    columns: [
      { name: 'id', type: 'text', label: { en: 'ID', es: 'ID' }, editable: false, required: true },
      { name: 'email', type: 'text', label: { en: 'Email', es: 'Correo' }, editable: true, required: false },
      { name: 'fullName', type: 'text', label: { en: 'Full Name', es: 'Nombre Completo' }, editable: true, required: false },
      { name: 'firstName', type: 'text', label: { en: 'First Name', es: 'Nombre' }, editable: true, required: false },
      { name: 'lastName', type: 'text', label: { en: 'Last Name', es: 'Apellido' }, editable: true, required: false },
      { name: 'phone', type: 'text', label: { en: 'Phone', es: 'Teléfono' }, editable: true, required: false },
      { name: 'roles', type: 'multiselect', label: { en: 'Roles', es: 'Roles' }, editable: true, required: false, virtual: true, options: ROLE_OPTIONS },
      { name: 'userType', type: 'text', label: { en: 'Primary Type', es: 'Tipo Principal' }, editable: false, required: false },
      { name: 'preferredLanguage', type: 'text', label: { en: 'Language', es: 'Idioma' }, editable: true, required: false },
      { name: 'isActive', type: 'boolean', label: { en: 'Active', es: 'Activo' }, editable: true, required: false },
      { name: 'password', type: 'text', label: { en: 'Password', es: 'Contraseña' }, editable: false, required: false, hidden: true },
      { name: 'createdAt', type: 'date', label: { en: 'Created', es: 'Creado' }, editable: false, required: false },
      { name: 'lastLoginAt', type: 'date', label: { en: 'Last Login', es: 'Último Inicio' }, editable: false, required: false },
    ],
  },
  user_roles: {
    name: 'user_roles',
    displayName: { en: 'User Roles', es: 'Roles de Usuario' },
    description: { en: 'User role assignments', es: 'Asignaciones de roles de usuario' },
    category: 'users',
    primaryKey: 'id',
    permissions: { read: true, create: true, update: true, delete: true },
    columns: [
      { name: 'id', type: 'text', label: { en: 'ID', es: 'ID' }, editable: false, required: true },
      { name: 'userId', type: 'text', label: { en: 'User', es: 'Usuario' }, editable: true, required: true, relation: { column: 'userId', targetTable: 'users', targetColumn: 'id', displayColumn: 'fullName', type: 'many-to-one' } },
      { name: 'role', type: 'text', label: { en: 'Role', es: 'Rol' }, editable: true, required: true },
      { name: 'grantedBy', type: 'text', label: { en: 'Granted By', es: 'Otorgado Por' }, editable: false, required: false, relation: { column: 'grantedBy', targetTable: 'users', targetColumn: 'id', displayColumn: 'fullName', type: 'many-to-one' } },
      { name: 'isActive', type: 'boolean', label: { en: 'Active', es: 'Activo' }, editable: true, required: false },
      { name: 'grantedAt', type: 'date', label: { en: 'Granted At', es: 'Otorgado En' }, editable: false, required: false },
    ],
  },
  mover_profiles: {
    name: 'mover_profiles',
    displayName: { en: 'Mover Profiles', es: 'Perfiles de Mudadores' },
    description: { en: 'Moving company profiles', es: 'Perfiles de empresas de mudanzas' },
    category: 'users',
    primaryKey: 'id',
    permissions: { read: true, create: true, update: true, delete: false },
    columns: [
      { name: 'id', type: 'text', label: { en: 'ID', es: 'ID' }, editable: false, required: true },
      { name: 'userId', type: 'text', label: { en: 'User', es: 'Usuario' }, editable: true, required: true, relation: { column: 'userId', targetTable: 'users', targetColumn: 'id', displayColumn: 'fullName', type: 'many-to-one' } },
      { name: 'companyName', type: 'text', label: { en: 'Company Name', es: 'Nombre Empresa' }, editable: true, required: true },
      { name: 'businessEmail', type: 'text', label: { en: 'Business Email', es: 'Email Comercial' }, editable: true, required: false },
      { name: 'contactPhone', type: 'text', label: { en: 'Phone', es: 'Teléfono' }, editable: true, required: false },
      { name: 'description', type: 'text', label: { en: 'Description', es: 'Descripción' }, editable: true, required: false },
      { name: 'verified', type: 'boolean', label: { en: 'Verified', es: 'Verificado' }, editable: true, required: false },
      { name: 'rating', type: 'number', label: { en: 'Rating', es: 'Calificación' }, editable: true, required: false },
      { name: 'totalJobs', type: 'number', label: { en: 'Total Jobs', es: 'Trabajos Totales' }, editable: true, required: false },
      { name: 'fleetSize', type: 'number', label: { en: 'Fleet Size', es: 'Tamaño Flota' }, editable: true, required: false },
      { name: 'yearsInBusiness', type: 'number', label: { en: 'Years in Business', es: 'Años en Negocio' }, editable: true, required: false },
      { name: 'serviceAreas', type: 'array', label: { en: 'Service Areas', es: 'Áreas de Servicio' }, editable: true, required: false },
      { name: 'createdAt', type: 'date', label: { en: 'Created', es: 'Creado' }, editable: false, required: false },
    ],
  },
  quotes: {
    name: 'quotes',
    displayName: { en: 'Quotes', es: 'Cotizaciones' },
    description: { en: 'Moving quote requests', es: 'Solicitudes de cotización de mudanza' },
    category: 'quotes',
    primaryKey: 'id',
    // Quote writes must go through the eligibility-aware quote APIs.
    permissions: { read: true, create: false, update: false, delete: false },
    columns: [
      { name: 'id', type: 'text', label: { en: 'ID', es: 'ID' }, editable: false, required: true },
      { name: 'quoteNumber', type: 'text', label: { en: 'Quote #', es: 'Cotización #' }, editable: false, required: false },
      { name: 'userId', type: 'text', label: { en: 'Client', es: 'Cliente' }, editable: true, required: false, relation: { column: 'userId', targetTable: 'users', targetColumn: 'id', displayColumn: 'fullName', type: 'many-to-one' } },
      { name: 'fromAddress', type: 'text', label: { en: 'From', es: 'Origen' }, editable: true, required: true },
      { name: 'toAddress', type: 'text', label: { en: 'To', es: 'Destino' }, editable: true, required: true },
      { name: 'moveDate', type: 'date', label: { en: 'Move Date', es: 'Fecha Mudanza' }, editable: true, required: false },
      { name: 'homeSize', type: 'text', label: { en: 'Home Size', es: 'Tamaño Casa' }, editable: true, required: true },
      { name: 'workflowStatus', type: 'text', label: { en: 'Status', es: 'Estado' }, editable: true, required: false },
      { name: 'estimatedCost', type: 'number', label: { en: 'Estimated Cost', es: 'Costo Estimado' }, editable: true, required: false },
      { name: 'suggestedPrice', type: 'number', label: { en: 'Suggested Price', es: 'Precio Sugerido' }, editable: true, required: false },
      { name: 'finalPrice', type: 'number', label: { en: 'Final Price', es: 'Precio Final' }, editable: true, required: false },
      { name: 'adminNotes', type: 'text', label: { en: 'Admin Notes', es: 'Notas Admin' }, editable: true, required: false },
      { name: 'createdAt', type: 'date', label: { en: 'Created', es: 'Creado' }, editable: false, required: false },
    ],
  },
  quote_invitations: {
    name: 'quote_invitations',
    displayName: { en: 'Quote Invitations', es: 'Invitaciones de Cotización' },
    description: { en: 'Invitations sent to movers for quotes', es: 'Invitaciones enviadas a mudadores' },
    category: 'quotes',
    primaryKey: 'id',
    permissions: { read: true, create: true, update: true, delete: true },
    columns: [
      { name: 'id', type: 'text', label: { en: 'ID', es: 'ID' }, editable: false, required: true },
      { name: 'quoteId', type: 'text', label: { en: 'Quote', es: 'Cotización' }, editable: true, required: true, relation: { column: 'quoteId', targetTable: 'quotes', targetColumn: 'id', displayColumn: 'quoteNumber', type: 'many-to-one' } },
      { name: 'moverProfileId', type: 'text', label: { en: 'Mover', es: 'Mudador' }, editable: true, required: true, relation: { column: 'moverProfileId', targetTable: 'mover_profiles', targetColumn: 'id', displayColumn: 'companyName', type: 'many-to-one' } },
      { name: 'status', type: 'text', label: { en: 'Status', es: 'Estado' }, editable: true, required: false },
      { name: 'message', type: 'text', label: { en: 'Message', es: 'Mensaje' }, editable: true, required: false },
      { name: 'createdAt', type: 'date', label: { en: 'Created', es: 'Creado' }, editable: false, required: false },
    ],
  },
  quote_bids: {
    name: 'quote_bids',
    displayName: { en: 'Quote Bids', es: 'Ofertas de Cotización' },
    description: { en: 'Bids submitted by movers', es: 'Ofertas enviadas por mudadores' },
    category: 'quotes',
    primaryKey: 'id',
    permissions: { read: true, create: true, update: true, delete: true },
    columns: [
      { name: 'id', type: 'text', label: { en: 'ID', es: 'ID' }, editable: false, required: true },
      { name: 'invitationId', type: 'text', label: { en: 'Invitation', es: 'Invitación' }, editable: true, required: true, relation: { column: 'invitationId', targetTable: 'quote_invitations', targetColumn: 'id', displayColumn: 'id', type: 'many-to-one' } },
      { name: 'quoteId', type: 'text', label: { en: 'Quote', es: 'Cotización' }, editable: true, required: true, relation: { column: 'quoteId', targetTable: 'quotes', targetColumn: 'id', displayColumn: 'quoteNumber', type: 'many-to-one' } },
      { name: 'moverProfileId', type: 'text', label: { en: 'Mover', es: 'Mudador' }, editable: true, required: true, relation: { column: 'moverProfileId', targetTable: 'mover_profiles', targetColumn: 'id', displayColumn: 'companyName', type: 'many-to-one' } },
      { name: 'amount', type: 'number', label: { en: 'Amount', es: 'Monto' }, editable: true, required: true },
      { name: 'currency', type: 'text', label: { en: 'Currency', es: 'Moneda' }, editable: true, required: false },
      { name: 'status', type: 'text', label: { en: 'Status', es: 'Estado' }, editable: true, required: false },
      { name: 'notes', type: 'text', label: { en: 'Notes', es: 'Notas' }, editable: true, required: false },
      { name: 'createdAt', type: 'date', label: { en: 'Created', es: 'Creado' }, editable: false, required: false },
    ],
  },
  inventory_items: {
    name: 'inventory_items',
    displayName: { en: 'Inventory Items', es: 'Artículos de Inventario' },
    description: { en: 'Items for moving quotes', es: 'Artículos para cotizaciones de mudanza' },
    category: 'quotes',
    primaryKey: 'id',
    permissions: { read: true, create: true, update: true, delete: true },
    columns: [
      { name: 'id', type: 'text', label: { en: 'ID', es: 'ID' }, editable: false, required: true },
      { name: 'quoteId', type: 'text', label: { en: 'Quote', es: 'Cotización' }, editable: true, required: true, relation: { column: 'quoteId', targetTable: 'quotes', targetColumn: 'id', displayColumn: 'quoteNumber', type: 'many-to-one' } },
      { name: 'itemName', type: 'text', label: { en: 'Item Name', es: 'Nombre Artículo' }, editable: true, required: true },
      { name: 'room', type: 'text', label: { en: 'Room', es: 'Habitación' }, editable: true, required: false },
      { name: 'category', type: 'text', label: { en: 'Category', es: 'Categoría' }, editable: true, required: false },
      { name: 'quantity', type: 'number', label: { en: 'Quantity', es: 'Cantidad' }, editable: true, required: false },
      { name: 'notes', type: 'text', label: { en: 'Notes', es: 'Notas' }, editable: true, required: false },
    ],
  },
  services: {
    name: 'services',
    displayName: { en: 'Services', es: 'Servicios' },
    description: { en: 'Available moving services', es: 'Servicios de mudanza disponibles' },
    category: 'services',
    primaryKey: 'id',
    permissions: { read: true, create: true, update: true, delete: true },
    columns: [
      { name: 'id', type: 'text', label: { en: 'ID', es: 'ID' }, editable: false, required: true },
      { name: 'name', type: 'text', label: { en: 'Name (EN)', es: 'Nombre (EN)' }, editable: true, required: true },
      { name: 'nameEs', type: 'text', label: { en: 'Name (ES)', es: 'Nombre (ES)' }, editable: true, required: false },
      { name: 'description', type: 'text', label: { en: 'Description (EN)', es: 'Descripción (EN)' }, editable: true, required: true },
      { name: 'descriptionEs', type: 'text', label: { en: 'Description (ES)', es: 'Descripción (ES)' }, editable: true, required: false },
      { name: 'basePrice', type: 'number', label: { en: 'Base Price', es: 'Precio Base' }, editable: true, required: false },
      { name: 'active', type: 'boolean', label: { en: 'Active', es: 'Activo' }, editable: true, required: false },
      { name: 'createdAt', type: 'date', label: { en: 'Created', es: 'Creado' }, editable: false, required: false },
    ],
  },
  add_ons: {
    name: 'add_ons',
    displayName: { en: 'Add-ons', es: 'Complementos' },
    description: { en: 'Additional service options', es: 'Opciones de servicio adicionales' },
    category: 'services',
    primaryKey: 'id',
    permissions: { read: true, create: true, update: true, delete: true },
    columns: [
      { name: 'id', type: 'text', label: { en: 'ID', es: 'ID' }, editable: false, required: true },
      { name: 'name', type: 'text', label: { en: 'Name (EN)', es: 'Nombre (EN)' }, editable: true, required: true },
      { name: 'nameEs', type: 'text', label: { en: 'Name (ES)', es: 'Nombre (ES)' }, editable: true, required: false },
      { name: 'description', type: 'text', label: { en: 'Description (EN)', es: 'Descripción (EN)' }, editable: true, required: true },
      { name: 'descriptionEs', type: 'text', label: { en: 'Description (ES)', es: 'Descripción (ES)' }, editable: true, required: false },
      { name: 'price', type: 'number', label: { en: 'Price', es: 'Precio' }, editable: true, required: false },
      { name: 'active', type: 'boolean', label: { en: 'Active', es: 'Activo' }, editable: true, required: false },
      { name: 'createdAt', type: 'date', label: { en: 'Created', es: 'Creado' }, editable: false, required: false },
    ],
  },
  saved_addresses: {
    name: 'saved_addresses',
    displayName: { en: 'Saved Addresses', es: 'Direcciones Guardadas' },
    description: { en: 'User saved addresses', es: 'Direcciones guardadas de usuarios' },
    category: 'users',
    primaryKey: 'id',
    permissions: { read: true, create: true, update: true, delete: true },
    columns: [
      { name: 'id', type: 'text', label: { en: 'ID', es: 'ID' }, editable: false, required: true },
      { name: 'userId', type: 'text', label: { en: 'User', es: 'Usuario' }, editable: true, required: true, relation: { column: 'userId', targetTable: 'users', targetColumn: 'id', displayColumn: 'fullName', type: 'many-to-one' } },
      { name: 'label', type: 'text', label: { en: 'Label', es: 'Etiqueta' }, editable: true, required: true },
      { name: 'fullAddress', type: 'text', label: { en: 'Address', es: 'Dirección' }, editable: true, required: true },
      { name: 'city', type: 'text', label: { en: 'City', es: 'Ciudad' }, editable: true, required: false },
      { name: 'state', type: 'text', label: { en: 'State', es: 'Estado' }, editable: true, required: false },
      { name: 'zipCode', type: 'text', label: { en: 'Zip Code', es: 'Código Postal' }, editable: true, required: false },
      { name: 'country', type: 'text', label: { en: 'Country', es: 'País' }, editable: true, required: false },
      { name: 'createdAt', type: 'date', label: { en: 'Created', es: 'Creado' }, editable: false, required: false },
    ],
  },
  activity_logs: {
    name: 'activity_logs',
    displayName: { en: 'Activity Logs', es: 'Registros de Actividad' },
    description: { en: 'Platform activity audit trail', es: 'Historial de actividad de la plataforma' },
    category: 'logs',
    primaryKey: 'id',
    permissions: { read: true, create: false, update: false, delete: false },
    columns: [
      { name: 'id', type: 'text', label: { en: 'ID', es: 'ID' }, editable: false, required: true },
      { name: 'userId', type: 'text', label: { en: 'User', es: 'Usuario' }, editable: false, required: false, relation: { column: 'userId', targetTable: 'users', targetColumn: 'id', displayColumn: 'fullName', type: 'many-to-one' } },
      { name: 'actorRole', type: 'text', label: { en: 'Actor Role', es: 'Rol Actor' }, editable: false, required: false },
      { name: 'action', type: 'text', label: { en: 'Action', es: 'Acción' }, editable: false, required: true },
      { name: 'entityType', type: 'text', label: { en: 'Entity Type', es: 'Tipo Entidad' }, editable: false, required: false },
      { name: 'entityId', type: 'text', label: { en: 'Entity ID', es: 'ID Entidad' }, editable: false, required: false },
      { name: 'details', type: 'json', label: { en: 'Details', es: 'Detalles' }, editable: false, required: false },
      { name: 'createdAt', type: 'date', label: { en: 'Created', es: 'Creado' }, editable: false, required: false },
    ],
  },
  email_logs: {
    name: 'email_logs',
    displayName: { en: 'Email Logs', es: 'Registros de Email' },
    description: { en: 'Email delivery tracking', es: 'Seguimiento de envío de emails' },
    category: 'logs',
    primaryKey: 'id',
    permissions: { read: true, create: false, update: false, delete: false },
    columns: [
      { name: 'id', type: 'text', label: { en: 'ID', es: 'ID' }, editable: false, required: true },
      { name: 'templateKey', type: 'text', label: { en: 'Template', es: 'Plantilla' }, editable: false, required: false },
      { name: 'recipientEmail', type: 'text', label: { en: 'Recipient', es: 'Destinatario' }, editable: false, required: true },
      { name: 'subject', type: 'text', label: { en: 'Subject', es: 'Asunto' }, editable: false, required: true },
      { name: 'category', type: 'text', label: { en: 'Category', es: 'Categoría' }, editable: false, required: true },
      { name: 'status', type: 'text', label: { en: 'Status', es: 'Estado' }, editable: false, required: true },
      { name: 'errorMessage', type: 'text', label: { en: 'Error', es: 'Error' }, editable: false, required: false },
      { name: 'sentAt', type: 'date', label: { en: 'Sent At', es: 'Enviado' }, editable: false, required: false },
      { name: 'createdAt', type: 'date', label: { en: 'Created', es: 'Creado' }, editable: false, required: false },
    ],
  },
  email_config: {
    name: 'email_config',
    displayName: { en: 'Email Config', es: 'Config. Email' },
    description: { en: 'Email provider configuration', es: 'Configuración del proveedor de email' },
    category: 'config',
    primaryKey: 'id',
    permissions: { read: true, create: true, update: true, delete: false },
    columns: [
      { name: 'id', type: 'text', label: { en: 'ID', es: 'ID' }, editable: false, required: true },
      { name: 'provider', type: 'text', label: { en: 'Provider', es: 'Proveedor' }, editable: true, required: false },
      { name: 'isConfigured', type: 'boolean', label: { en: 'Configured', es: 'Configurado' }, editable: true, required: false },
      { name: 'senderName', type: 'text', label: { en: 'Sender Name', es: 'Nombre Remitente' }, editable: true, required: false },
      { name: 'senderEmail', type: 'text', label: { en: 'Sender Email', es: 'Email Remitente' }, editable: true, required: false },
      { name: 'functionalEmailsEnabled', type: 'boolean', label: { en: 'Functional Emails', es: 'Emails Funcionales' }, editable: true, required: false },
      { name: 'transactionalEmailsEnabled', type: 'boolean', label: { en: 'Transactional', es: 'Transaccionales' }, editable: true, required: false },
      { name: 'marketingEmailsEnabled', type: 'boolean', label: { en: 'Marketing', es: 'Marketing' }, editable: true, required: false },
      { name: 'updatedAt', type: 'date', label: { en: 'Updated', es: 'Actualizado' }, editable: false, required: false },
    ],
  },
  website_config: {
    name: 'website_config',
    displayName: { en: 'Website Config', es: 'Config. Sitio' },
    description: { en: 'Website settings and branding', es: 'Configuración del sitio y marca' },
    category: 'config',
    primaryKey: 'id',
    permissions: { read: true, create: true, update: true, delete: false },
    columns: [
      { name: 'id', type: 'text', label: { en: 'ID', es: 'ID' }, editable: false, required: true },
      { name: 'siteName', type: 'text', label: { en: 'Site Name', es: 'Nombre Sitio' }, editable: true, required: false },
      { name: 'domain', type: 'text', label: { en: 'Domain', es: 'Dominio' }, editable: true, required: false },
      { name: 'primaryColor', type: 'text', label: { en: 'Primary Color', es: 'Color Primario' }, editable: true, required: false },
      { name: 'secondaryColor', type: 'text', label: { en: 'Secondary Color', es: 'Color Secundario' }, editable: true, required: false },
      { name: 'accentColor', type: 'text', label: { en: 'Accent Color', es: 'Color Acento' }, editable: true, required: false },
      { name: 'contactEmail', type: 'text', label: { en: 'Contact Email', es: 'Email Contacto' }, editable: true, required: false },
      { name: 'contactPhone', type: 'text', label: { en: 'Contact Phone', es: 'Teléfono Contacto' }, editable: true, required: false },
      { name: 'maintenanceMode', type: 'boolean', label: { en: 'Maintenance', es: 'Mantenimiento' }, editable: true, required: false },
      { name: 'updatedAt', type: 'date', label: { en: 'Updated', es: 'Actualizado' }, editable: false, required: false },
    ],
  },
  ai_agent_config: {
    name: 'ai_agent_config',
    displayName: { en: 'AI Agent Config', es: 'Config. Agente IA' },
    description: { en: 'Clara AI assistant settings', es: 'Configuración de la asistente Clara' },
    category: 'config',
    primaryKey: 'id',
    permissions: { read: true, create: true, update: true, delete: false },
    columns: [
      { name: 'id', type: 'text', label: { en: 'ID', es: 'ID' }, editable: false, required: true },
      { name: 'name', type: 'text', label: { en: 'Name', es: 'Nombre' }, editable: true, required: true },
      { name: 'greeting', type: 'text', label: { en: 'Greeting (EN)', es: 'Saludo (EN)' }, editable: true, required: true },
      { name: 'greetingEs', type: 'text', label: { en: 'Greeting (ES)', es: 'Saludo (ES)' }, editable: true, required: true },
      { name: 'systemPrompt', type: 'text', label: { en: 'System Prompt', es: 'Prompt Sistema' }, editable: true, required: true },
      { name: 'model', type: 'text', label: { en: 'Model', es: 'Modelo' }, editable: true, required: false },
      { name: 'temperature', type: 'number', label: { en: 'Temperature', es: 'Temperatura' }, editable: true, required: false },
      { name: 'active', type: 'boolean', label: { en: 'Active', es: 'Activo' }, editable: true, required: false },
      { name: 'updatedAt', type: 'date', label: { en: 'Updated', es: 'Actualizado' }, editable: false, required: false },
    ],
  },
};

// Dispatch tables are intentionally registered here so the admin database
// browser can inspect them without exposing legacy bidding internals.
for (const [name, displayName] of [
  ['partner_vehicles', 'Partner Vehicles'],
  ['vehicle_availability_windows', 'Vehicle Availability Windows'],
  ['dispatch_assignments', 'Dispatch Assignments'],
  ['assignment_vehicles', 'Assignment Vehicles'],
  ['assignment_reservations', 'Assignment Reservations'],
] as const) {
  tableMetadataConfig[name] = {
    name, displayName: { en: displayName, es: displayName }, description: { en: displayName, es: displayName },
    category: 'config', primaryKey: 'id',
    permissions: { read: true, create: true, update: true, delete: false },
    columns: [{ name: 'id', type: 'text', label: { en: 'ID', es: 'ID' }, editable: false, required: true }],
  };
}

export const getAccessibleTables = (): string[] => {
  return Object.keys(tableMetadataConfig);
};

export const getTableMetadata = (tableName: string): TableMetadata | undefined => {
  return tableMetadataConfig[tableName];
};

export const getTablesByCategory = (category: string): TableMetadata[] => {
  return Object.values(tableMetadataConfig).filter(t => t.category === category);
};
