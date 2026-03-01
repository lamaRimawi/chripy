import { getAPIKey } from "./auth.js";
import { upgradeUserToRed } from "./db/queries/users.js";
import { updateUser } from "./db/queries/users.js";
import { makeJWT, validateJWT } from "./auth.js";
import express, { Request, Response, NextFunction } from "express";
import postgres from "postgres";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import { config } from "./config.js";
import { createChirp, getAllChirps, getChirpById,deleteChirp } from "./db/queries/chirps.js";
import { hashPassword, checkPasswordHash,getBearerToken } from "./auth.js";
import { createUser, deleteAllUsers, getUserByEmail } from "./db/queries/users.js";
import { makeRefreshToken } from "./auth.js";
import { saveRefreshToken, getValidRefreshToken, revokeRefreshToken } from "./db/queries/tokens.js";
// --- 1. التهجير التلقائي لقاعدة البيانات ---
try {
  const migrationClient = postgres(config.db.url, { max: 1 });
  await migrate(drizzle(migrationClient), config.db.migrationConfig);
  await migrationClient.end();
  console.log("Database migrations completed successfully.");
} catch (err) {
  console.error("Database migration failed:", err);
  process.exit(1);
}

// أضف فئة خطأ جديدة للتوثيق
class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnauthorizedError";
  }
}


// --- 2. تعريف فئات الأخطاء المخصصة ---
class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadRequestError";
  }
}

class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}
// أضف فئة خطأ جديدة للمنع (Forbidden)
class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

const app = express();
const PORT = 8080;

// --- 3. الـ Middleware الأساسي ---
app.use(express.json());

// سجل الأخطاء للمراقبة
app.use((req: Request, res: Response, next: NextFunction) => {
  res.on("finish", () => {
    if (res.statusCode >= 400) {
      console.log(`[NON-OK] ${req.method} ${req.url} - Status: ${res.statusCode}`);
    }
  });
  next();
});

// عداد الزيارات
app.use("/app", (req: Request, res: Response, next: NextFunction) => {
  config.api.fileserverHits++;
  next();
});

app.use("/app", express.static("./src/app"));

// --- 4. الروابط (Routes) ---

// تحديث مسار تسجيل الدخول (Login)
app.post("/api/login", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    const user = await getUserByEmail(email);

    if (!user || !(await checkPasswordHash(password, user.hashedPassword))) {
      throw new UnauthorizedError("incorrect email or password");
    }

    // إنشاء التوكنات
    const accessToken = makeJWT(user.id, 3600, config.api.jwtSecret);
    const refreshTokenStr = makeRefreshToken();
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 60);
    
    await saveRefreshToken({
      token: refreshTokenStr,
      userId: user.id,
      expiresAt: expiresAt
    });

    // إرسال الرد مع ضمان شمول الحقل الجديد isChirpyRed
    return res.status(200).json({
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      isChirpyRed: user.isChirpyRed, // تأكد من إضافة هذا السطر
      token: accessToken,
      refreshToken: refreshTokenStr
    });
  } catch (err) {
    next(err);
  }
});

// مسار تحديث البيانات (PUT)
app.put("/api/users", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = getBearerToken(req);
    const userId = validateJWT(token, config.api.jwtSecret);
    const { email, password } = req.body;

    const hashedPassword = await hashPassword(password);
    const updatedUser = await updateUser(userId, { email, hashedPassword });

    if (!updatedUser) throw new NotFoundError("User not found");

    const { hashedPassword: _, ...userResponse } = updatedUser;
    return res.status(200).json(userResponse); // سيعمل تلقائياً إذا كان الـ schema محدثاً
  } catch (err) {
    next(err);
  }
});


app.post("/api/polka/webhooks", async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. التحقق من مفتاح الـ API
    try {
      const apiKey = getAPIKey(req);
      if (apiKey !== config.api.polkaKey) {
        return res.status(401).json({ error: "Unauthorized: Invalid API Key" });
      }
    } catch (err) {
      return res.status(401).json({ error: "Unauthorized: Missing or malformed API Key" });
    }

    const { event, data } = req.body;
    if (event !== "user.upgraded") {
      return res.status(204).send();
    }

    const user = await upgradeUserToRed(data.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(204).send();
  } catch (err) {
    next(err);
  }
});
// رابط حذف تغريدة
app.delete("/api/chirps/:chirpId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. التحقق من التوكن (Authorization)
    const token = getBearerToken(req);
    const userId = validateJWT(token, config.api.jwtSecret);

    const chirpId = req.params.chirpId as string;
    
    // 2. البحث عن التغريدة للتأكد من وجودها ومعرفة صاحبها
    const chirp = await getChirpById(chirpId);
    if (!chirp) {
      throw new NotFoundError("Chirp not found");
    }

    // 3. التحقق من أن المستخدم هو صاحب التغريدة (Authorization)
    if (chirp.userId !== userId) {
      throw new ForbiddenError("You are not the author of this chirp");
    }

    // 4. حذف التغريدة
    await deleteChirp(chirpId);

    // 5. إرجاع حالة 204 (تم بنجاح بدون محتوى)
    return res.status(204).send();
  } catch (err) {
    if (err instanceof Error && (err.message === "Missing Authorization header" || err.message === "Invalid or expired token")) {
      return res.status(401).json({ error: err.message });
    }
    next(err);
  }
});

// رابط إنشاء مستخدم جديد
app.post("/api/users", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      throw new BadRequestError("Email and password are required");
    }

    const hashedPassword = await hashPassword(password);
    const user = await createUser({ email, hashedPassword });
    
    if (!user) {
      throw new BadRequestError("User already exists");
    }

    // إرجاع البيانات بدون كلمة المرور المشفرة
    const { hashedPassword: _, ...userResponse } = user;
    return res.status(201).json(userResponse);
  } catch (err) {
    next(err);
  }
});


app.get("/api/chirps", async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. استخراج الـ authorId والـ sort من الـ Query Parameters
    const authorIdQuery = req.query.authorId;
    const sortQuery = req.query.sort;

    let authorId: string | undefined;
    if (typeof authorIdQuery === "string") {
      authorId = authorIdQuery;
    }

    // 2. جلب التغريدات من قاعدة البيانات (الفلترة بالكاتب تتم في الـ DB)
    let allChirps = await getAllChirps(authorId);

    // 3. ترتيب التغريدات في الذاكرة (In-Memory Sorting)
    // الافتراضي هو asc (من الأقدم للأحدث)
    if (sortQuery === "desc") {
      // ترتيب تنازلي (من الأحدث للأقدم)
      allChirps.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } else {
      // ترتيب تصاعدي (افتراضي)
      allChirps.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    }
    
    return res.status(200).json(allChirps);
  } catch (err) {
    next(err);
  }
});
// رابط جلب تغريدة واحدة بواسطة الـ ID
app.get("/api/chirps/:chirpId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    // إجبار النوع ليكون نصاً (Type Casting) لتجنب أخطاء TypeScript
    const chirpId = req.params.chirpId as string;
    const chirp = await getChirpById(chirpId);

    if (!chirp) {
      throw new NotFoundError("Chirp not found");
    }

    return res.status(200).json(chirp);
  } catch (err) {
    next(err);
  }
});



   
  
// مسار تجديد التوكن
app.post("/api/refresh", async (req, res, next) => {
  try {
    const refreshTokenStr = getBearerToken(req);
    const validToken = await getValidRefreshToken(refreshTokenStr);

    if (!validToken) {
      return res.status(401).json({ error: "Invalid or expired refresh token" });
    }

    const newAccessToken = makeJWT(validToken.userId, 3600, config.api.jwtSecret);
    return res.status(200).json({ token: newAccessToken });
  } catch (err) {
    res.status(401).json({ error: "Unauthorized" });
  }
});

// مسار إلغاء التوكن (تسجيل الخروج)
app.post("/api/revoke", async (req, res, next) => {
  try {
    const refreshTokenStr = getBearerToken(req);
    await revokeRefreshToken(refreshTokenStr);
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// تحديث مسار Chirps ليكون محمياً
app.post("/api/chirps", async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. التحقق من التوكن واستخراج ID المستخدم
    const token = getBearerToken(req);
    const userId = validateJWT(token, config.api.jwtSecret);

    const { body } = req.body;
    if (body === undefined) throw new BadRequestError("Chirp is missing body");
    if (body.length > 140) throw new BadRequestError("Chirp is too long");

    // تنظيف النص (نفس المنطق السابق)
    const profaneWords = ["kerfuffle", "sharbert", "fornax"];
    const cleanedBody = body.split(" ").map((w: string) => 
      profaneWords.includes(w.toLowerCase()) ? "****" : w
    ).join(" ");

    // حفظ التغريدة باسم المستخدم صاحب التوكن
    const chirp = await createChirp({ body: cleanedBody, userId });
    
    return res.status(201).json(chirp);
  } catch (err) {
    // إذا كان الخطأ متعلق بالتوكن، أرسل 401
    if (err instanceof Error && (err.message === "Missing Authorization header" || err.message === "Invalid or expired token")) {
      return res.status(401).json({ error: err.message });
    }
    next(err);
  }
});
// رابط الصحة
app.get("/api/healthz", (req: Request, res: Response) => {
  res.status(200).type("text/plain").send("OK");
});

// روابط الإدارة
app.get("/admin/metrics", (req: Request, res: Response) => {
  res.set("Content-Type", "text/html; charset=utf-8");
  res.send(`
<html>
  <body>
    <h1>Welcome, Chirpy Admin</h1>
    <p>Chirpy has been visited ${config.api.fileserverHits} times!</p>
  </body>
</html>
  `);
});

app.post("/admin/reset", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (config.api.platform !== "dev") {
      return res.status(403).json({ error: "Forbidden: Only available in dev environment" });
    }

    config.api.fileserverHits = 0;
    await deleteAllUsers();

    res.set("Content-Type", "text/plain; charset=utf-8");
    res.send("Hits reset to 0 and all users deleted");
  } catch (err) {
    next(err);
  }
});

// --- 5. الـ Error Handler النهائي ---
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof BadRequestError) {
    return res.status(400).json({ error: err.message });
  }

  if (err instanceof NotFoundError) {
    return res.status(404).json({ error: err.message });
  }
  if (err instanceof UnauthorizedError)
    return res.status(401).json({ error: err.message });

  if (err instanceof ForbiddenError) 
    return res.status(403).json({ error: err.message });
  console.error("Unhandled Error:", err);
  res.status(500).json({
    error: "Something went wrong on our end"
  });
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
