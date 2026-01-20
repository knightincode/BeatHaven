import bcrypt from "bcryptjs";
import crypto from "crypto";
import { storage } from "./storage";
import { User } from "../shared/schema";

const JWT_SECRET = process.env.SESSION_SECRET || "binaural-beats-secret-key";

interface TokenPayload {
  userId: string;
  exp: number;
}

export function generateToken(userId: string): string {
  const payload: TokenPayload = {
    userId,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
  };
  const payloadString = JSON.stringify(payload);
  const base64Payload = Buffer.from(payloadString).toString("base64");
  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(base64Payload)
    .digest("base64");
  return `${base64Payload}.${signature}`;
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const [base64Payload, signature] = token.split(".");
    const expectedSignature = crypto
      .createHmac("sha256", JWT_SECRET)
      .update(base64Payload)
      .digest("base64");
    
    if (signature !== expectedSignature) {
      return null;
    }
    
    const payloadString = Buffer.from(base64Payload, "base64").toString("utf-8");
    const payload = JSON.parse(payloadString) as TokenPayload;
    
    if (payload.exp < Date.now()) {
      return null;
    }
    
    return payload;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePasswords(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function authenticateToken(
  authHeader: string | undefined
): Promise<User | null> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  
  const token = authHeader.substring(7);
  const payload = verifyToken(token);
  
  if (!payload) {
    return null;
  }
  
  const user = await storage.getUser(payload.userId);
  return user || null;
}
