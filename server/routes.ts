import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import multer from "multer";
import { storage } from "./storage";
import {
  generateToken,
  hashPassword,
  comparePasswords,
  authenticateToken,
} from "./auth";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";
import { uploadAudioFile, streamAudioFile, getAudioFileAsBuffer } from "./objectStorage";
import { User } from "../shared/schema";

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
          subscriptionStatus: user.subscriptionStatus,
        },
      });
    } catch (error: any) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
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
        if (!currentPassword) {
          return res.status(400).json({ message: "Current password is required" });
        }
        const validPassword = await comparePasswords(currentPassword, user.password);
        if (!validPassword) {
          return res.status(400).json({ message: "Current password is incorrect" });
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

  app.get("/api/tracks", async (req: Request, res: Response) => {
    try {
      const tracks = await storage.getAllTracks();
      const domain = process.env.REPLIT_DOMAINS?.split(",")[0] || process.env.REPLIT_DEV_DOMAIN;
      const baseUrl = `https://${domain}:5000`;
      
      const tracksWithUrls = tracks.map(track => ({
        ...track,
        fileUrl: `${baseUrl}/api/audio/${track.fileUrl}`,
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

  app.get("/api/audio/:folder/:filename", async (req: Request, res: Response) => {
    try {
      const objectPath = decodeURIComponent(`${req.params.folder}/${req.params.filename}`);
      
      const fileData = await getAudioFileAsBuffer(objectPath);
      if (!fileData) {
        return res.status(404).json({ message: "Audio file not found" });
      }
      
      const { buffer, size } = fileData;
      const range = req.headers.range;
      
      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : size - 1;
        const chunkSize = end - start + 1;
        
        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunkSize,
          "Content-Type": "audio/wav",
        });
        
        res.end(buffer.slice(start, end + 1));
      } else {
        res.writeHead(200, {
          "Content-Length": size,
          "Content-Type": "audio/wav",
          "Accept-Ranges": "bytes",
        });
        
        res.end(buffer);
      }
    } catch (error: any) {
      console.error("Audio stream error:", error);
      res.status(500).json({ message: "Failed to stream audio" });
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
      const domain = process.env.REPLIT_DOMAINS?.split(",")[0] || process.env.REPLIT_DEV_DOMAIN;
      const baseUrl = `https://${domain}:5000`;
      const tracksWithUrls = tracks.map((track: any) => ({
        ...track,
        fileUrl: track.fileUrl && !track.fileUrl.startsWith("http") ? `${baseUrl}/api/audio/${track.fileUrl}` : track.fileUrl,
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
      const domain = process.env.REPLIT_DOMAINS?.split(",")[0] || process.env.REPLIT_DEV_DOMAIN;
      const baseUrl = `https://${domain}:5000`;
      const favoritesWithUrls = favorites.map((track: any) => ({
        ...track,
        fileUrl: track.fileUrl && !track.fileUrl.startsWith("http") ? `${baseUrl}/api/audio/${track.fileUrl}` : track.fileUrl,
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

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: "BinauralBeats Premium",
                description: "Unlimited access to all binaural beats",
              },
              unit_amount: 99,
              recurring: {
                interval: "month",
              },
            },
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

  const httpServer = createServer(app);
  return httpServer;
}
