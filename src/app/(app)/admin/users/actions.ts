"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { ROLES } from "@/lib/roles";

export type RoleFormState = { error?: string; success?: string };

const setRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(ROLES),
});

// Thrown inside the transaction to abort it with a message for the user.
class RoleChangeError extends Error {}

// Postgres aborted a SERIALIZABLE transaction because it overlapped another one
// (SQLSTATE 40001). Prisma's own engine reports this as P2034, but with the
// @prisma/adapter-pg driver adapter it arrives as a DriverAdapterError whose
// cause.kind is "TransactionWriteConflict", so both forms are checked.
function isSerializationConflict(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2034";
  }
  const cause = (error as { cause?: { kind?: string; originalCode?: string } })?.cause;
  return cause?.kind === "TransactionWriteConflict" || cause?.originalCode === "40001";
}

// Promote or demote a user. Admin only.
//
// Last-admin guard: the app must always keep at least one admin, otherwise
// nobody could create datasets or manage roles again. The count and the update
// run in one SERIALIZABLE transaction, so two admins demoting each other at the
// same moment can't both succeed and leave zero admins: Postgres aborts one of
// them (serialization failure) and that admin is asked to try again. Tested:
// with the default READ COMMITTED level, two overlapping demotions both
// succeeded and left zero admins.
export async function setUserRole(
  _prevState: RoleFormState,
  formData: FormData,
): Promise<RoleFormState> {
  // The real permission check. The Users page is hidden from viewers, but this
  // action is a public endpoint and could be called directly.
  await requireRole("admin");

  const parsed = setRoleSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { error: "Invalid request." };
  const { userId, role } = parsed.data;

  try {
    await db.$transaction(
      async (tx) => {
        const target = await tx.user.findUnique({
          where: { id: userId },
          select: { role: true },
        });
        if (!target) throw new RoleChangeError("User not found.");

        if (target.role === "admin" && role !== "admin") {
          const adminCount = await tx.user.count({ where: { role: "admin" } });
          if (adminCount <= 1) {
            throw new RoleChangeError(
              "Can't remove the last admin. Promote someone else first.",
            );
          }
        }

        await tx.user.update({ where: { id: userId }, data: { role } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (error instanceof RoleChangeError) return { error: error.message };
    if (isSerializationConflict(error)) {
      return { error: "Another role change happened at the same time. Please try again." };
    }
    throw error; // unexpected: let Next.js show its error page
  }

  revalidatePath("/admin/users");
  return { success: "Role updated." };
}
