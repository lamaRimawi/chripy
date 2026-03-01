import { eq } from "drizzle-orm";
import { db } from "../index.js";
import { users } from "../schema.js";

export async function createUser(user: typeof users.$inferInsert) {
  const [result] = await db.insert(users).values(user).onConflictDoNothing().returning();
  return result;
}

export async function getUserByEmail(email: string) {
  const [result] = await db.select().from(users).where(eq(users.email, email));
  return result;
}
// الوظيفة المفقودة التي يطلبها السيرفر
export async function updateUser(id: string, data: { email?: string; hashedPassword?: string }) {
  const [result] = await db
    .update(users)
    .set(data)
    .where(eq(users.id, id))
    .returning();
  return result;
}
export async function upgradeUserToRed(id: string) {
  // نستخدم try/catch هنا للتعامل مع أي ID غير صالح (ليس UUID)
  try {
    const [result] = await db
      .update(users)
      .set({ isChirpyRed: true })
      .where(eq(users.id, id))
      .returning();
    return result;
  } catch (err) {
    return null;
  }
}

export async function deleteAllUsers() {
  await db.delete(users);
}
