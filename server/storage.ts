import { eq, and, sql } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  audioTracks,
  playlists,
  playlistTracks,
  favorites,
  User,
  AudioTrack,
  Playlist,
  PlaylistTrack,
  Favorite,
} from "../shared/schema";

export class Storage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByAppleId(appleUserId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.appleUserId, appleUserId));
    return user;
  }

  async getUserByGoogleId(googleUserId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.googleUserId, googleUserId));
    return user;
  }

  async createUser(
    email: string,
    hashedPassword: string | null,
    options?: { authProvider?: string; appleUserId?: string; googleUserId?: string }
  ): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        email,
        password: hashedPassword,
        authProvider: options?.authProvider || "email",
        appleUserId: options?.appleUserId || null,
        googleUserId: options?.googleUserId || null,
      })
      .returning();
    return user;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async updateUserStripeInfo(
    userId: string,
    stripeInfo: {
      stripeCustomerId?: string;
      stripeSubscriptionId?: string;
      subscriptionStatus?: string;
    }
  ): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(stripeInfo)
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async getAllTracks(): Promise<AudioTrack[]> {
    return await db.select().from(audioTracks).orderBy(audioTracks.category, audioTracks.title);
  }

  async getTrack(id: string): Promise<AudioTrack | undefined> {
    const [track] = await db.select().from(audioTracks).where(eq(audioTracks.id, id));
    return track;
  }

  async createTrack(track: Omit<AudioTrack, "id" | "createdAt">): Promise<AudioTrack> {
    const [newTrack] = await db.insert(audioTracks).values(track).returning();
    return newTrack;
  }

  async deleteTrack(id: string): Promise<void> {
    await db.delete(playlistTracks).where(eq(playlistTracks.trackId, id));
    await db.delete(favorites).where(eq(favorites.trackId, id));
    await db.delete(audioTracks).where(eq(audioTracks.id, id));
  }

  async getUserPlaylists(userId: string): Promise<(Playlist & { trackCount: number })[]> {
    const result = await db.execute(sql`
      SELECT p.*, COUNT(pt.id)::int as track_count
      FROM playlists p
      LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
      WHERE p.user_id = ${userId}
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `);
    return result.rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      createdAt: row.created_at,
      trackCount: row.track_count || 0,
    }));
  }

  async getPlaylist(id: string): Promise<Playlist | undefined> {
    const [playlist] = await db.select().from(playlists).where(eq(playlists.id, id));
    return playlist;
  }

  async createPlaylist(userId: string, name: string): Promise<Playlist> {
    const [playlist] = await db
      .insert(playlists)
      .values({ userId, name })
      .returning();
    return playlist;
  }

  async deletePlaylist(id: string): Promise<void> {
    await db.delete(playlistTracks).where(eq(playlistTracks.playlistId, id));
    await db.delete(playlists).where(eq(playlists.id, id));
  }

  async getPlaylistTracks(playlistId: string): Promise<(AudioTrack & { position: number })[]> {
    const result = await db.execute(sql`
      SELECT at.*, pt.position
      FROM playlist_tracks pt
      JOIN audio_tracks at ON at.id = pt.track_id
      WHERE pt.playlist_id = ${playlistId}
      ORDER BY pt.position
    `);
    return result.rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      frequency: row.frequency,
      category: row.category,
      duration: row.duration,
      fileUrl: row.file_url,
      thumbnailUrl: row.thumbnail_url,
      createdAt: row.created_at,
      position: row.position,
    }));
  }

  async addTrackToPlaylist(playlistId: string, trackId: string): Promise<PlaylistTrack> {
    const existingTracks = await db
      .select()
      .from(playlistTracks)
      .where(eq(playlistTracks.playlistId, playlistId));
    
    const position = existingTracks.length;
    
    const [playlistTrack] = await db
      .insert(playlistTracks)
      .values({ playlistId, trackId, position })
      .returning();
    return playlistTrack;
  }

  async removeTrackFromPlaylist(playlistId: string, trackId: string): Promise<void> {
    await db
      .delete(playlistTracks)
      .where(
        and(
          eq(playlistTracks.playlistId, playlistId),
          eq(playlistTracks.trackId, trackId)
        )
      );
  }

  async getUserFavorites(userId: string): Promise<AudioTrack[]> {
    const result = await db.execute(sql`
      SELECT at.*
      FROM favorites f
      JOIN audio_tracks at ON at.id = f.track_id
      WHERE f.user_id = ${userId}
      ORDER BY f.created_at DESC
    `);
    return result.rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      frequency: row.frequency,
      category: row.category,
      duration: row.duration,
      fileUrl: row.file_url,
      thumbnailUrl: row.thumbnail_url,
      createdAt: row.created_at,
    }));
  }

  async addFavorite(userId: string, trackId: string): Promise<Favorite> {
    const [favorite] = await db
      .insert(favorites)
      .values({ userId, trackId })
      .returning();
    return favorite;
  }

  async removeFavorite(userId: string, trackId: string): Promise<void> {
    await db
      .delete(favorites)
      .where(and(eq(favorites.userId, userId), eq(favorites.trackId, trackId)));
  }

  async isFavorite(userId: string, trackId: string): Promise<boolean> {
    const [favorite] = await db
      .select()
      .from(favorites)
      .where(and(eq(favorites.userId, userId), eq(favorites.trackId, trackId)));
    return !!favorite;
  }
  async deleteUser(userId: string): Promise<void> {
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
}

export const storage = new Storage();
