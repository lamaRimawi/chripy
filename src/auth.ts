import crypto from "node:crypto";
import { Request } from "express";
import argon2 from "argon2";
import jwt, { JwtPayload } from "jsonwebtoken";
export async function hashPassword(password: string): Promise<string> {
  return await argon2.hash(password);
}

export async function checkPasswordHash(password: string, hash: string): Promise<boolean> {
  return await argon2.verify(hash, password);
}
// وظائف الـ JWT الجديدة
export function makeJWT(userID: string, expiresIn: number, secret: string): string {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + expiresIn;
  
  const payload: Pick<JwtPayload, "iss" | "sub" | "iat" | "exp"> = {
    iss: "chirpy",
    sub: userID,
    iat: iat,
    exp: exp,
  };

  return jwt.sign(payload, secret);
}

export function validateJWT(tokenString: string, secret: string): string {
  try {
    const decoded = jwt.verify(tokenString, secret) as JwtPayload;
    if (!decoded.sub) {
      throw new Error("Invalid token payload: missing sub");
    }
    return decoded.sub;
  } catch (err) {
    throw new Error("Invalid or expired token");
  }
}
export function getBearerToken(req: Request): string {
  const authHeader = req.get("Authorization");
  if (!authHeader) {
    throw new Error("Missing Authorization header");
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    throw new Error("Invalid Authorization header format");
  }

  return parts[1];
}
export function makeRefreshToken(): string {
  return crypto.randomBytes(32).toString("hex");
}
export function getAPIKey(req: Request): string {
  const authHeader = req.get("Authorization");
  if (!authHeader) {
    throw new Error("Missing Authorization header");
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "ApiKey") {
    throw new Error("Invalid Authorization header format");
  }

  return parts[1];
}
