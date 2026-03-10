# Binaural Beats App

## Overview

A premium React Native/Expo mobile application delivering therapeutic binaural beats for stress reduction, focus improvement, and sleep enhancement. Users access curated frequency-based audio content through a $0.99/month subscription model. The app features an immersive "Resonant Orb" animation during playback with 4-7-8 breathing rhythm, category-colored glow, and slow-rotating SVG concentric rings.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React Native with Expo SDK 54, targeting iOS, Android, and web platforms. Uses the new React 19.1 architecture with the experimental React Compiler enabled.

**Navigation**: React Navigation v7 with a hybrid approach:
- Native stack navigator for auth flow and modals
- Bottom tab navigator for main app sections (Playlists, Home, Account)
- Nested stack navigators within each tab for screen depth

**State Management**:
- TanStack Query for server state (API data fetching, caching, mutations)
- React Context for global client state (AuthContext for user session, PlayerContext for audio playback)
- Local component state with useState for UI-specific state

**Styling**: Custom theme system with dark mode default. Uses react-native-reanimated for animations, expo-linear-gradient for visual effects, and expo-blur for iOS blur effects on navigation elements.

**Audio Playback**: expo-av handles audio streaming with progress tracking, background playback support, and visual synchronization.

### Backend Architecture

**Runtime**: Express.js running on Node.js with TypeScript.

**API Design**: RESTful endpoints under `/api/*` prefix. Authentication via Bearer tokens in Authorization header. Admin-only routes protected with middleware.

**Authentication**: Custom JWT-like token system using HMAC-SHA256 signatures. Passwords hashed with bcryptjs. Tokens stored client-side via expo-secure-store (native) or localStorage (web).

**File Storage**: Replit Object Storage for audio file uploads. Generates signed download URLs for secure streaming.

### Data Storage

**Database**: PostgreSQL with Drizzle ORM. Schema includes:
- `users` - Authentication, Stripe subscription info, admin flag
- `audio_tracks` - Track metadata, frequency category, file URLs
- `playlists` - User-created collections
- `playlist_tracks` - Many-to-many join table with position ordering
- `favorites` - User-track favorites

**Migrations**: Drizzle Kit manages schema migrations in `./migrations` directory.

### Subscription & Payments

**Provider**: Stripe integration via Replit connectors. Handles:
- Customer creation and checkout sessions
- Subscription lifecycle webhooks
- Customer portal access for subscription management

**Webhook Processing**: Raw body parsing for Stripe signature verification. Webhook endpoint registered before JSON body parser middleware.

## External Dependencies

### Third-Party Services

- **Stripe**: Payment processing and subscription management via Replit connector
- **Replit Object Storage**: Audio file hosting with signed URLs
- **PostgreSQL**: Primary database (provisioned via Replit)

### Key NPM Packages

- `expo-av`: Audio playback engine
- `expo-av` Video component: Also used for player screen background video animation (looping, muted .mp4)
- `@tanstack/react-query`: Data fetching and caching
- `drizzle-orm` + `drizzle-kit`: Database ORM and migrations
- `react-native-reanimated`: Advanced animations
- `expo-secure-store`: Secure token storage on native platforms
- `@react-native-community/slider`: Volume sliders in ambient mixer
- `@react-native-community/netinfo`: Network status for offline indicator

### Key Features

- **Resonant Orb**: Animated playback visualization with 4-7-8 breathing rhythm, category-colored glow, slow-rotating SVG rings
- **Sleep Timer**: 15/30/45/60 minute options with 30-second volume fade-out before pause
- **Loop Controls**: Loop one / loop all toggle in player controls
- **Track Queue / Skip Controls**: Next/previous buttons in player. Queue is set from the category or playlist track list when a track is tapped. Skip-back restarts if progress > 3s, otherwise goes to previous. Auto-advances to next track on finish. Uses refs for stale-closure safety.
- **Favorites**: Heart icon on track cards and player, toggled via /api/favorites endpoints
- **Mood/Goal Filters**: Horizontal chips on home screen (Deep Sleep, Anxiety Relief, Focus, Creativity, Lucid Dreaming) filtering categories
- **Educational Tooltips**: Info icon on each category header showing frequency range, description, and benefits
- **Noise Color Mixer**: Bottom sheet with 13 noise colors (White, Pink, Brown, Blue, Violet, Grey, Green, Orange, Red, Black, Speech, Modulated, Dither) each with independent volume. Generated as .wav files in Object Storage at ambient/{color}.wav, served via /api/audio/ambient/{color}.wav. Web uses Web Audio API real-time generation; native uses streamed .wav files.
- **Restore Purchases**: Button on account screen to re-verify subscription status
- **Offline Indicator**: Animated banner when network connection is lost
- **Admin Testing**: Admin-only screen (Account > Admin Testing) with a toggle to simulate active/inactive subscription for testing both free and premium user experiences. Uses `POST /api/admin/toggle-subscription` endpoint.

### Admin Account

- Email: BeatHavenAdmin@gmail.com (isAdmin: true)
- Has access to Upload Tracks and Admin Testing screens via Account tab
- Admin Testing toggle switches subscriptionStatus between "active" and "inactive" to test both user tiers

### Environment Variables Required

- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: JWT signing key (falls back to default in dev)
- `REPLIT_DEV_DOMAIN` / `REPLIT_DOMAINS`: CORS configuration
- Stripe credentials obtained dynamically via Replit connectors