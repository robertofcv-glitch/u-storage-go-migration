export type PlatformRoleAuditOperation = "created" | "updated" | "deleted";

export function platformRoleAuditRecord(input: {
  operation: PlatformRoleAuditOperation;
  actorId: string | undefined;
  roleId: string;
  slug: string;
  modules?: string[];
}) {
  return {
    userId: input.actorId,
    actorRole: "admin",
    action: `platform_role.${input.operation}`,
    entityType: "platform_role",
    entityId: input.roleId,
    details: {
      slug: input.slug,
      ...(input.modules === undefined ? {} : { modules: input.modules }),
    },
  };
}