var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/index.ts
import express from "express";

// server/routes.ts
import { createServer } from "node:http";
import multer from "multer";

// server/storage.ts
import { eq, and, sql as sql2 } from "drizzle-orm";

// server/db.ts
import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  audioTracks: () => audioTracks,
  favorites: () => favorites,
  insertAudioTrackSchema: () => insertAudioTrackSchema,
  insertFavoriteSchema: () => insertFavoriteSchema,
  insertPlaylistSchema: () => insertPlaylistSchema,
  insertPlaylistTrackSchema: () => insertPlaylistTrackSchema,
  insertUserSchema: () => insertUserSchema,
  playlistTracks: () => playlistTracks,
  playlists: () => playlists,
  quotes: () => quotes,
  users: () => users
});
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
var users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password"),
  authProvider: text("auth_provider").default("email"),
  appleUserId: text("apple_user_id").unique(),
  googleUserId: text("google_user_id").unique(),
  isAdmin: boolean("is_admin").default(false),
  isDemo: boolean("is_demo").default(false),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStatus: text("subscription_status").default("inactive"),
  createdAt: timestamp("created_at").defaultNow()
});
var audioTracks = pgTable("audio_tracks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  frequency: text("frequency").notNull(),
  category: text("category").notNull(),
  duration: integer("duration").notNull(),
  fileUrl: text("file_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  createdAt: timestamp("created_at").defaultNow()
});
var playlists = pgTable("playlists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});
var playlistTracks = pgTable("playlist_tracks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playlistId: varchar("playlist_id").notNull().references(() => playlists.id),
  trackId: varchar("track_id").notNull().references(() => audioTracks.id),
  position: integer("position").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});
var favorites = pgTable("favorites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  trackId: varchar("track_id").notNull().references(() => audioTracks.id),
  createdAt: timestamp("created_at").defaultNow()
});
var insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true
});
var insertAudioTrackSchema = createInsertSchema(audioTracks).omit({
  id: true,
  createdAt: true
});
var insertPlaylistSchema = createInsertSchema(playlists).pick({
  name: true,
  userId: true
});
var insertPlaylistTrackSchema = createInsertSchema(playlistTracks).omit({
  id: true,
  createdAt: true
});
var quotes = pgTable("quotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  text: text("text").notNull(),
  author: text("author"),
  createdAt: timestamp("created_at").defaultNow()
});
var insertFavoriteSchema = createInsertSchema(favorites).omit({
  id: true,
  createdAt: true
});

// server/db.ts
var { Pool } = pkg;
var pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
var db = drizzle(pool, { schema: schema_exports });

// server/storage.ts
var Storage = class {
  async getUser(id) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  async getUserByEmail(email) {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }
  async getUserByAppleId(appleUserId) {
    const [user] = await db.select().from(users).where(eq(users.appleUserId, appleUserId));
    return user;
  }
  async getUserByGoogleId(googleUserId) {
    const [user] = await db.select().from(users).where(eq(users.googleUserId, googleUserId));
    return user;
  }
  async createUser(email, hashedPassword, options) {
    const [user] = await db.insert(users).values({
      email,
      password: hashedPassword,
      authProvider: options?.authProvider || "email",
      appleUserId: options?.appleUserId || null,
      googleUserId: options?.googleUserId || null
    }).returning();
    return user;
  }
  async updateUser(id, data) {
    const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return user;
  }
  async updateUserStripeInfo(userId, stripeInfo) {
    const [user] = await db.update(users).set(stripeInfo).where(eq(users.id, userId)).returning();
    return user;
  }
  async getAllTracks() {
    return await db.select().from(audioTracks).orderBy(audioTracks.category, audioTracks.title);
  }
  async getTrack(id) {
    const [track] = await db.select().from(audioTracks).where(eq(audioTracks.id, id));
    return track;
  }
  async createTrack(track) {
    const [newTrack] = await db.insert(audioTracks).values(track).returning();
    return newTrack;
  }
  async deleteTrack(id) {
    await db.delete(playlistTracks).where(eq(playlistTracks.trackId, id));
    await db.delete(favorites).where(eq(favorites.trackId, id));
    await db.delete(audioTracks).where(eq(audioTracks.id, id));
  }
  async getUserPlaylists(userId) {
    const result = await db.execute(sql2`
      SELECT p.*, COUNT(pt.id)::int as track_count
      FROM playlists p
      LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
      WHERE p.user_id = ${userId}
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `);
    return result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      createdAt: row.created_at,
      trackCount: row.track_count || 0
    }));
  }
  async getPlaylist(id) {
    const [playlist] = await db.select().from(playlists).where(eq(playlists.id, id));
    return playlist;
  }
  async createPlaylist(userId, name) {
    const [playlist] = await db.insert(playlists).values({ userId, name }).returning();
    return playlist;
  }
  async deletePlaylist(id) {
    await db.delete(playlistTracks).where(eq(playlistTracks.playlistId, id));
    await db.delete(playlists).where(eq(playlists.id, id));
  }
  async getPlaylistTracks(playlistId) {
    const result = await db.execute(sql2`
      SELECT at.*, pt.position
      FROM playlist_tracks pt
      JOIN audio_tracks at ON at.id = pt.track_id
      WHERE pt.playlist_id = ${playlistId}
      ORDER BY pt.position
    `);
    return result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      frequency: row.frequency,
      category: row.category,
      duration: row.duration,
      fileUrl: row.file_url,
      thumbnailUrl: row.thumbnail_url,
      createdAt: row.created_at,
      position: row.position
    }));
  }
  async addTrackToPlaylist(playlistId, trackId) {
    const existingTracks = await db.select().from(playlistTracks).where(eq(playlistTracks.playlistId, playlistId));
    const position = existingTracks.length;
    const [playlistTrack] = await db.insert(playlistTracks).values({ playlistId, trackId, position }).returning();
    return playlistTrack;
  }
  async removeTrackFromPlaylist(playlistId, trackId) {
    await db.delete(playlistTracks).where(
      and(
        eq(playlistTracks.playlistId, playlistId),
        eq(playlistTracks.trackId, trackId)
      )
    );
  }
  async getUserFavorites(userId) {
    const result = await db.execute(sql2`
      SELECT at.*
      FROM favorites f
      JOIN audio_tracks at ON at.id = f.track_id
      WHERE f.user_id = ${userId}
      ORDER BY f.created_at DESC
    `);
    return result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      frequency: row.frequency,
      category: row.category,
      duration: row.duration,
      fileUrl: row.file_url,
      thumbnailUrl: row.thumbnail_url,
      createdAt: row.created_at
    }));
  }
  async addFavorite(userId, trackId) {
    const [favorite] = await db.insert(favorites).values({ userId, trackId }).returning();
    return favorite;
  }
  async removeFavorite(userId, trackId) {
    await db.delete(favorites).where(and(eq(favorites.userId, userId), eq(favorites.trackId, trackId)));
  }
  async isFavorite(userId, trackId) {
    const [favorite] = await db.select().from(favorites).where(and(eq(favorites.userId, userId), eq(favorites.trackId, trackId)));
    return !!favorite;
  }
  async deleteUser(userId) {
    await db.transaction(async (tx) => {
      const userPlaylists = await tx.select().from(playlists).where(eq(playlists.userId, userId));
      for (const playlist of userPlaylists) {
        await tx.delete(playlistTracks).where(eq(playlistTracks.playlistId, playlist.id));
      }
      await tx.delete(playlists).where(eq(playlists.userId, userId));
      await tx.delete(favorites).where(eq(favorites.userId, userId));
      await tx.delete(users).where(eq(users.id, userId));
    });
  }
};
var storage = new Storage();

// server/auth.ts
import bcrypt from "bcryptjs";
import crypto from "crypto";
var JWT_SECRET = process.env.SESSION_SECRET || "binaural-beats-secret-key";
function generateToken(userId) {
  const payload = {
    userId,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1e3
  };
  const payloadString = JSON.stringify(payload);
  const base64Payload = Buffer.from(payloadString).toString("base64");
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(base64Payload).digest("base64");
  return `${base64Payload}.${signature}`;
}
function verifyToken(token) {
  try {
    const [base64Payload, signature] = token.split(".");
    const expectedSignature = crypto.createHmac("sha256", JWT_SECRET).update(base64Payload).digest("base64");
    if (signature !== expectedSignature) {
      return null;
    }
    const payloadString = Buffer.from(base64Payload, "base64").toString("utf-8");
    const payload = JSON.parse(payloadString);
    if (payload.exp < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}
async function comparePasswords(password, hash) {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}
async function authenticateToken(authHeader) {
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

// server/appleAuth.ts
import { createRemoteJWKSet, jwtVerify } from "jose";
var APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys";
var APPLE_ISSUER = "https://appleid.apple.com";
var APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID || "com.beathaven.app";
var EXPO_GO_CLIENT_ID = "host.exp.Exponent";
var VALID_AUDIENCES = [APPLE_CLIENT_ID, EXPO_GO_CLIENT_ID];
var appleJWKS = createRemoteJWKSet(new URL(APPLE_JWKS_URL));
async function verifyAppleIdentityToken(identityToken) {
  const { payload } = await jwtVerify(identityToken, appleJWKS, {
    issuer: APPLE_ISSUER,
    audience: VALID_AUDIENCES
  });
  if (!payload.sub) {
    throw new Error("Apple identity token missing subject");
  }
  return {
    sub: payload.sub,
    email: payload.email
  };
}

// server/googleAuth.ts
import { createRemoteJWKSet as createRemoteJWKSet2, jwtVerify as jwtVerify2 } from "jose";
var GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
var GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
var WEB_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "793408192278-rbno8ju44gflq2o7s6v9efjfpodf8tmi.apps.googleusercontent.com";
var IOS_CLIENT_ID = process.env.GOOGLE_IOS_CLIENT_ID || "";
var ANDROID_CLIENT_ID = process.env.GOOGLE_ANDROID_CLIENT_ID || "";
function getValidAudiences() {
  const audiences = [WEB_CLIENT_ID];
  if (IOS_CLIENT_ID) audiences.push(IOS_CLIENT_ID);
  if (ANDROID_CLIENT_ID) audiences.push(ANDROID_CLIENT_ID);
  return audiences;
}
var googleJWKS = createRemoteJWKSet2(new URL(GOOGLE_JWKS_URL));
async function verifyGoogleIdToken(idToken) {
  const validAudiences = getValidAudiences();
  let lastError = null;
  for (const audience of validAudiences) {
    try {
      const { payload } = await jwtVerify2(idToken, googleJWKS, {
        audience
      });
      const issuer = payload.iss;
      if (!GOOGLE_ISSUERS.includes(issuer)) {
        throw new Error(`Invalid Google token issuer: ${issuer}`);
      }
      if (!payload.sub) {
        throw new Error("Google ID token missing subject");
      }
      return {
        sub: payload.sub,
        email: payload.email,
        email_verified: payload.email_verified,
        name: payload.name
      };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error("Google ID token verification failed");
}

// server/stripeClient.ts
import Stripe from "stripe";
var connectionSettings;
async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY ? "repl " + process.env.REPL_IDENTITY : process.env.WEB_REPL_RENEWAL ? "depl " + process.env.WEB_REPL_RENEWAL : null;
  if (!xReplitToken) {
    throw new Error("X_REPLIT_TOKEN not found for repl/depl");
  }
  const connectorName = "stripe";
  const isProduction = process.env.REPLIT_DEPLOYMENT === "1";
  const targetEnvironment = isProduction ? "production" : "development";
  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set("include_secrets", "true");
  url.searchParams.set("connector_names", connectorName);
  url.searchParams.set("environment", targetEnvironment);
  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      X_REPLIT_TOKEN: xReplitToken
    }
  });
  const data = await response.json();
  connectionSettings = data.items?.[0];
  if (!connectionSettings || !connectionSettings.settings.publishable || !connectionSettings.settings.secret) {
    if (isProduction) {
      console.warn(
        "[Stripe] WARNING: No production Stripe connection found. Falling back to development connection. Configure a production Stripe connection to use live keys."
      );
      const devUrl = new URL(`https://${hostname}/api/v2/connection`);
      devUrl.searchParams.set("include_secrets", "true");
      devUrl.searchParams.set("connector_names", connectorName);
      devUrl.searchParams.set("environment", "development");
      const devResponse = await fetch(devUrl.toString(), {
        headers: {
          Accept: "application/json",
          X_REPLIT_TOKEN: xReplitToken
        }
      });
      const devData = await devResponse.json();
      connectionSettings = devData.items?.[0];
      if (!connectionSettings || !connectionSettings.settings.publishable || !connectionSettings.settings.secret) {
        throw new Error(
          "Stripe connection not found in either production or development"
        );
      }
    } else {
      throw new Error(`Stripe ${targetEnvironment} connection not found`);
    }
  }
  return {
    publishableKey: connectionSettings.settings.publishable,
    secretKey: connectionSettings.settings.secret
  };
}
async function getUncachableStripeClient() {
  const { secretKey } = await getCredentials();
  return new Stripe(secretKey, {
    apiVersion: "2025-08-27.basil"
  });
}
async function getStripePublishableKey() {
  const { publishableKey } = await getCredentials();
  return publishableKey;
}
async function getStripeSecretKey() {
  const { secretKey } = await getCredentials();
  return secretKey;
}
var stripeSync = null;
async function getStripeSync() {
  if (!stripeSync) {
    const { StripeSync } = await import("stripe-replit-sync");
    const secretKey = await getStripeSecretKey();
    stripeSync = new StripeSync({
      poolConfig: {
        connectionString: process.env.DATABASE_URL,
        max: 2
      },
      stripeSecretKey: secretKey
    });
  }
  return stripeSync;
}

// server/objectStorage.ts
import { Client } from "@replit/object-storage";
var client = new Client();
var fileSizeCache = /* @__PURE__ */ new Map();
var MAX_BUFFER_CACHE_ENTRIES = 10;
var audioBufferCache = /* @__PURE__ */ new Map();
function evictBufferCache() {
  if (audioBufferCache.size <= MAX_BUFFER_CACHE_ENTRIES) return;
  let oldestKey = null;
  let oldestTime = Infinity;
  for (const [key, entry] of audioBufferCache) {
    if (entry.lastAccess < oldestTime) {
      oldestTime = entry.lastAccess;
      oldestKey = key;
    }
  }
  if (oldestKey) audioBufferCache.delete(oldestKey);
}
async function uploadAudioFile(fileName, fileBuffer) {
  const objectName = `audio/${Date.now()}-${fileName}`;
  await client.uploadFromBytes(objectName, fileBuffer);
  return objectName;
}
function preCacheFileSize(objectName, size) {
  fileSizeCache.set(objectName, size);
}
async function getAudioFileAsBuffer(objectName) {
  const cached = audioBufferCache.get(objectName);
  if (cached) {
    cached.lastAccess = Date.now();
    return { buffer: cached.buffer, size: cached.buffer.length };
  }
  try {
    const result = await client.downloadAsBytes(objectName);
    if (result.ok) {
      const buffer = result.value[0];
      fileSizeCache.set(objectName, buffer.length);
      audioBufferCache.set(objectName, { buffer, lastAccess: Date.now() });
      evictBufferCache();
      return { buffer, size: buffer.length };
    }
    return null;
  } catch (err) {
    console.error(`[Audio] getAudioFileAsBuffer error for ${objectName}:`, err?.message || err);
    return null;
  }
}
async function testStorageConnectivity() {
  const testPath = "Alpha/AlphaBinauralBeat_235_12-0_AlphaBetaBorder.wav";
  const result = {
    bytesOk: false,
    streamOk: false
  };
  try {
    const bytesResult = await client.downloadAsBytes(testPath);
    result.bytesOk = bytesResult.ok;
  } catch (err) {
    result.error = `downloadAsBytes: ${err?.message || err}`;
  }
  try {
    const stream = client.downloadAsStream(testPath);
    await new Promise((resolve2, reject) => {
      const timeout = setTimeout(() => {
        stream.destroy();
        reject(new Error("Stream timeout after 10s"));
      }, 1e4);
      stream.once("data", () => {
        clearTimeout(timeout);
        result.streamOk = true;
        stream.destroy();
        resolve2();
      });
      stream.once("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  } catch (err) {
    result.error = (result.error ? result.error + "; " : "") + `downloadAsStream: ${err?.message || err}`;
  }
  return result;
}

// server/routes.ts
import { sql as sql3 } from "drizzle-orm";

// server/demoUser.ts
var DEMO_EMAIL = "demo@beathaven.app";
var demoUserId = null;
var demoUserCache = null;
async function seedDemoUser() {
  try {
    const [row] = await db.insert(users).values({
      email: DEMO_EMAIL,
      password: null,
      authProvider: "demo",
      isDemo: true,
      isAdmin: false,
      subscriptionStatus: "inactive"
    }).onConflictDoUpdate({
      target: users.email,
      set: {
        isDemo: true,
        isAdmin: false,
        password: null,
        authProvider: "demo",
        subscriptionStatus: "inactive"
      }
    }).returning();
    demoUserId = row.id;
    demoUserCache = {
      id: row.id,
      email: row.email,
      isAdmin: false,
      isDemo: true,
      subscriptionStatus: "inactive"
    };
    console.log(`[Demo] Demo user ready: ${demoUserId}`);
  } catch (err) {
    console.error("[Demo] CRITICAL: Failed to seed demo user \u2014 demo mode will be unavailable:", err);
    console.error("[Demo] Check database connectivity and ensure the is_demo column exists (run migration 0001_add_is_demo.sql if needed).");
  }
}
function getDemoUser() {
  return demoUserCache;
}

// server/routes.ts
var demoRateLimit = /* @__PURE__ */ new Map();
function checkDemoRateLimit(ip) {
  const now = Date.now();
  const window = 6e4;
  const limit = 60;
  const entry = demoRateLimit.get(ip);
  if (!entry || now > entry.resetAt) {
    demoRateLimit.set(ip, { count: 1, resetAt: now + window });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}
var upload = multer({ storage: multer.memoryStorage() });
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  authenticateToken(authHeader).then((user) => {
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    req.user = user;
    next();
  });
}
function adminMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  authenticateToken(authHeader).then((user) => {
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (!user.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }
    req.user = user;
    next();
  });
}
async function registerRoutes(app2) {
  app2.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }
      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser(email, hashedPassword);
      const token = generateToken(user.id);
      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          isAdmin: user.isAdmin,
          isDemo: user.isDemo ?? false,
          subscriptionStatus: user.subscriptionStatus
        }
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });
  app2.post("/api/auth/apple", async (req, res) => {
    try {
      const { identityToken, email, fullName, mode } = req.body;
      const isSignupMode = mode === "signup";
      if (!identityToken) {
        return res.status(400).json({ message: "Apple identity token is required" });
      }
      let verifiedPayload;
      try {
        verifiedPayload = await verifyAppleIdentityToken(identityToken);
      } catch (verifyError) {
        console.error("Apple token verification failed:", verifyError);
        return res.status(401).json({ message: "Invalid Apple identity token" });
      }
      const appleUserId = verifiedPayload.sub;
      const verifiedEmail = verifiedPayload.email || email;
      let user = await storage.getUserByAppleId(appleUserId);
      let isNewUser = false;
      if (!user) {
        const userEmail = verifiedEmail || `apple_${appleUserId}@privaterelay.appleid.com`;
        const existingEmailUser = await storage.getUserByEmail(userEmail);
        if (existingEmailUser) {
          if (isSignupMode) {
            return res.status(409).json({ message: "You already have an account with this Apple account. Please sign in instead." });
          }
          await storage.updateUser(existingEmailUser.id, {
            appleUserId,
            authProvider: existingEmailUser.authProvider === "email" ? "apple" : existingEmailUser.authProvider
          });
          user = await storage.getUser(existingEmailUser.id);
        } else {
          user = await storage.createUser(userEmail, null, {
            authProvider: "apple",
            appleUserId
          });
          isNewUser = true;
        }
      } else if (isSignupMode) {
        return res.status(409).json({ message: "You already have an account with this Apple account. Please sign in instead." });
      }
      const token = generateToken(user.id);
      res.json({
        token,
        isNewUser,
        user: {
          id: user.id,
          email: user.email,
          isAdmin: user.isAdmin,
          isDemo: user.isDemo ?? false,
          subscriptionStatus: user.subscriptionStatus
        }
      });
    } catch (error) {
      console.error("Apple auth error:", error);
      res.status(500).json({ message: "Apple authentication failed" });
    }
  });
  app2.post("/api/auth/google", async (req, res) => {
    try {
      const { idToken, mode } = req.body;
      const isSignupMode = mode === "signup";
      if (!idToken) {
        return res.status(400).json({ message: "Google ID token is required" });
      }
      let verifiedPayload;
      try {
        verifiedPayload = await verifyGoogleIdToken(idToken);
      } catch (verifyError) {
        console.error("Google token verification failed:", verifyError);
        return res.status(401).json({ message: "Invalid Google ID token" });
      }
      const googleUserId = verifiedPayload.sub;
      const verifiedEmail = verifiedPayload.email;
      const emailVerified = verifiedPayload.email_verified === true;
      console.log(`[Google Auth] sub=${googleUserId}, email=${verifiedEmail}, email_verified=${emailVerified}, mode=${mode}`);
      let user = await storage.getUserByGoogleId(googleUserId);
      let isNewUser = false;
      if (!user) {
        const userEmail = verifiedEmail || `google_${googleUserId}@gmail.com`;
        const existingEmailUser = emailVerified && verifiedEmail ? await storage.getUserByEmail(userEmail) : null;
        if (existingEmailUser) {
          if (isSignupMode) {
            return res.status(409).json({ message: "You already have an account with this Google account. Please sign in instead." });
          }
          console.log(`[Google Auth] Linking to existing email user: ${existingEmailUser.id} (${existingEmailUser.email})`);
          await storage.updateUser(existingEmailUser.id, {
            googleUserId,
            authProvider: existingEmailUser.authProvider === "email" ? "google" : existingEmailUser.authProvider
          });
          user = await storage.getUser(existingEmailUser.id);
        } else {
          console.log(`[Google Auth] Creating new user with email: ${userEmail}`);
          user = await storage.createUser(userEmail, null, {
            authProvider: "google",
            googleUserId
          });
          isNewUser = true;
        }
      } else {
        if (isSignupMode) {
          return res.status(409).json({ message: "You already have an account with this Google account. Please sign in instead." });
        }
        console.log(`[Google Auth] Found existing Google user: ${user.id} (${user.email})`);
      }
      const token = generateToken(user.id);
      res.json({
        token,
        isNewUser,
        user: {
          id: user.id,
          email: user.email,
          isAdmin: user.isAdmin,
          isDemo: user.isDemo ?? false,
          subscriptionStatus: user.subscriptionStatus
        }
      });
    } catch (error) {
      console.error("Google auth error:", error);
      res.status(500).json({ message: "Google authentication failed" });
    }
  });
  app2.post("/api/auth/demo", async (req, res) => {
    try {
      const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
      if (!checkDemoRateLimit(ip)) {
        return res.status(429).json({ message: "Too many demo login attempts. Please wait a minute and try again." });
      }
      const demoUser = getDemoUser();
      if (!demoUser) {
        return res.status(503).json({ message: "Demo mode is not available right now. Please try again shortly." });
      }
      const token = generateToken(demoUser.id);
      res.json({
        token,
        user: {
          id: demoUser.id,
          email: demoUser.email,
          isAdmin: demoUser.isAdmin,
          isDemo: demoUser.isDemo,
          subscriptionStatus: demoUser.subscriptionStatus
        }
      });
    } catch (error) {
      console.error("Demo auth error:", error);
      res.status(500).json({ message: "Demo login failed" });
    }
  });
  app2.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      if (!user.password) {
        const provider = user.authProvider === "google" ? "Google" : user.authProvider === "apple" ? "Apple" : "social";
        return res.status(401).json({ message: `This account uses ${provider} Sign-In. Please sign in with ${provider}.` });
      }
      const validPassword = await comparePasswords(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      const token = generateToken(user.id);
      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          isAdmin: user.isAdmin,
          isDemo: user.isDemo ?? false,
          subscriptionStatus: user.subscriptionStatus
        }
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });
  app2.get("/api/user", authMiddleware, async (req, res) => {
    const user = req.user;
    res.json({
      id: user.id,
      email: user.email,
      isAdmin: user.isAdmin,
      isDemo: user.isDemo,
      subscriptionStatus: user.subscriptionStatus
    });
  });
  app2.put("/api/user/update", authMiddleware, async (req, res) => {
    try {
      const user = req.user;
      const { email, currentPassword, newPassword } = req.body;
      const updates = {};
      if (email && email !== user.email) {
        const existingUser = await storage.getUserByEmail(email);
        if (existingUser) {
          return res.status(400).json({ message: "Email already in use" });
        }
        updates.email = email;
      }
      if (newPassword) {
        if (user.password) {
          if (!currentPassword) {
            return res.status(400).json({ message: "Current password is required" });
          }
          const validPassword = await comparePasswords(currentPassword, user.password);
          if (!validPassword) {
            return res.status(400).json({ message: "Current password is incorrect" });
          }
        }
        updates.password = await hashPassword(newPassword);
      }
      if (Object.keys(updates).length > 0) {
        await storage.updateUser(user.id, updates);
      }
      res.json({ message: "Profile updated successfully" });
    } catch (error) {
      console.error("Update error:", error);
      res.status(500).json({ message: "Update failed" });
    }
  });
  app2.delete("/api/user", authMiddleware, async (req, res) => {
    try {
      const user = req.user;
      if (user.isDemo) {
        return res.status(403).json({ message: "Demo accounts cannot be deleted" });
      }
      if (user.stripeCustomerId) {
        const stripe = await getUncachableStripeClient();
        const subscriptions = await stripe.subscriptions.list({
          customer: user.stripeCustomerId,
          status: "active"
        });
        for (const sub of subscriptions.data) {
          await stripe.subscriptions.cancel(sub.id);
          console.log("[Delete] Cancelled subscription:", sub.id);
        }
        const trialingSubs = await stripe.subscriptions.list({
          customer: user.stripeCustomerId,
          status: "trialing"
        });
        for (const sub of trialingSubs.data) {
          await stripe.subscriptions.cancel(sub.id);
          console.log("[Delete] Cancelled trialing subscription:", sub.id);
        }
        await stripe.customers.del(user.stripeCustomerId);
        console.log("[Delete] Deleted Stripe customer:", user.stripeCustomerId);
      }
      await storage.deleteUser(user.id);
      console.log("[Delete] Deleted user:", user.id, user.email);
      res.json({ message: "Account deleted successfully" });
    } catch (error) {
      console.error("Delete account error:", error);
      res.status(500).json({ message: "Failed to delete account" });
    }
  });
  app2.get("/api/tracks", async (req, res) => {
    try {
      const tracks = await storage.getAllTracks();
      const tracksWithUrls = tracks.map((track) => ({
        ...track,
        fileUrl: `/api/audio/${track.fileUrl}`
      }));
      tracksWithUrls.sort((a, b) => {
        const beatFreqA = parseFloat(a.frequency.match(/(\d+\.?\d*)Hz beat/)?.[1] || "0");
        const beatFreqB = parseFloat(b.frequency.match(/(\d+\.?\d*)Hz beat/)?.[1] || "0");
        return beatFreqA - beatFreqB;
      });
      res.json(tracksWithUrls);
    } catch (error) {
      console.error("Get tracks error:", error);
      res.status(500).json({ message: "Failed to get tracks" });
    }
  });
  app2.get("/api/audio/:folder/:filename", async (req, res) => {
    let objectPath = "";
    try {
      objectPath = decodeURIComponent(`${req.params.folder}/${req.params.filename}`);
      console.log(`[Audio] Request: ${objectPath} range=${req.headers.range || "none"}`);
      const fileData = await getAudioFileAsBuffer(objectPath);
      if (!fileData) {
        console.error(`[Audio] File not found in Object Storage: ${objectPath}`);
        return res.status(404).json({ message: "Audio file not found" });
      }
      const { buffer, size: totalSize } = fileData;
      const range = req.headers.range;
      let start = 0;
      let end = totalSize - 1;
      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const rawStart = parseInt(parts[0], 10);
        const rawEnd = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
        if (isNaN(rawStart) || rawStart < 0 || rawStart >= totalSize) {
          res.setHeader("Content-Range", `bytes */${totalSize}`);
          return res.status(416).json({ message: "Range Not Satisfiable" });
        }
        start = rawStart;
        end = Math.min(isNaN(rawEnd) || rawEnd < 0 ? totalSize - 1 : rawEnd, totalSize - 1);
      }
      if (start > end) {
        res.setHeader("Content-Range", `bytes */${totalSize}`);
        return res.status(416).json({ message: "Range Not Satisfiable" });
      }
      const chunkSize = end - start + 1;
      const headers = {
        "Content-Type": "audio/wav",
        "Content-Length": chunkSize,
        "Accept-Ranges": "bytes",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Cache-Control": "public, max-age=86400"
      };
      if (range) {
        headers["Content-Range"] = `bytes ${start}-${end}/${totalSize}`;
        res.writeHead(206, headers);
      } else {
        res.writeHead(200, headers);
      }
      const slice = buffer.subarray(start, end + 1);
      res.end(slice);
    } catch (error) {
      console.error(`[Audio] Error serving ${objectPath}:`, error?.message || error, error?.stack);
      if (!res.headersSent) {
        res.status(500).json({ message: "Failed to stream audio" });
      }
    }
  });
  app2.post("/api/admin/toggle-subscription", adminMiddleware, async (req, res) => {
    try {
      const user = req.user;
      const newStatus = user.subscriptionStatus === "active" ? "inactive" : "active";
      await db.execute(
        sql3`UPDATE users SET subscription_status = ${newStatus} WHERE id = ${user.id}`
      );
      const updatedUser = await storage.getUser(user.id);
      res.json(updatedUser);
    } catch (error) {
      console.error("Toggle subscription error:", error);
      res.status(500).json({ message: "Failed to toggle subscription" });
    }
  });
  app2.get("/api/playlists", authMiddleware, async (req, res) => {
    try {
      const user = req.user;
      const playlists2 = await storage.getUserPlaylists(user.id);
      res.json(playlists2);
    } catch (error) {
      console.error("Get playlists error:", error);
      res.status(500).json({ message: "Failed to get playlists" });
    }
  });
  app2.post("/api/playlists", authMiddleware, async (req, res) => {
    try {
      const user = req.user;
      const { name } = req.body;
      if (!name) {
        return res.status(400).json({ message: "Playlist name is required" });
      }
      if (user.isDemo) {
        const existingPlaylists = await storage.getUserPlaylists(user.id);
        if (existingPlaylists.length >= 1) {
          return res.status(403).json({ message: "Demo accounts are limited to one playlist" });
        }
      }
      const playlist = await storage.createPlaylist(user.id, name);
      res.json(playlist);
    } catch (error) {
      console.error("Create playlist error:", error);
      res.status(500).json({ message: "Failed to create playlist" });
    }
  });
  app2.delete("/api/playlists/:id", authMiddleware, async (req, res) => {
    try {
      const user = req.user;
      const { id } = req.params;
      const playlist = await storage.getPlaylist(id);
      if (!playlist || playlist.userId !== user.id) {
        return res.status(404).json({ message: "Playlist not found" });
      }
      await storage.deletePlaylist(id);
      res.json({ message: "Playlist deleted" });
    } catch (error) {
      console.error("Delete playlist error:", error);
      res.status(500).json({ message: "Failed to delete playlist" });
    }
  });
  app2.get("/api/playlists/:id/tracks", authMiddleware, async (req, res) => {
    try {
      const user = req.user;
      const { id } = req.params;
      const playlist = await storage.getPlaylist(id);
      if (!playlist || playlist.userId !== user.id) {
        return res.status(404).json({ message: "Playlist not found" });
      }
      const tracks = await storage.getPlaylistTracks(id);
      const tracksWithUrls = tracks.map((track) => ({
        ...track,
        fileUrl: track.fileUrl && !track.fileUrl.startsWith("/api/audio/") ? `/api/audio/${track.fileUrl}` : track.fileUrl
      }));
      res.json(tracksWithUrls);
    } catch (error) {
      console.error("Get playlist tracks error:", error);
      res.status(500).json({ message: "Failed to get playlist tracks" });
    }
  });
  app2.post("/api/playlists/:id/tracks", authMiddleware, async (req, res) => {
    try {
      const user = req.user;
      const { id } = req.params;
      const { trackId } = req.body;
      const playlist = await storage.getPlaylist(id);
      if (!playlist || playlist.userId !== user.id) {
        return res.status(404).json({ message: "Playlist not found" });
      }
      const playlistTrack = await storage.addTrackToPlaylist(id, trackId);
      res.json(playlistTrack);
    } catch (error) {
      console.error("Add track to playlist error:", error);
      res.status(500).json({ message: "Failed to add track to playlist" });
    }
  });
  app2.delete("/api/playlists/:playlistId/tracks/:trackId", authMiddleware, async (req, res) => {
    try {
      const user = req.user;
      const { playlistId, trackId } = req.params;
      const playlist = await storage.getPlaylist(playlistId);
      if (!playlist || playlist.userId !== user.id) {
        return res.status(404).json({ message: "Playlist not found" });
      }
      await storage.removeTrackFromPlaylist(playlistId, trackId);
      res.json({ message: "Track removed from playlist" });
    } catch (error) {
      console.error("Remove track from playlist error:", error);
      res.status(500).json({ message: "Failed to remove track from playlist" });
    }
  });
  app2.get("/api/favorites", authMiddleware, async (req, res) => {
    try {
      const user = req.user;
      const favorites2 = await storage.getUserFavorites(user.id);
      const favoritesWithUrls = favorites2.map((track) => ({
        ...track,
        fileUrl: track.fileUrl && !track.fileUrl.startsWith("/api/audio/") ? `/api/audio/${track.fileUrl}` : track.fileUrl
      }));
      res.json(favoritesWithUrls);
    } catch (error) {
      console.error("Get favorites error:", error);
      res.status(500).json({ message: "Failed to get favorites" });
    }
  });
  app2.post("/api/favorites/:trackId", authMiddleware, async (req, res) => {
    try {
      const user = req.user;
      const { trackId } = req.params;
      const favorite = await storage.addFavorite(user.id, trackId);
      res.json(favorite);
    } catch (error) {
      console.error("Add favorite error:", error);
      res.status(500).json({ message: "Failed to add favorite" });
    }
  });
  app2.delete("/api/favorites/:trackId", authMiddleware, async (req, res) => {
    try {
      const user = req.user;
      const { trackId } = req.params;
      await storage.removeFavorite(user.id, trackId);
      res.json({ message: "Favorite removed" });
    } catch (error) {
      console.error("Remove favorite error:", error);
      res.status(500).json({ message: "Failed to remove favorite" });
    }
  });
  app2.get("/api/stripe/publishable-key", async (req, res) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error) {
      console.error("Get Stripe key error:", error);
      res.status(500).json({ message: "Failed to get Stripe key" });
    }
  });
  app2.post("/api/checkout", authMiddleware, async (req, res) => {
    try {
      const user = req.user;
      const stripe = await getUncachableStripeClient();
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: { userId: user.id }
        });
        customerId = customer.id;
        await storage.updateUserStripeInfo(user.id, { stripeCustomerId: customerId });
      }
      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
      const STRIPE_PRODUCT_ID = "prod_UHEEX07B2s2U5m";
      const EXPECTED_AMOUNT = 499;
      const EXPECTED_CURRENCY = "usd";
      const EXPECTED_INTERVAL = "month";
      const isProduction = process.env.REPLIT_DEPLOYMENT === "1";
      let priceId;
      try {
        const prices = await stripe.prices.list({
          product: STRIPE_PRODUCT_ID,
          active: true,
          limit: 10
        });
        const match = prices.data.find(
          (p) => p.unit_amount === EXPECTED_AMOUNT && p.currency === EXPECTED_CURRENCY && p.recurring?.interval === EXPECTED_INTERVAL
        );
        priceId = match?.id;
      } catch (lookupErr) {
        console.warn("Stripe product lookup failed:", lookupErr.message);
        if (isProduction) {
          return res.status(500).json({ message: "Subscription product not configured" });
        }
      }
      if (!priceId && isProduction) {
        return res.status(500).json({ message: "No matching subscription price found" });
      }
      if (!priceId) {
        console.log("[Dev] Primary product not found; searching by name as fallback");
        const products = await stripe.products.list({ active: true });
        const existing = products.data.find(
          (p) => p.name === "Beat Haven Premium Subscription"
        );
        if (existing) {
          const prices = await stripe.prices.list({
            product: existing.id,
            active: true,
            limit: 10
          });
          const match = prices.data.find(
            (p) => p.unit_amount === EXPECTED_AMOUNT && p.currency === EXPECTED_CURRENCY && p.recurring?.interval === EXPECTED_INTERVAL
          );
          priceId = match?.id;
        }
        if (!priceId) {
          console.log("[Dev] No matching price found; creating product and price for test environment");
          const product = existing ?? await stripe.products.create({
            name: "Beat Haven Premium Subscription",
            description: "Your personal meditation sanctuary. Immerse yourself in programmatically-tuned binaural beats to sleep deeper, focus sharper, and find your calm."
          });
          const price = await stripe.prices.create({
            product: product.id,
            unit_amount: EXPECTED_AMOUNT,
            currency: EXPECTED_CURRENCY,
            recurring: { interval: EXPECTED_INTERVAL }
          });
          priceId = price.id;
          console.log("[Dev] Created Stripe price:", priceId, "for product:", product.id);
        }
      }
      console.log("Checkout using price:", priceId);
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [
          {
            price: priceId,
            quantity: 1
          }
        ],
        mode: "subscription",
        success_url: `${baseUrl}?checkout=success`,
        cancel_url: `${baseUrl}?checkout=cancelled`,
        subscription_data: {
          trial_period_days: 7
        }
      });
      res.json({ url: session.url });
    } catch (error) {
      console.error("Checkout error:", error);
      res.status(500).json({ message: "Failed to create checkout session" });
    }
  });
  app2.post("/api/sync-subscription", authMiddleware, async (req, res) => {
    try {
      const user = req.user;
      if (!user.stripeCustomerId) {
        return res.json({ subscriptionStatus: user.subscriptionStatus || "inactive" });
      }
      const stripe = await getUncachableStripeClient();
      const subscriptions = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        status: "all",
        limit: 5
      });
      const activeSub = subscriptions.data.find(
        (s) => s.status === "active" || s.status === "trialing"
      );
      if (activeSub) {
        await storage.updateUserStripeInfo(user.id, {
          stripeSubscriptionId: activeSub.id,
          subscriptionStatus: "active"
        });
        console.log("[Sync] Subscription synced to active for user:", user.id, "sub:", activeSub.id);
        return res.json({ subscriptionStatus: "active" });
      }
      const cancelledOrPast = subscriptions.data.find(
        (s) => s.status === "canceled" || s.status === "past_due" || s.status === "unpaid"
      );
      if (cancelledOrPast && user.subscriptionStatus === "active") {
        await storage.updateUserStripeInfo(user.id, {
          subscriptionStatus: "inactive"
        });
        console.log("[Sync] Subscription synced to inactive for user:", user.id);
        return res.json({ subscriptionStatus: "inactive" });
      }
      return res.json({ subscriptionStatus: user.subscriptionStatus || "inactive" });
    } catch (error) {
      console.error("Sync subscription error:", error.message);
      return res.json({ subscriptionStatus: req.user?.subscriptionStatus || "inactive" });
    }
  });
  app2.post("/api/billing-portal", authMiddleware, async (req, res) => {
    try {
      const user = req.user;
      if (!user.stripeCustomerId) {
        return res.status(400).json({ message: "No subscription found" });
      }
      const stripe = await getUncachableStripeClient();
      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: baseUrl
      });
      res.json({ url: session.url });
    } catch (error) {
      console.error("Billing portal error:", error);
      res.status(500).json({ message: "Failed to create billing portal session" });
    }
  });
  app2.post("/api/admin/tracks", adminMiddleware, upload.single("audio"), async (req, res) => {
    try {
      const { title, description, frequency, category, duration } = req.body;
      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: "Audio file is required" });
      }
      if (!title || !frequency || !category || !duration) {
        return res.status(400).json({ message: "Title, frequency, category, and duration are required" });
      }
      const validCategories = ["Delta", "Theta", "Alpha", "Beta", "Gamma"];
      if (!validCategories.includes(category)) {
        return res.status(400).json({ message: "Invalid category" });
      }
      const fileUrl = await uploadAudioFile(file.originalname, file.buffer);
      const track = await storage.createTrack({
        title,
        description: description || null,
        frequency,
        category,
        duration: parseInt(duration, 10),
        fileUrl,
        thumbnailUrl: null
      });
      res.json(track);
    } catch (error) {
      console.error("Admin upload track error:", error);
      res.status(500).json({ message: "Failed to upload track" });
    }
  });
  app2.delete("/api/admin/tracks/:id", adminMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteTrack(id);
      res.json({ message: "Track deleted" });
    } catch (error) {
      console.error("Admin delete track error:", error);
      res.status(500).json({ message: "Failed to delete track" });
    }
  });
  app2.get("/api/quotes/random", async (_req, res) => {
    try {
      const result = await db.execute(sql3`SELECT * FROM quotes ORDER BY RANDOM() LIMIT 1`);
      if (result.rows.length === 0) {
        return res.json({ text: "Find your inner peace.", author: null });
      }
      res.json(result.rows[0]);
    } catch (error) {
      console.error("Random quote error:", error);
      res.json({ text: "Find your inner peace.", author: null });
    }
  });
  app2.get("/api/health/storage", async (_req, res) => {
    try {
      const result = await testStorageConnectivity();
      res.json({
        status: result.bytesOk ? "ok" : "degraded",
        bytesAccess: result.bytesOk,
        streamAccess: result.streamOk,
        error: result.error || null
      });
    } catch (error) {
      console.error("[Health] Storage check error:", error);
      res.status(500).json({ status: "error", error: error.message });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/webhookHandlers.ts
var WebhookHandlers = class {
  static async processWebhook(payload, signature) {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        "STRIPE WEBHOOK ERROR: Payload must be a Buffer. Received type: " + typeof payload + ". This usually means express.json() parsed the body before reaching this handler. FIX: Ensure webhook route is registered BEFORE app.use(express.json())."
      );
    }
    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);
  }
};

// server/seedTracks.ts
var TRACKS = [
  {
    id: "98810a89-d3ab-4b62-9077-242a019b50f5",
    title: "Alpha Beta Border",
    description: null,
    frequency: "235Hz base, 12Hz beat",
    category: "Alpha",
    duration: 1800,
    fileUrl: "Alpha/AlphaBinauralBeat_235_12-0_AlphaBetaBorder.wav",
    thumbnailUrl: null
  },
  {
    id: "b8c1bf98-fe3b-4b3a-98fc-eae9958f34a0",
    title: "General Relaxation",
    description: null,
    frequency: "205Hz base, 10Hz beat",
    category: "Alpha",
    duration: 1800,
    fileUrl: "Alpha/AlphaBinauralBeat_205_10-0_GeneralRelaxation.wav",
    thumbnailUrl: null
  },
  {
    id: "5aa11871-0bf2-4276-b55b-e8cb64d936d6",
    title: "Grounding",
    description: null,
    frequency: "225Hz base, 11.5Hz beat",
    category: "Alpha",
    duration: 1800,
    fileUrl: "Alpha/AlphaBinauralBeat_225_11-5_Grounding.wav",
    thumbnailUrl: null
  },
  {
    id: "e79bfae9-8f1c-4615-84df-6229c4840cd1",
    title: "Light Meditation",
    description: null,
    frequency: "190Hz base, 8.5Hz beat",
    category: "Alpha",
    duration: 1800,
    fileUrl: "Alpha/AlphaBinauralBeat_190_8-5_LightMeditation.wav",
    thumbnailUrl: null
  },
  {
    id: "8fc39a7f-4a1a-4ff7-aeb3-82cafab2f747",
    title: "Mind & Body",
    description: null,
    frequency: "210Hz base, 10.5Hz beat",
    category: "Alpha",
    duration: 1800,
    fileUrl: "Alpha/AlphaBinauralBeat_210_10-5_Mind%26Body.wav",
    thumbnailUrl: null
  },
  {
    id: "fc569d1b-7c57-47bc-8b0e-c6a5b1aa4ec3",
    title: "Positive Thinking",
    description: null,
    frequency: "215Hz base, 11Hz beat",
    category: "Alpha",
    duration: 1800,
    fileUrl: "Alpha/AlphaBinauralBeat_215_11-0_PositiveThinking.wav",
    thumbnailUrl: null
  },
  {
    id: "32bb1f18-8d47-4b97-8a86-ebf1e5b396bd",
    title: "Problem Solving",
    description: null,
    frequency: "220Hz base, 11.3Hz beat",
    category: "Alpha",
    duration: 1800,
    fileUrl: "Alpha/AlphaBinauralBeat_220_11-3_ProblemSolving.wav",
    thumbnailUrl: null
  },
  {
    id: "27b21daf-9737-4ba1-8590-e7715eab3649",
    title: "Serotonin Release",
    description: null,
    frequency: "230Hz base, 11.8Hz beat",
    category: "Alpha",
    duration: 1800,
    fileUrl: "Alpha/AlphaBinauralBeat_230_11-8_SerotoninRelease.wav",
    thumbnailUrl: null
  },
  {
    id: "455e7877-d629-4c9d-a83a-f2380dadea1f",
    title: "Stress Reduction",
    description: null,
    frequency: "195Hz base, 9Hz beat",
    category: "Alpha",
    duration: 1800,
    fileUrl: "Alpha/AlphaBinauralBeat_195_9-0_StressReduction.wav",
    thumbnailUrl: null
  },
  {
    id: "51842208-e2a1-4ac7-b430-c4c9d3f7bf14",
    title: "The Zone",
    description: null,
    frequency: "200Hz base, 9.5Hz beat",
    category: "Alpha",
    duration: 1800,
    fileUrl: "Alpha/AlphaBinauralBeat_200_9-5_TheZone.wav",
    thumbnailUrl: null
  },
  {
    id: "2bb61685-4448-4256-9f96-3de00f2f5b7c",
    title: "Beta Gamma Border",
    description: null,
    frequency: "303Hz base, 30Hz beat",
    category: "Beta",
    duration: 1800,
    fileUrl: "Beta/BetaBinauralBeat_303_30-0_BetaGammaBorder.wav",
    thumbnailUrl: null
  },
  {
    id: "2ca9461d-7cbd-4a1d-a818-f3554d710c63",
    title: "Brain Performance",
    description: null,
    frequency: "296Hz base, 27Hz beat",
    category: "Beta",
    duration: 1800,
    fileUrl: "Beta/BetaBinauralBeat_296_27-0_BrainPerformance.wav",
    thumbnailUrl: null
  },
  {
    id: "ac4b7dee-e1cb-4aed-b35f-c693b0e4ceac",
    title: "Cognitive Processing",
    description: null,
    frequency: "254Hz base, 15Hz beat",
    category: "Beta",
    duration: 1800,
    fileUrl: "Beta/BetaBinauralBeat_254_15-0_CognitiveProcessing.wav",
    thumbnailUrl: null
  },
  {
    id: "b4efca46-1d32-49ae-aa44-2ea740b0b47b",
    title: "Complex Memory",
    description: null,
    frequency: "282Hz base, 22Hz beat",
    category: "Beta",
    duration: 1800,
    fileUrl: "Beta/BetaBinauralBeat_282_22-0_ComplexMemory.wav",
    thumbnailUrl: null
  },
  {
    id: "ff7a6ec1-4a3c-40e1-8f75-f554cd499a1e",
    title: "Fast Thinking",
    description: null,
    frequency: "289Hz base, 24Hz beat",
    category: "Beta",
    duration: 1800,
    fileUrl: "Beta/BetaBinauralBeat_289_24-0_FastThinking.wav",
    thumbnailUrl: null
  },
  {
    id: "29db2d7b-8bd7-4e0c-8769-6f90dbce56ef",
    title: "Focused Study",
    description: null,
    frequency: "240Hz base, 13Hz beat",
    category: "Beta",
    duration: 1800,
    fileUrl: "Beta/BetaBinauralBeat_240_13-0_FocusedStudy.wav",
    thumbnailUrl: null
  },
  {
    id: "45bd965a-f5d4-47b6-b0e1-36f0be3b1158",
    title: "High Alertness",
    description: null,
    frequency: "268Hz base, 18Hz beat",
    category: "Beta",
    duration: 1800,
    fileUrl: "Beta/BetaBinauralBeat_268_18-0_HighAlertness.wav",
    thumbnailUrl: null
  },
  {
    id: "162af6d4-c221-46bd-9704-d124e80eb154",
    title: "Logic & Reasoning",
    description: null,
    frequency: "247Hz base, 14Hz beat",
    category: "Beta",
    duration: 1800,
    fileUrl: "Beta/BetaBinauralBeat_247_14-0_Logic%26Reasoning.wav",
    thumbnailUrl: null
  },
  {
    id: "f52460f9-2244-4060-81f9-1fe05ed6a2e3",
    title: "Mental Energy Boost",
    description: null,
    frequency: "275Hz base, 20Hz beat",
    category: "Beta",
    duration: 1800,
    fileUrl: "Beta/BetaBinauralBeat_275_20-0_MentalEnergyBoost.wav",
    thumbnailUrl: null
  },
  {
    id: "dc6eb432-f0ae-479e-8728-e8b5b8b34ee1",
    title: "Problem Solving",
    description: null,
    frequency: "261Hz base, 16Hz beat",
    category: "Beta",
    duration: 1800,
    fileUrl: "Beta/BetaBinauralBeat_261_16-0_ProblemSolving.wav",
    thumbnailUrl: null
  },
  {
    id: "f0c86ff0-9726-41b3-b616-6a70ea81cb50",
    title: "Anti-Aging",
    description: "Promotes growth hormone release and cellular regeneration",
    frequency: "105Hz base, 2Hz beat",
    category: "Delta",
    duration: 1800,
    fileUrl: "Delta/DeltaBinauralBeat_105_2-0_AntiAging.wav",
    thumbnailUrl: null
  },
  {
    id: "6b6cac7a-4c38-43b0-8d62-b18a603e0c6e",
    title: "Body Regeneration",
    description: "Physical healing and tissue regeneration",
    frequency: "95Hz base, 1Hz beat",
    category: "Delta",
    duration: 1800,
    fileUrl: "Delta/DeltaBinauralBeat_95_1-0_BodyRegeneration.wav",
    thumbnailUrl: null
  },
  {
    id: "68bea7b1-43b4-4eeb-b1e5-82281ec126e5",
    title: "Bridge to Dreaming",
    description: "Transition from deep sleep to dream states",
    frequency: "130Hz base, 3.5Hz beat",
    category: "Delta",
    duration: 1800,
    fileUrl: "Delta/DeltaBinauralBeat_130_3-5_BridgeToDreaming.wav",
    thumbnailUrl: null
  },
  {
    id: "83a1f500-be74-4ca2-84da-87ccc77cc59a",
    title: "Deep Human Consciousness",
    description: "Deepest delta state for profound rest",
    frequency: "90Hz base, 0.5Hz beat",
    category: "Delta",
    duration: 1800,
    fileUrl: "Delta/DeltaBinauralBeat_90_-5_DeepHumanConsciousness.wav",
    thumbnailUrl: null
  },
  {
    id: "8f6594a2-dfce-4567-aab0-81a43e0e6a55",
    title: "Deep Sleep",
    description: "Promotes deep, dreamless sleep states",
    frequency: "110Hz base, 2.5Hz beat",
    category: "Delta",
    duration: 1800,
    fileUrl: "Delta/DeltaBinauralBeat_110_2-5_DeepSleep.wav",
    thumbnailUrl: null
  },
  {
    id: "e644791c-90a7-4c7a-8fe8-2d86fd6390ff",
    title: "Delta-Theta Border",
    description: "Boundary state between deep sleep and dreaming",
    frequency: "135Hz base, 4Hz beat",
    category: "Delta",
    duration: 1800,
    fileUrl: "Delta/DeltaBinauralBeat_135_4-0_DeltaThetaBorder.wav",
    thumbnailUrl: null
  },
  {
    id: "0b7c60dd-0574-45b1-838c-b00c9d6aa92f",
    title: "Dreamless Void",
    description: "Deep unconscious state for maximum rest",
    frequency: "120Hz base, 3Hz beat",
    category: "Delta",
    duration: 1800,
    fileUrl: "Delta/DeltaBinauralBeat_120_3-0_DreamlessVoid.wav",
    thumbnailUrl: null
  },
  {
    id: "37146fe0-6e8e-417a-bffb-6a39a873ff3a",
    title: "Immune System Support",
    description: "Supports immune system function during rest",
    frequency: "115Hz base, 2.8Hz beat",
    category: "Delta",
    duration: 1800,
    fileUrl: "Delta/DeltaBinauralBeat_115_2-8_ImmuneSystemSupport.wav",
    thumbnailUrl: null
  },
  {
    id: "e4e627d7-8f2d-4f55-b911-54e8ae9fa947",
    title: "Pain Relief",
    description: "Natural pain relief through deep relaxation",
    frequency: "125Hz base, 3.2Hz beat",
    category: "Delta",
    duration: 1800,
    fileUrl: "Delta/DeltaBinauralBeat_125_3-2_PainRelief.wav",
    thumbnailUrl: null
  },
  {
    id: "b48c0f02-dd3e-416d-a3c4-ccb16da40443",
    title: "Restorative Sleep",
    description: "Deep restorative sleep and cellular repair",
    frequency: "100Hz base, 1.5Hz beat",
    category: "Delta",
    duration: 1800,
    fileUrl: "Delta/DeltaBinauralBeat_100_1-5_RestorativeSleep.wav",
    thumbnailUrl: null
  },
  {
    id: "41fd18b1-b53f-486c-b809-e4c43d41b4d0",
    title: "Advanced Perception",
    description: null,
    frequency: "390Hz base, 48Hz beat",
    category: "Gamma",
    duration: 1800,
    fileUrl: "Gamma/GammaBinauralBeat_390_48-0_AdvancedPerception.wav",
    thumbnailUrl: null
  },
  {
    id: "2eda635f-b7ed-4cf3-9e5a-ef7a42bd6dea",
    title: "Brain Coherence",
    description: null,
    frequency: "380Hz base, 46Hz beat",
    category: "Gamma",
    duration: 1800,
    fileUrl: "Gamma/GammaBinauralBeat_380_46-0_BrainCoherence.wav",
    thumbnailUrl: null
  },
  {
    id: "7b10c7c1-ddab-44a2-94ca-d374bf99a5bb",
    title: "God Frequency",
    description: null,
    frequency: "350Hz base, 40Hz beat",
    category: "Gamma",
    duration: 1800,
    fileUrl: "Gamma/GammaBinauralBeat_350_40-0_GodFrequency.wav",
    thumbnailUrl: null
  },
  {
    id: "614df82c-1b82-4057-a6f6-791fcf4a31f3",
    title: "High Cognition",
    description: null,
    frequency: "370Hz base, 44Hz beat",
    category: "Gamma",
    duration: 1800,
    fileUrl: "Gamma/GammaBinauralBeat_370_44-0_HighCognition.wav",
    thumbnailUrl: null
  },
  {
    id: "21f8ca4c-0e2e-4446-9b04-09a6e859ebd1",
    title: "Hyper Focus",
    description: null,
    frequency: "340Hz base, 38Hz beat",
    category: "Gamma",
    duration: 1800,
    fileUrl: "Gamma/GammaBinauralBeat_340_38-0_HyperFocus.wav",
    thumbnailUrl: null
  },
  {
    id: "cf52740d-51f3-4aad-90d9-4a8af9d991a3",
    title: "Information Synthesis",
    description: null,
    frequency: "330Hz base, 35Hz beat",
    category: "Gamma",
    duration: 1800,
    fileUrl: "Gamma/GammaBinauralBeat_330_35-0_InformationSynthesis.wav",
    thumbnailUrl: null
  },
  {
    id: "dba94370-2ee1-48ac-9ee9-0df6f35d1d4f",
    title: "Intense Awareness",
    description: null,
    frequency: "400Hz base, 49Hz beat",
    category: "Gamma",
    duration: 1800,
    fileUrl: "Gamma/GammaBinauralBeat_400_49-0_IntenseAwareness.wav",
    thumbnailUrl: null
  },
  {
    id: "bdee914b-d1c7-4ca7-9600-03a3cbfd9149",
    title: "Maximum Entrainment",
    description: null,
    frequency: "410Hz base, 50Hz beat",
    category: "Gamma",
    duration: 1800,
    fileUrl: "Gamma/GammaBinauralBeat_410_50-0_MaximumEntrainment.wav",
    thumbnailUrl: null
  },
  {
    id: "58d06c59-e498-4d81-a7fb-7037defe54ac",
    title: "Memory Retrieval",
    description: null,
    frequency: "360Hz base, 42Hz beat",
    category: "Gamma",
    duration: 1800,
    fileUrl: "Gamma/GammaBinauralBeat_360_42-0_MemoryRetrieval.wav",
    thumbnailUrl: null
  },
  {
    id: "d90eb072-997e-4653-a983-4c1d69da36ee",
    title: "Peak Concentration",
    description: null,
    frequency: "320Hz base, 32Hz beat",
    category: "Gamma",
    duration: 1800,
    fileUrl: "Gamma/BetaBinauralBeat_320_32-0_PeakConcentration.wav",
    thumbnailUrl: null
  },
  {
    id: "a8e7d05e-c76e-4a6b-aeef-f032764cb7ae",
    title: "Astral Projection",
    description: null,
    frequency: "160Hz base, 6.3Hz beat",
    category: "Theta",
    duration: 1800,
    fileUrl: "Theta/ThetaBinauralBeat_160_6-3_AstralProjection.wav",
    thumbnailUrl: null
  },
  {
    id: "a88eabbc-4cb0-4772-a3d0-03aa0b304a1c",
    title: "Creative Visualization",
    description: null,
    frequency: "175Hz base, 7.5Hz beat",
    category: "Theta",
    duration: 1800,
    fileUrl: "Theta/ThetaBinauralBeat_175_7-5_CreativeVisualization.wav",
    thumbnailUrl: null
  },
  {
    id: "561534c8-243f-4787-a467-7295ab1abbbc",
    title: "Deep Memory Access",
    description: null,
    frequency: "155Hz base, 6Hz beat",
    category: "Theta",
    duration: 1800,
    fileUrl: "Theta/ThetaBinauralBeat_155_6-0_DeepMemoryAccess.wav",
    thumbnailUrl: null
  },
  {
    id: "746001a2-67cc-44fd-a8cc-aa297eeadd22",
    title: "Deep Mental Relaxation",
    description: null,
    frequency: "170Hz base, 7Hz beat",
    category: "Theta",
    duration: 1800,
    fileUrl: "Theta/ThetaBinauralBeat_170_7-0_DeepMentalRelaxation.wav",
    thumbnailUrl: null
  },
  {
    id: "0278cc6c-9f30-4226-9a6a-088b7c06fa57",
    title: "Earths Heartbeat",
    description: null,
    frequency: "180Hz base, 7.8Hz beat",
    category: "Theta",
    duration: 1800,
    fileUrl: "Theta/ThetaBinauralBeat_180_7-8_EarthsHeartbeat.wav",
    thumbnailUrl: null
  },
  {
    id: "00ec6918-89fa-45df-8cd8-eb031c2acf16",
    title: "Emotional Processing",
    description: null,
    frequency: "165Hz base, 6.8Hz beat",
    category: "Theta",
    duration: 1800,
    fileUrl: "Theta/ThetaBinauralBeat_165_6-8_EmotionalProcessing.wav",
    thumbnailUrl: null
  },
  {
    id: "43aa3dc5-7573-42e5-8d33-8133d090a789",
    title: "Hypnagogic Induction",
    description: null,
    frequency: "145Hz base, 5Hz beat",
    category: "Theta",
    duration: 1800,
    fileUrl: "Theta/ThetaBinauralBeat_145_5-0_HypnagogicInduction.wav",
    thumbnailUrl: null
  },
  {
    id: "e34af5d5-8a4a-42f7-bbc5-548cf0bae0c0",
    title: "Inner Zen",
    description: null,
    frequency: "150Hz base, 5.5Hz beat",
    category: "Theta",
    duration: 1800,
    fileUrl: "Theta/ThetaBinauralBeat_150_5-5_InnerZen.wav",
    thumbnailUrl: null
  },
  {
    id: "09fe78e7-8c26-4cb5-a8a5-ba5ce7784b7b",
    title: "Shamanic Astral State",
    description: null,
    frequency: "140Hz base, 4.5Hz beat",
    category: "Theta",
    duration: 1800,
    fileUrl: "Theta/ThetaBinauralBeat_140_4-5_ShamanicAstralState.wav",
    thumbnailUrl: null
  },
  {
    id: "518347a7-8217-4646-8d29-dacf5ae918b0",
    title: "Theta Alpha Border",
    description: null,
    frequency: "185Hz base, 8Hz beat",
    category: "Theta",
    duration: 1800,
    fileUrl: "Theta/ThetaBinauralBeat_185_8-0_ThetaAlphaBorder.wav",
    thumbnailUrl: null
  }
];
async function seedTracks() {
  try {
    const inserted = await db.insert(audioTracks).values(TRACKS).onConflictDoNothing({ target: audioTracks.id }).returning({ id: audioTracks.id });
    const skipped = TRACKS.length - inserted.length;
    console.log(
      `[Tracks] Seeded ${inserted.length} new tracks, ${skipped} already present`
    );
  } catch (err) {
    console.error("[Tracks] Failed to seed tracks:", err);
  }
}

// server/generateMissingTracks.ts
import { Client as Client2 } from "@replit/object-storage";
var client2 = new Client2();
var SAMPLE_RATE = 22050;
var DURATION_SEC = 1800;
var FADE_SEC = 2;
var MIN_VALID_SIZE = 10 * 1024 * 1024;
function createBinauralWav(baseHz, beatHz) {
  const numSamples = SAMPLE_RATE * DURATION_SEC;
  const numChannels = 2;
  const bitsPerSample = 16;
  const blockAlign = numChannels * (bitsPerSample / 8);
  const byteRate = SAMPLE_RATE * blockAlign;
  const dataSize = numSamples * blockAlign;
  const fileSize = 44 + dataSize;
  const buffer = Buffer.alloc(fileSize);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(fileSize - 8, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataSize, 40);
  const fadeLen = Math.floor(SAMPLE_RATE * FADE_SEC);
  const rightHz = baseHz + beatHz;
  const leftPhaseInc = 2 * Math.PI * baseHz / SAMPLE_RATE;
  const rightPhaseInc = 2 * Math.PI * rightHz / SAMPLE_RATE;
  let leftPhase = 0;
  let rightPhase = 0;
  for (let i = 0; i < numSamples; i++) {
    let left = Math.sin(leftPhase);
    let right = Math.sin(rightPhase);
    let envelope = 1;
    if (i < fadeLen) {
      envelope = i / fadeLen;
    } else if (i >= numSamples - fadeLen) {
      envelope = (numSamples - i) / fadeLen;
    }
    left *= envelope * 0.8;
    right *= envelope * 0.8;
    const leftSample = Math.round(Math.max(-1, Math.min(1, left)) * 32767);
    const rightSample = Math.round(Math.max(-1, Math.min(1, right)) * 32767);
    const offset = 44 + i * blockAlign;
    buffer.writeInt16LE(leftSample, offset);
    buffer.writeInt16LE(rightSample, offset + 2);
    leftPhase += leftPhaseInc;
    rightPhase += rightPhaseInc;
    if (leftPhase > 2 * Math.PI) leftPhase -= 2 * Math.PI;
    if (rightPhase > 2 * Math.PI) rightPhase -= 2 * Math.PI;
  }
  return buffer;
}
var MISSING_TRACKS = [
  {
    objectPath: "Alpha/AlphaBinauralBeat_200_9-5_TheZone.wav",
    baseHz: 200,
    beatHz: 9.5,
    label: "The Zone (Alpha)"
  },
  {
    objectPath: "Beta/BetaBinauralBeat_296_27-0_BrainPerformance.wav",
    baseHz: 296,
    beatHz: 27,
    label: "Brain Performance (Beta)"
  }
];
async function ensureMissingTracksExist() {
  for (const track of MISSING_TRACKS) {
    try {
      const check = await client2.downloadAsBytes(track.objectPath);
      if (check.ok && check.value[0].length >= MIN_VALID_SIZE) {
        preCacheFileSize(track.objectPath, check.value[0].length);
        console.log(`[Audio] ${track.label} already present (${(check.value[0].length / 1024 / 1024).toFixed(0)} MB), skipping`);
        continue;
      }
      console.log(`[Audio] Generating ${track.label} (30 min, 22050 Hz)...`);
      const wav = createBinauralWav(track.baseHz, track.beatHz);
      console.log(`[Audio] Uploading ${track.objectPath} (${(wav.length / 1024 / 1024).toFixed(0)} MB)...`);
      await client2.uploadFromBytes(track.objectPath, wav);
      console.log(`[Audio] Done: ${track.objectPath}`);
    } catch (err) {
      console.error(`[Audio] Failed to ensure ${track.label}:`, err);
    }
  }
}

// server/index.ts
import * as fs from "fs";
import * as path from "path";
var app = express();
var log = console.log;
function setupCors(app2) {
  app2.use((req, res, next) => {
    const origins = /* @__PURE__ */ new Set();
    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }
    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
      });
    }
    const origin = req.header("origin");
    const isLocalhost = origin?.startsWith("http://localhost:") || origin?.startsWith("http://127.0.0.1:");
    if (origin && (origins.has(origin) || isLocalhost)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
      );
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.header("Access-Control-Allow-Credentials", "true");
    }
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
}
function setupStripeWebhook(app2) {
  app2.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      const signature = req.headers["stripe-signature"];
      if (!signature) {
        return res.status(400).json({ error: "Missing stripe-signature" });
      }
      try {
        const sig = Array.isArray(signature) ? signature[0] : signature;
        if (!Buffer.isBuffer(req.body)) {
          console.error("STRIPE WEBHOOK ERROR: req.body is not a Buffer");
          return res.status(500).json({ error: "Webhook processing error" });
        }
        await WebhookHandlers.processWebhook(req.body, sig);
        res.status(200).json({ received: true });
      } catch (error) {
        console.error("Webhook error:", error.message);
        res.status(400).json({ error: "Webhook processing error" });
      }
    }
  );
}
function setupBodyParsing(app2) {
  app2.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );
  app2.use(express.urlencoded({ extended: false }));
}
function setupRequestLogging(app2) {
  app2.use((req, res, next) => {
    const start = Date.now();
    const path2 = req.path;
    let capturedJsonResponse = void 0;
    const originalResJson = res.json;
    res.json = function(bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
    res.on("finish", () => {
      if (!path2.startsWith("/api")) return;
      const duration = Date.now() - start;
      let logLine = `${req.method} ${path2} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    });
    next();
  });
}
function getAppName() {
  try {
    const appJsonPath = path.resolve(process.cwd(), "app.json");
    const appJsonContent = fs.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}
function serveExpoManifest(platform, res) {
  const manifestPath = path.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json"
  );
  if (!fs.existsSync(manifestPath)) {
    return res.status(404).json({ error: `Manifest not found for platform: ${platform}` });
  }
  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");
  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.send(manifest);
}
function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;
  log(`baseUrl`, baseUrl);
  log(`expsUrl`, expsUrl);
  const html = landingPageTemplate.replace(/BASE_URL_PLACEHOLDER/g, baseUrl).replace(/EXPS_URL_PLACEHOLDER/g, expsUrl).replace(/APP_NAME_PLACEHOLDER/g, appName);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
function configureExpoAndLanding(app2) {
  const templatePath = path.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html"
  );
  const landingPageTemplate = fs.readFileSync(templatePath, "utf-8");
  const appName = getAppName();
  const webIndexPath = path.resolve(
    process.cwd(),
    "static-build",
    "web",
    "index.html"
  );
  const hasWebBuild = fs.existsSync(webIndexPath);
  if (hasWebBuild) {
    log("Web build found \u2014 serving web app at /");
  } else {
    log("No web build found \u2014 serving Expo Go landing page at /");
  }
  log("Serving static Expo files with dynamic manifest routing");
  app2.use((_req, res, next) => {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; media-src 'self' blob: https:; connect-src 'self' https: wss:; frame-src 'self' https:; worker-src 'self' blob:;"
    );
    next();
  });
  app2.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    if (req.path !== "/" && req.path !== "/manifest") {
      return next();
    }
    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      return serveExpoManifest(platform, res);
    }
    if (req.path === "/") {
      if (hasWebBuild) {
        return res.sendFile(webIndexPath);
      }
      return serveLandingPage({
        req,
        res,
        landingPageTemplate,
        appName
      });
    }
    next();
  });
  app2.use("/assets", express.static(path.resolve(process.cwd(), "assets")));
  if (hasWebBuild) {
    app2.use(
      express.static(path.resolve(process.cwd(), "static-build", "web"))
    );
  }
  app2.use(express.static(path.resolve(process.cwd(), "static-build")));
  app2.get("/{*path}", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    if (hasWebBuild) {
      return res.sendFile(webIndexPath);
    }
    next();
  });
  log("Expo routing: Checking expo-platform header on / and /manifest");
}
function setupErrorHandler(app2) {
  app2.use((err, _req, res, next) => {
    const error = err;
    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) {
      return next(err);
    }
    return res.status(status).json({ message });
  });
}
(async () => {
  setupCors(app);
  setupStripeWebhook(app);
  setupBodyParsing(app);
  setupRequestLogging(app);
  configureExpoAndLanding(app);
  const server = await registerRoutes(app);
  await seedDemoUser();
  await seedTracks();
  await ensureMissingTracksExist();
  setupErrorHandler(app);
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true
    },
    () => {
      log(`express server serving on port ${port}`);
    }
  );
})();
