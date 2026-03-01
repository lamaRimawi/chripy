import { asc,eq ,and} from "drizzle-orm";
import { db  } from "../index.js";
import { NewChirp, chirps } from "../schema.js";

export async function createChirp(chirp: NewChirp) {
  const [result] = await db
    .insert(chirps)
    .values(chirp)
    .returning();
  return result;
}

export async function getAllChirps(authorId?: string) {
  let query = db.select().from(chirps);

  // إذا تم توفير معرّف الكاتب، قم بالفلترة في قاعدة البيانات
  if (authorId) {
    return await query
      .where(eq(chirps.userId, authorId))
      .orderBy(asc(chirps.createdAt));
  }

  // إذا لم يتم توفير معرّف الكاتب، ارجع كل التغريدات
  return await query.orderBy(asc(chirps.createdAt));
}
export async function getChirpById(id: string) {
  const [result] = await db
    .select()
    .from(chirps)
    .where(eq(chirps.id, id));
  return result;
}
// إضافة وظيفة الحذف
export async function deleteChirp(id: string) {
  await db.delete(chirps).where(eq(chirps.id, id));
}
