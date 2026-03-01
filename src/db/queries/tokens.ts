import { eq, and, isNull, gt } from "drizzle-orm";
import { db } from "../index.js";
import { refreshTokens } from "../schema.js";

export async function saveRefreshToken(tokenData: typeof refreshTokens.$inferInsert) {
  await db.insert(refreshTokens).values(tokenData);
}

export async function getValidRefreshToken(token: string) {
  const [result] = await db
    .select()
    .from(refreshTokens)
    .where(
      and(
        eq(refreshTokens.token, token),
        isNull(refreshTokens.revokedAt),
        gt(refreshTokens.expiresAt, new Date())
      )
    );
  return result;
}

export async function revokeRefreshToken(token: string) {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.token, token));
}
