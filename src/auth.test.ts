import { describe, it, expect, beforeAll } from "vitest";
import { makeJWT, validateJWT, hashPassword, checkPasswordHash } from "./auth.js";

describe("JWT Functions", () => {
  const secret = "super-secret-key";
  const userID = "123-456-789";

  it("should create and validate a valid JWT", () => {
    const token = makeJWT(userID, 3600, secret);
    const sub = validateJWT(token, secret);
    expect(sub).toBe(userID);
  });

  it("should fail validation with wrong secret", () => {
    const token = makeJWT(userID, 3600, secret);
    expect(() => validateJWT(token, "wrong-secret")).toThrow("Invalid or expired token");
  });

  it("should fail validation for expired token", async () => {
    // إنشاء توكن ينتهي فوراً (أو منذ ثانية)
    const token = makeJWT(userID, -10, secret);
    expect(() => validateJWT(token, secret)).toThrow("Invalid or expired token");
  });
});

describe("Password Hashing", () => {
  const password = "mySecretPassword123";
  let hash: string;

  beforeAll(async () => {
    hash = await hashPassword(password);
  });

  it("should return true for correct password", async () => {
    const result = await checkPasswordHash(password, hash);
    expect(result).toBe(true);
  });

  it("should return false for incorrect password", async () => {
    const result = await checkPasswordHash("wrongPassword", hash);
    expect(result).toBe(false);
  });
});
