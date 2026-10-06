import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import { activityLogs, adminPermissions, platformRoles, userRoles, users } from "@shared/schema";

export async function assignPlatformAdminRole(input: {
  targetUserId: string;
  newRole: string;
  actorId: string;
}) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select id from ${users} where ${users.id} = ${input.targetUserId} for update`);

    const assignedDefinitions = await tx.select({ role: userRoles.role })
      .from(userRoles)
      .innerJoin(platformRoles, eq(userRoles.role, platformRoles.slug))
      .where(and(eq(userRoles.userId, input.targetUserId), eq(userRoles.isActive, true)));
    const [legacyPermissions] = await tx.select()
      .from(adminPermissions)
      .where(eq(adminPermissions.userId, input.targetUserId));
    const previousRoles = assignedDefinitions.map(({ role }) => role);
    if (legacyPermissions?.isSuperAdmin && !previousRoles.includes("super_admin")) {
      previousRoles.push("super_admin");
    }

    const persistedPreviousRoles = assignedDefinitions.map(({ role }) => role);
    if (persistedPreviousRoles.length) {
      await tx.update(userRoles)
        .set({ isActive: false })
        .where(and(
          eq(userRoles.userId, input.targetUserId),
          inArray(userRoles.role, persistedPreviousRoles),
          eq(userRoles.isActive, true),
        ));
    }

    for (const assignedRole of ["admin", input.newRole]) {
      const [existingRole] = await tx.select()
        .from(userRoles)
        .where(and(eq(userRoles.userId, input.targetUserId), eq(userRoles.role, assignedRole)));
      if (existingRole) {
        await tx.update(userRoles)
          .set({ isActive: true, grantedBy: input.actorId, grantedAt: new Date() })
          .where(eq(userRoles.id, existingRole.id));
      } else {
        await tx.insert(userRoles).values({
          userId: input.targetUserId,
          role: assignedRole,
          grantedBy: input.actorId,
        });
      }
    }

    await tx.insert(adminPermissions).values({
      userId: input.targetUserId,
      isSuperAdmin: input.newRole === "super_admin",
      updatedBy: input.actorId,
    }).onConflictDoUpdate({
      target: adminPermissions.userId,
      set: {
        isSuperAdmin: input.newRole === "super_admin",
        updatedBy: input.actorId,
        updatedAt: new Date(),
      },
    });
    await tx.update(users)
      .set({ userType: "admin", updatedAt: new Date() })
      .where(eq(users.id, input.targetUserId));
    await tx.insert(activityLogs).values({
      userId: input.actorId,
      actorRole: "admin",
      action: "admin.platform_role.updated",
      entityType: "user",
      entityId: input.targetUserId,
      details: {
        targetUserId: input.targetUserId,
        previousRoles,
        previousRole: previousRoles[0] || null,
        newRole: input.newRole,
      },
    });

    return { previousRoles };
  });
}