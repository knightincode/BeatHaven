import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import * as fs from "fs";
import multer from "multer";
import { storage } from "./storage";
import {
  generateToken,
  hashPassword,
  comparePasswords,
  authenticateToken,
} from "./auth";
import { verifyAppleIdentityToken } from "./appleAuth";
import { verifyGoogleIdToken } from "./googleAuth";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";
import * as path from "path";
import {
  uploadAudioFile,
  getAudioFilePath,
  getAudioStreamOrDisk,
  getCachedFileSize,
  createRangeStream,
  hasInflightDownload,
  objectExists,
  testStorageConnectivity,
} from "./objectStorage";
import { User } from "../shared/schema";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { getDemoUser } from "./demoUser";

const demoRateLimit = new Map<string, { count: number; resetAt: number }>();

function checkDemoRateLimit(ip: string): boolean {
  const now = Date.now();
  const window = 60_000;
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

const upload = multer({ storage: multer.memoryStorage() });

interface AuthenticatedRequest extends Request {
  user?: User;
}

function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: () => void
) {
  const authHeader = req.headers.authorization;
  authenticateToken(authHeader).then((user) => {
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    req.user = user;
    next();
  });
}

function adminMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: () => void
) {
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

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/auth/register", async (req: Request, res: Response) => {
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
          subscriptionStatus: user.subscriptionStatus,
        },
      });
    } catch (error: any) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/auth/apple", async (req: Request, res: Response) => {
    try {
      const { identityToken, email, fullName, mode } = req.body;
      const isSignupMode = mode === "signup";

      if (!identityToken) {
        return res.status(400).json({ message: "Apple identity token is required" });
      }

      let verifiedPayload;
      try {
        verifiedPayload = await verifyAppleIdentityToken(identityToken);
      } catch (verifyError: any) {
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
            authProvider: existingEmailUser.authProvider === "email" ? "apple" : existingEmailUser.authProvider,
          });
          user = (await storage.getUser(existingEmailUser.id))!;
        } else {
          user = await storage.createUser(userEmail, null, {
            authProvider: "apple",
            appleUserId,
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
          subscriptionStatus: user.subscriptionStatus,
        },
      });
    } catch (error: any) {
      console.error("Apple auth error:", error);
      res.status(500).json({ message: "Apple authentication failed" });
    }
  });

  app.post("/api/auth/google", async (req: Request, res: Response) => {
    try {
      const { idToken, mode } = req.body;
      const isSignupMode = mode === "signup";

      if (!idToken) {
        return res.status(400).json({ message: "Google ID token is required" });
      }

      let verifiedPayload;
      try {
        verifiedPayload = await verifyGoogleIdToken(idToken);
      } catch (verifyError: any) {
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

        const existingEmailUser = (emailVerified && verifiedEmail) ? await storage.getUserByEmail(userEmail) : null;
        if (existingEmailUser) {
          if (isSignupMode) {
            return res.status(409).json({ message: "You already have an account with this Google account. Please sign in instead." });
          }
          console.log(`[Google Auth] Linking to existing email user: ${existingEmailUser.id} (${existingEmailUser.email})`);
          await storage.updateUser(existingEmailUser.id, {
            googleUserId,
            authProvider: existingEmailUser.authProvider === "email" ? "google" : existingEmailUser.authProvider,
          });
          user = (await storage.getUser(existingEmailUser.id))!;
        } else {
          console.log(`[Google Auth] Creating new user with email: ${userEmail}`);
          user = await storage.createUser(userEmail, null, {
            authProvider: "google",
            googleUserId,
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
          subscriptionStatus: user.subscriptionStatus,
        },
      });
    } catch (error: any) {
      console.error("Google auth error:", error);
      res.status(500).json({ message: "Google authentication failed" });
    }
  });

  app.post("/api/auth/demo", async (req: Request, res: Response) => {
    try {
      const ip =
        (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
        req.socket.remoteAddress ||
        "unknown";

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
          subscriptionStatus: demoUser.subscriptionStatus,
        },
      });
    } catch (error: any) {
      console.error("Demo auth error:", error);
      res.status(500).json({ message: "Demo login failed" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
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
          subscriptionStatus: user.subscriptionStatus,
        },
      });
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.get("/api/user", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    res.json({
      id: user.id,
      email: user.email,
      isAdmin: user.isAdmin,
      isDemo: user.isDemo,
      subscriptionStatus: user.subscriptionStatus,
    });
  });

  app.put("/api/user/update", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const { email, currentPassword, newPassword } = req.body;

      const updates: Partial<User> = {};

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
    } catch (error: any) {
      console.error("Update error:", error);
      res.status(500).json({ message: "Update failed" });
    }
  });

  app.delete("/api/user", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;

      if (user.isDemo) {
        return res.status(403).json({ message: "Demo accounts cannot be deleted" });
      }

      if (user.stripeCustomerId) {
        const stripe = await getUncachableStripeClient();

        const subscriptions = await stripe.subscriptions.list({
          customer: user.stripeCustomerId,
          status: "active",
        });
        for (const sub of subscriptions.data) {
          await stripe.subscriptions.cancel(sub.id);
          console.log("[Delete] Cancelled subscription:", sub.id);
        }

        const trialingSubs = await stripe.subscriptions.list({
          customer: user.stripeCustomerId,
          status: "trialing",
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
    } catch (error: any) {
      console.error("Delete account error:", error);
      res.status(500).json({ message: "Failed to delete account" });
    }
  });

  app.get("/api/tracks", async (req: Request, res: Response) => {
    try {
      const tracks = await storage.getAllTracks();
      
      const tracksWithUrls = tracks.map(track => ({
        ...track,
        fileUrl: `/api/audio/${track.fileUrl}`,
      }));
      
      tracksWithUrls.sort((a, b) => {
        const beatFreqA = parseFloat(a.frequency.match(/(\d+\.?\d*)Hz beat/)?.[1] || "0");
        const beatFreqB = parseFloat(b.frequency.match(/(\d+\.?\d*)Hz beat/)?.[1] || "0");
        return beatFreqA - beatFreqB;
      });
      
      res.json(tracksWithUrls);
    } catch (error: any) {
      console.error("Get tracks error:", error);
      res.status(500).json({ message: "Failed to get tracks" });
    }
  });

  app.head("/api/audio/:folder/:filename", async (req: Request, res: Response) => {
    let objectPath = "";
    try {
      objectPath = decodeURIComponent(`${req.params.folder}/${req.params.filename}`);

      let size = getCachedFileSize(objectPath);

      if (size === undefined) {
        const cachePath = path.join("/tmp/audio-cache", objectPath);
        if (fs.existsSync(cachePath)) {
          const stat = fs.statSync(cachePath);
          if (stat.size > 0) {
            size = stat.size;
          }
        }
      }

      if (size === undefined) {
        const check = await objectExists(objectPath);
        if (check.checkFailed) {
          return res.status(503).end();
        }
        if (!check.exists) {
          return res.status(404).end();
        }
        size = 0;
      }

      res.setHeader("Content-Type", "audio/wav");
      res.setHeader("Accept-Ranges", "bytes");
      if (size > 0) {
        res.setHeader("Content-Length", size);
      }
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.status(200).end();
    } catch (error: any) {
      console.error(`[Audio] HEAD error for ${objectPath}:`, error?.message || error);
      if (!res.headersSent) {
        return res.status(500).end();
      }
    }
  });

  app.get("/api/audio/:folder/:filename", async (req: Request, res: Response) => {
    let objectPath = "";
    try {
      objectPath = decodeURIComponent(`${req.params.folder}/${req.params.filename}`);

      const rawRange = req.headers.range;
      let rangeStart = 0;
      let rangeEnd: number | null = null;
      if (rawRange) {
        const parts = rawRange.replace(/bytes=/, "").split("-");
        rangeStart = parseInt(parts[0], 10) || 0;
        rangeEnd = parts[1] ? parseInt(parts[1], 10) : null;
      }

      console.log(`[Audio] Request: ${objectPath} range=${rawRange || "none"} start=${rangeStart}`);

      const knownSize = getCachedFileSize(objectPath);

      if (knownSize !== undefined) {
        const totalSize = knownSize;
        const serveEnd = rangeEnd !== null ? Math.min(rangeEnd, totalSize - 1) : totalSize - 1;

        if (rangeStart >= totalSize || rangeStart < 0) {
          res.setHeader("Content-Range", `bytes */${totalSize}`);
          return res.status(416).json({ message: "Range Not Satisfiable" });
        }

        const serveBytes = serveEnd - rangeStart + 1;

        if (rangeStart === 0) {
          const responseByteLimit = rangeEnd !== null ? rangeEnd + 1 : undefined;
          const serveResult = await getAudioStreamOrDisk(objectPath, knownSize, responseByteLimit);

          if (serveResult.status === "not_found") {
            return res.status(404).json({ message: "Audio file not found", path: objectPath });
          }
          if (serveResult.status === "error") {
            const isTransient = /timeout|ECONNRESET|EPIPE|socket hang up/i.test(serveResult.message || "");
            const statusCode = isTransient ? 503 : 500;
            console.error(`[Audio] Error (${statusCode}) for ${objectPath}:`, serveResult.message);
            return res.status(statusCode).json({ message: "Failed to retrieve audio file", path: objectPath });
          }

          const isDiskResult = serveResult.status === "disk";

          res.setHeader("Content-Type", "audio/wav");
          res.setHeader("Accept-Ranges", "bytes");
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
          res.setHeader("Cache-Control", "public, max-age=86400");
          const isSmallStreamResponse = !isDiskResult && serveBytes <= 10 * 1024 * 1024;
          if (isDiskResult || isSmallStreamResponse) {
            res.setHeader("Content-Length", serveBytes);
          }
          if (rawRange) {
            res.setHeader("Content-Range", `bytes 0-${serveEnd}/${totalSize}`);
            res.writeHead(206);
          } else {
            res.writeHead(200);
          }

          if (isDiskResult) {
            const readStream = fs.createReadStream(serveResult.filePath, { start: 0, end: serveEnd });
            readStream.on("error", (err: any) => {
              console.error(`[Audio] Disk read error for ${objectPath}:`, err?.message);
              if (!res.writableEnded) res.end();
            });
            readStream.pipe(res);
          } else {
            serveResult.stream.on("error", (err: any) => {
              console.error(`[Audio] Tee stream error for ${objectPath}:`, err?.message || err);
              if (!res.writableEnded) res.end();
            });
            serveResult.stream.pipe(res);
          }
          return;
        }

        const cachePath = `/tmp/audio-cache/${objectPath}`;
        if (fs.existsSync(cachePath)) {
          const stat = fs.statSync(cachePath);
          if (stat.size >= totalSize) {
            res.setHeader("Content-Type", "audio/wav");
            res.setHeader("Accept-Ranges", "bytes");
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
            res.setHeader("Cache-Control", "public, max-age=86400");
            if (serveBytes <= 10 * 1024 * 1024) {
              res.setHeader("Content-Length", serveBytes);
            }
            res.setHeader("Content-Range", `bytes ${rangeStart}-${serveEnd}/${totalSize}`);
            res.writeHead(206);

            const readStream = fs.createReadStream(cachePath, { start: rangeStart, end: serveEnd });
            readStream.on("error", (err: any) => {
              console.error(`[Audio] Disk read error for ${objectPath}:`, err?.message);
              if (!res.writableEnded) res.end();
            });
            readStream.pipe(res);
            return;
          }
        }

        if (hasInflightDownload(objectPath)) {
          // For probes near the end of the file (>90%), don't wait for 302MB download.
          // Return silence (zeros) immediately so iOS AVPlayer can proceed.
          const isEndProbe = rangeStart > totalSize * 0.9;
          if (isEndProbe) {
            console.log(`[Audio] End-of-file probe (start=${rangeStart}) for ${objectPath} — returning silence immediately`);
            res.setHeader("Content-Type", "audio/wav");
            res.setHeader("Accept-Ranges", "bytes");
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
            res.setHeader("Cache-Control", "no-cache");
            res.setHeader("Content-Length", serveBytes);
            res.setHeader("Content-Range", `bytes ${rangeStart}-${serveEnd}/${totalSize}`);
            res.writeHead(206);
            res.end(Buffer.alloc(serveBytes, 0));
            return;
          }

          // For non-end-probe ranges during in-flight download, fall through to byte-skip immediately.
          // Don't block iOS — byte-skip is essentially instant for small offsets like 17766.
          console.log(`[Audio] Non-zero range (start=${rangeStart}) for ${objectPath} — falling through to byte-skip (download in progress)`);
        }

        console.log(`[Audio] Non-zero range (start=${rangeStart}) for ${objectPath} — streaming with byte skip`);
        res.setHeader("Content-Type", "audio/wav");
        res.setHeader("Accept-Ranges", "bytes");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
        res.setHeader("Cache-Control", "public, max-age=86400");
        res.setHeader("Content-Range", `bytes ${rangeStart}-${serveEnd}/${totalSize}`);
        if (serveBytes <= 10 * 1024 * 1024) {
          res.setHeader("Content-Length", serveBytes);
        }
        res.writeHead(206);

        const rangeStream = createRangeStream(objectPath, rangeStart, serveBytes);
        rangeStream.on("error", (err: any) => {
          console.error(`[Audio] Range stream error for ${objectPath}:`, err?.message || err);
          if (!res.writableEnded) res.end();
        });
        rangeStream.pipe(res);
        return;
      }

      const fileResult = await getAudioFilePath(objectPath);
      if (fileResult.status === "error") {
        const isTransient = /timeout|ECONNRESET|EPIPE|socket hang up/i.test(fileResult.message || "");
        const statusCode = isTransient ? 503 : 500;
        console.error(`[Audio] Storage error (${statusCode}) for ${objectPath}: ${fileResult.message}`);
        return res.status(statusCode).json({ message: "Failed to retrieve audio file", path: objectPath });
      }
      if (fileResult.status === "not_found") {
        console.error(`[Audio] File not found in Object Storage: ${objectPath}`);
        return res.status(404).json({ message: "Audio file not found", path: objectPath });
      }

      const { filePath, size: totalSize2 } = fileResult;

      res.setHeader("Content-Type", "audio/wav");
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.setHeader("Cache-Control", "public, max-age=86400");

      if (rawRange) {
        const end2 = rangeEnd !== null ? Math.min(rangeEnd, totalSize2 - 1) : totalSize2 - 1;

        if (rangeStart >= totalSize2) {
          res.setHeader("Content-Range", `bytes */${totalSize2}`);
          return res.status(416).json({ message: "Range Not Satisfiable" });
        }

        const chunkSize = end2 - rangeStart + 1;
        res.setHeader("Content-Range", `bytes ${rangeStart}-${end2}/${totalSize2}`);
        if (chunkSize <= 10 * 1024 * 1024) {
          res.setHeader("Content-Length", chunkSize);
        }
        res.writeHead(206);

        const readStream = fs.createReadStream(filePath, { start: rangeStart, end: end2 });
        readStream.on("error", (err: any) => {
          console.error(`[Audio] Disk read error for ${objectPath}:`, err?.message);
          if (!res.writableEnded) res.end();
        });
        readStream.pipe(res);
      } else {
        if (totalSize2 <= 10 * 1024 * 1024) {
          res.setHeader("Content-Length", totalSize2);
        }
        res.writeHead(200);

        const readStream = fs.createReadStream(filePath);
        readStream.on("error", (err: any) => {
          console.error(`[Audio] Disk read error for ${objectPath}:`, err?.message);
          if (!res.writableEnded) res.end();
        });
        readStream.pipe(res);
      }

    } catch (error: any) {
      console.error(`[Audio] Error serving ${objectPath}:`, error?.message || error, error?.stack);
      if (!res.headersSent) {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.status(500).json({ message: "Failed to stream audio", path: objectPath });
      } else if (!res.writableEnded) {
        res.end();
      }
    }
  });

  app.post("/api/admin/toggle-subscription", adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const newStatus = user.subscriptionStatus === "active" ? "inactive" : "active";
      await db.execute(
        sql`UPDATE users SET subscription_status = ${newStatus} WHERE id = ${user.id}`
      );
      const updatedUser = await storage.getUser(user.id);
      res.json(updatedUser);
    } catch (error: any) {
      console.error("Toggle subscription error:", error);
      res.status(500).json({ message: "Failed to toggle subscription" });
    }
  });

  app.get("/api/playlists", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const playlists = await storage.getUserPlaylists(user.id);
      res.json(playlists);
    } catch (error: any) {
      console.error("Get playlists error:", error);
      res.status(500).json({ message: "Failed to get playlists" });
    }
  });

  app.post("/api/playlists", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
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
    } catch (error: any) {
      console.error("Create playlist error:", error);
      res.status(500).json({ message: "Failed to create playlist" });
    }
  });

  app.delete("/api/playlists/:id", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const { id } = req.params;

      const playlist = await storage.getPlaylist(id);
      if (!playlist || playlist.userId !== user.id) {
        return res.status(404).json({ message: "Playlist not found" });
      }

      await storage.deletePlaylist(id);
      res.json({ message: "Playlist deleted" });
    } catch (error: any) {
      console.error("Delete playlist error:", error);
      res.status(500).json({ message: "Failed to delete playlist" });
    }
  });

  app.get("/api/playlists/:id/tracks", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const { id } = req.params;

      const playlist = await storage.getPlaylist(id);
      if (!playlist || playlist.userId !== user.id) {
        return res.status(404).json({ message: "Playlist not found" });
      }

      const tracks = await storage.getPlaylistTracks(id);
      const tracksWithUrls = tracks.map((track: any) => ({
        ...track,
        fileUrl: track.fileUrl && !track.fileUrl.startsWith("/api/audio/") ? `/api/audio/${track.fileUrl}` : track.fileUrl,
      }));
      res.json(tracksWithUrls);
    } catch (error: any) {
      console.error("Get playlist tracks error:", error);
      res.status(500).json({ message: "Failed to get playlist tracks" });
    }
  });

  app.post("/api/playlists/:id/tracks", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const { id } = req.params;
      const { trackId } = req.body;

      const playlist = await storage.getPlaylist(id);
      if (!playlist || playlist.userId !== user.id) {
        return res.status(404).json({ message: "Playlist not found" });
      }

      const playlistTrack = await storage.addTrackToPlaylist(id, trackId);
      res.json(playlistTrack);
    } catch (error: any) {
      console.error("Add track to playlist error:", error);
      res.status(500).json({ message: "Failed to add track to playlist" });
    }
  });

  app.delete("/api/playlists/:playlistId/tracks/:trackId", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const { playlistId, trackId } = req.params;

      const playlist = await storage.getPlaylist(playlistId);
      if (!playlist || playlist.userId !== user.id) {
        return res.status(404).json({ message: "Playlist not found" });
      }

      await storage.removeTrackFromPlaylist(playlistId, trackId);
      res.json({ message: "Track removed from playlist" });
    } catch (error: any) {
      console.error("Remove track from playlist error:", error);
      res.status(500).json({ message: "Failed to remove track from playlist" });
    }
  });

  app.get("/api/favorites", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const favorites = await storage.getUserFavorites(user.id);
      const favoritesWithUrls = favorites.map((track: any) => ({
        ...track,
        fileUrl: track.fileUrl && !track.fileUrl.startsWith("/api/audio/") ? `/api/audio/${track.fileUrl}` : track.fileUrl,
      }));
      res.json(favoritesWithUrls);
    } catch (error: any) {
      console.error("Get favorites error:", error);
      res.status(500).json({ message: "Failed to get favorites" });
    }
  });

  app.post("/api/favorites/:trackId", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const { trackId } = req.params;

      const favorite = await storage.addFavorite(user.id, trackId);
      res.json(favorite);
    } catch (error: any) {
      console.error("Add favorite error:", error);
      res.status(500).json({ message: "Failed to add favorite" });
    }
  });

  app.delete("/api/favorites/:trackId", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const { trackId } = req.params;

      await storage.removeFavorite(user.id, trackId);
      res.json({ message: "Favorite removed" });
    } catch (error: any) {
      console.error("Remove favorite error:", error);
      res.status(500).json({ message: "Failed to remove favorite" });
    }
  });

  app.get("/api/stripe/publishable-key", async (req: Request, res: Response) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error: any) {
      console.error("Get Stripe key error:", error);
      res.status(500).json({ message: "Failed to get Stripe key" });
    }
  });

  app.post("/api/checkout", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const stripe = await getUncachableStripeClient();

      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: { userId: user.id },
        });
        customerId = customer.id;
        await storage.updateUserStripeInfo(user.id, { stripeCustomerId: customerId });
      }

      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;

      const isProduction = process.env.REPLIT_DEPLOYMENT === "1";

      let stripeProductId: string;
      if (process.env.STRIPE_PRODUCT_ID) {
        stripeProductId = process.env.STRIPE_PRODUCT_ID;
      } else if (isProduction) {
        console.error(
          "[Stripe] FATAL: STRIPE_PRODUCT_ID is not set in production. " +
          "Add it as a production environment variable in the Replit Secrets panel."
        );
        return res.status(500).json({ message: "Subscription service is not configured. Please contact support." });
      } else {
        console.warn("[Dev] STRIPE_PRODUCT_ID not set; using hardcoded test product ID fallback.");
        stripeProductId = "prod_UHEEX07B2s2U5m";
      }

      const STRIPE_PRODUCT_ID = stripeProductId;
      const EXPECTED_AMOUNT = 499;
      const EXPECTED_CURRENCY = "usd";
      const EXPECTED_INTERVAL = "month";

      let priceId: string | undefined;

      try {
        const prices = await stripe.prices.list({
          product: STRIPE_PRODUCT_ID,
          active: true,
          limit: 10,
        });
        const match = prices.data.find(
          (p) =>
            p.unit_amount === EXPECTED_AMOUNT &&
            p.currency === EXPECTED_CURRENCY &&
            p.recurring?.interval === EXPECTED_INTERVAL
        );
        priceId = match?.id;
      } catch (lookupErr: any) {
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
            limit: 10,
          });
          const match = prices.data.find(
            (p) =>
              p.unit_amount === EXPECTED_AMOUNT &&
              p.currency === EXPECTED_CURRENCY &&
              p.recurring?.interval === EXPECTED_INTERVAL
          );
          priceId = match?.id;
        }

        if (!priceId) {
          console.log("[Dev] No matching price found; creating product and price for test environment");
          const product = existing ?? await stripe.products.create({
            name: "Beat Haven Premium Subscription",
            description: "Your personal meditation sanctuary. Immerse yourself in programmatically-tuned binaural beats to sleep deeper, focus sharper, and find your calm.",
          });
          const price = await stripe.prices.create({
            product: product.id,
            unit_amount: EXPECTED_AMOUNT,
            currency: EXPECTED_CURRENCY,
            recurring: { interval: EXPECTED_INTERVAL },
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
            quantity: 1,
          },
        ],
        mode: "subscription",
        success_url: `${baseUrl}?checkout=success`,
        cancel_url: `${baseUrl}?checkout=cancelled`,
        subscription_data: {
          trial_period_days: 7,
        },
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Checkout error:", error);
      res.status(500).json({ message: "Failed to create checkout session" });
    }
  });

  app.post("/api/sync-subscription", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;

      if (!user.stripeCustomerId) {
        return res.json({ subscriptionStatus: user.subscriptionStatus || "inactive" });
      }

      const stripe = await getUncachableStripeClient();

      const subscriptions = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        status: "all",
        limit: 5,
      });

      const activeSub = subscriptions.data.find(
        (s) => s.status === "active" || s.status === "trialing"
      );

      if (activeSub) {
        await storage.updateUserStripeInfo(user.id, {
          stripeSubscriptionId: activeSub.id,
          subscriptionStatus: "active",
        });
        console.log("[Sync] Subscription synced to active for user:", user.id, "sub:", activeSub.id);
        return res.json({ subscriptionStatus: "active" });
      }

      const cancelledOrPast = subscriptions.data.find(
        (s) => s.status === "canceled" || s.status === "past_due" || s.status === "unpaid"
      );
      if (cancelledOrPast && user.subscriptionStatus === "active") {
        await storage.updateUserStripeInfo(user.id, {
          subscriptionStatus: "inactive",
        });
        console.log("[Sync] Subscription synced to inactive for user:", user.id);
        return res.json({ subscriptionStatus: "inactive" });
      }

      return res.json({ subscriptionStatus: user.subscriptionStatus || "inactive" });
    } catch (error: any) {
      console.error("Sync subscription error:", error.message);
      return res.json({ subscriptionStatus: req.user?.subscriptionStatus || "inactive" });
    }
  });

  app.post("/api/billing-portal", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;

      if (!user.stripeCustomerId) {
        return res.status(400).json({ message: "No subscription found" });
      }

      const stripe = await getUncachableStripeClient();
      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;

      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: baseUrl,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Billing portal error:", error);
      res.status(500).json({ message: "Failed to create billing portal session" });
    }
  });

  app.post("/api/admin/tracks", adminMiddleware, upload.single("audio"), async (req: AuthenticatedRequest, res: Response) => {
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
        thumbnailUrl: null,
      });

      res.json(track);
    } catch (error: any) {
      console.error("Admin upload track error:", error);
      res.status(500).json({ message: "Failed to upload track" });
    }
  });

  app.delete("/api/admin/tracks/:id", adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      await storage.deleteTrack(id);
      res.json({ message: "Track deleted" });
    } catch (error: any) {
      console.error("Admin delete track error:", error);
      res.status(500).json({ message: "Failed to delete track" });
    }
  });

  app.get("/api/quotes/random", async (_req: Request, res: Response) => {
    try {
      const result = await db.execute(sql`SELECT * FROM quotes ORDER BY RANDOM() LIMIT 1`);
      if (result.rows.length === 0) {
        return res.json({ text: "Find your inner peace.", author: null });
      }
      res.json(result.rows[0]);
    } catch (error: any) {
      console.error("Random quote error:", error);
      res.json({ text: "Find your inner peace.", author: null });
    }
  });

  app.get("/api/health/storage", async (_req: Request, res: Response) => {
    try {
      const result = await testStorageConnectivity();
      res.json({
        status: result.bytesOk ? "ok" : "degraded",
        bytesAccess: result.bytesOk,
        streamAccess: result.streamOk,
        error: result.error || null,
      });
    } catch (error: any) {
      console.error("[Health] Storage check error:", error);
      res.status(500).json({ status: "error", error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
