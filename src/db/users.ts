import { eq, and } from 'drizzle-orm';
import { db } from '@/db/index';
import { users, userIdentities } from '@/db/schema';
import { SessionUser } from '@/types';

type IdentityRow = typeof userIdentities.$inferSelect;

function rowToSessionUser(row: IdentityRow): SessionUser {
  return {
    userId: row.userId,
    refType: row.refType,
    refId: row.refId,
    accessToken: row.accessToken,
    refreshToken: row.refreshToken,
    tokenExpiresAt: row.tokenExpiresAt,
  };
}

export async function upsertIdentity(user: SessionUser): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.insert(users)
      .values({ id: user.userId })
      .onConflictDoUpdate({ target: users.id, set: { updatedAt: new Date() } });

    await tx.insert(userIdentities)
      .values({
        userId: user.userId,
        refType: user.refType,
        refId: user.refId,
        accessToken: user.accessToken,
        refreshToken: user.refreshToken,
        tokenExpiresAt: user.tokenExpiresAt,
      })
      .onConflictDoUpdate({
        target: [userIdentities.refType, userIdentities.refId],
        set: {
          accessToken: user.accessToken,
          refreshToken: user.refreshToken,
          tokenExpiresAt: user.tokenExpiresAt,
          updatedAt: new Date(),
        },
      });
  });
}

export async function getUserByRef(refType: string, refId: string): Promise<SessionUser | null> {
  const [row] = await db.select().from(userIdentities)
    .where(and(eq(userIdentities.refType, refType), eq(userIdentities.refId, refId)))
    .limit(1);
  return row ? rowToSessionUser(row) : null;
}

export async function getUserByIdAndRefType(userId: string, refType: string): Promise<SessionUser | null> {
  const [row] = await db.select().from(userIdentities)
    .where(and(eq(userIdentities.userId, userId), eq(userIdentities.refType, refType)))
    .limit(1);
  return row ? rowToSessionUser(row) : null;
}

export async function updateTokens(
  refType: string,
  refId: string,
  accessToken: string,
  refreshToken: string,
  tokenExpiresAt: number,
): Promise<void> {
  await db.update(userIdentities)
    .set({ accessToken, refreshToken, tokenExpiresAt, updatedAt: new Date() })
    .where(and(eq(userIdentities.refType, refType), eq(userIdentities.refId, refId)));
}
