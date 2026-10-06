export const PLATFORM_ADMIN_ROLES = {
  SUPER_ADMIN: "super_admin",
  OPERATIONS: "operations",
  COMMERCIAL: "commercial",
  ACCOUNTING: "accounting",
  CUSTOMER_SERVICE: "customer_service",
  VENTAS: "ventas",
} as const;

export type PlatformAdminRole = typeof PLATFORM_ADMIN_ROLES[keyof typeof PLATFORM_ADMIN_ROLES];

export const PLATFORM_ADMIN_ROLE_VALUES = Object.values(PLATFORM_ADMIN_ROLES);

export const ADMIN_MODULE_PERMISSIONS = {
  DASHBOARD: "module:dashboard",
  ANALYTICS: "module:analytics",
  QUOTES: "module:quotes",
  RATINGS: "module:ratings",
  ACTIVITY: "module:activity",
  COMMUNICATIONS: "module:communications",
  WHATSAPP: "module:whatsapp",
  AI_AGENT: "module:ai_agent",
  INVENTORY: "module:inventory",
  PRICING: "module:pricing",
  USTORAGE: "module:ustorage",
  PAYMENTS: "module:payments",
  DATABASE: "module:database",
  MARKETING: "module:marketing",
  USERS: "module:users",
  SETTINGS: "module:settings",
  COMPANIES: "module:companies",
  ROLE_MANAGEMENT: "module:role_management",
} as const;
export const PLATFORM_CAPABILITIES = {
  ASSISTED_QUOTES: "capability:quotes:assisted",
} as const;

const ALL_MODULES = Object.values(ADMIN_MODULE_PERMISSIONS);

export const PLATFORM_ROLE_PERMISSIONS: Record<PlatformAdminRole, string[]> = {
  super_admin: ["*"],
  operations: [
    ADMIN_MODULE_PERMISSIONS.DASHBOARD, ADMIN_MODULE_PERMISSIONS.ANALYTICS,
    ADMIN_MODULE_PERMISSIONS.QUOTES, ADMIN_MODULE_PERMISSIONS.RATINGS,
    ADMIN_MODULE_PERMISSIONS.ACTIVITY, ADMIN_MODULE_PERMISSIONS.COMMUNICATIONS,
    ADMIN_MODULE_PERMISSIONS.WHATSAPP, ADMIN_MODULE_PERMISSIONS.AI_AGENT,
    ADMIN_MODULE_PERMISSIONS.INVENTORY, ADMIN_MODULE_PERMISSIONS.USTORAGE,
    ADMIN_MODULE_PERMISSIONS.USERS, ADMIN_MODULE_PERMISSIONS.COMPANIES,
  ],
  commercial: [
    ADMIN_MODULE_PERMISSIONS.DASHBOARD, ADMIN_MODULE_PERMISSIONS.ANALYTICS,
    ADMIN_MODULE_PERMISSIONS.QUOTES, ADMIN_MODULE_PERMISSIONS.RATINGS,
    ADMIN_MODULE_PERMISSIONS.PRICING, ADMIN_MODULE_PERMISSIONS.MARKETING,
    ADMIN_MODULE_PERMISSIONS.COMMUNICATIONS,
  ],
  accounting: [
    ADMIN_MODULE_PERMISSIONS.DASHBOARD, ADMIN_MODULE_PERMISSIONS.ANALYTICS,
    ADMIN_MODULE_PERMISSIONS.QUOTES, ADMIN_MODULE_PERMISSIONS.PRICING,
    ADMIN_MODULE_PERMISSIONS.PAYMENTS,
  ],
  customer_service: [
    ADMIN_MODULE_PERMISSIONS.DASHBOARD, ADMIN_MODULE_PERMISSIONS.QUOTES,
    ADMIN_MODULE_PERMISSIONS.RATINGS, ADMIN_MODULE_PERMISSIONS.COMMUNICATIONS,
    ADMIN_MODULE_PERMISSIONS.WHATSAPP, ADMIN_MODULE_PERMISSIONS.USERS,
  ],
  ventas: [
    ADMIN_MODULE_PERMISSIONS.QUOTES,
    PLATFORM_CAPABILITIES.ASSISTED_QUOTES,
  ],
};

export function permissionsForPlatformRoles(roles: string[]): string[] {
  if (roles.includes(PLATFORM_ADMIN_ROLES.SUPER_ADMIN)) return ["*"];
  return Array.from(new Set(roles.flatMap((role) =>
    PLATFORM_ADMIN_ROLE_VALUES.includes(role as PlatformAdminRole)
      ? PLATFORM_ROLE_PERMISSIONS[role as PlatformAdminRole]
      : []
  )));
}

export function hasPlatformPermission(permissions: string[], permission: string) {
  return permissions.includes("*") || permissions.includes(permission);
}

export const PLATFORM_ADMIN_ALL_MODULES = ALL_MODULES;

export const PLATFORM_ADMIN_PROTECTED_MODULES = [
  ADMIN_MODULE_PERMISSIONS.DATABASE,
  ADMIN_MODULE_PERMISSIONS.SETTINGS,
  ADMIN_MODULE_PERMISSIONS.ROLE_MANAGEMENT,
] as const;

export type PlatformRoleModuleValidation =
  | { valid: true; modules: string[] }
  | { valid: false; message: string };

export function validatePlatformRoleModules(
  value: unknown,
  options: { superAdmin?: boolean } = {},
): PlatformRoleModuleValidation {
  if (!Array.isArray(value) || value.some((module) => typeof module !== "string")) {
    return { valid: false, message: "Modules must be an array of recognized module keys" };
  }
  const modules = Array.from(new Set(value));
  if (options.superAdmin) {
    return modules.length === 1 && modules[0] === "*"
      ? { valid: true, modules }
      : { valid: false, message: "Super admin must retain unrestricted access" };
  }
  if (modules.includes("*")) {
    return { valid: false, message: "Unrestricted access is reserved for Super Admin" };
  }
  if (modules.includes(ADMIN_MODULE_PERMISSIONS.ROLE_MANAGEMENT)) {
    return { valid: false, message: "Role management access is reserved for Super Admin" };
  }
  if (modules.some((module) => !ALL_MODULES.includes(module as typeof ALL_MODULES[number]))) {
    return { valid: false, message: "Invalid module selection" };
  }
  return { valid: true, modules };
}