# Binaural Beat App - Design Guidelines

## Brand Identity

**Purpose**: A premium meditation sanctuary delivering therapeutic binaural beats to reduce stress, improve focus, and enhance sleep. Users pay $2.99/month for unlimited access to curated frequency-based audio.

**Aesthetic Direction**: **Organic/Calming Sanctuary**
- Soft gradients inspired by twilight skies and ocean depths
- Gentle curves and fluid transitions
- Breathing room with generous padding
- Immersive visual experiences that transform during playback
- Premium feel without intimidation - accessible zen

**Memorable Element**: The full-screen animated visuals during playback (shimmering waves, particle flows, water ripples) that turn the phone into a mesmerizing meditation device.

---

## Navigation Architecture

**Root Navigation**: Tab Bar (3 tabs)
- **Home** (center): Browse audio library by frequency category
- **Playlists** (left): User-created collections
- **Account** (right): Settings, subscription, profile

**Auth Flow**: Stack-only for login/signup screens, then transitions to main tab navigator after authentication.

---

## Screen-by-Screen Specifications

### 1. Login/Signup Screen
**Purpose**: Authenticate users or create new accounts
**Layout**:
- No header
- Centered content with logo/app name at top
- Form fields (email, password)
- Primary CTA button
- SSO options (Apple Sign-In, Google Sign-In)
- Toggle between login/signup modes
- Links to privacy policy & terms (placeholder URLs)
**Safe Area**: Top: insets.top + 60px, Bottom: insets.bottom + 40px

### 2. Home Screen (Tab 1)
**Purpose**: Browse and play audio files by frequency category
**Layout**:
- Transparent header with app logo/title, right button for search
- Scrollable main content
- Category sections (Alpha, Theta, Delta, Beta, Gamma) as horizontal scrollable cards
- Each card shows: frequency name, duration, visual thumbnail
- Tap card → opens Player Screen (modal)
**Components**: Horizontal scrollable lists, category headers, audio cards
**Safe Area**: Top: headerHeight + 24px, Bottom: tabBarHeight + 24px

### 3. Player Screen (Modal)
**Purpose**: Immersive playback with animated visuals
**Layout**:
- Full-screen animated background (waves/particles/water - user-selectable)
- Close button (top-left)
- Settings button (top-right) for visual options & toggle on/off
- Audio title & frequency category (centered, overlaid)
- Playback controls (play/pause, skip, progress bar, volume slider) at bottom
- Favorite/add to playlist button
**Safe Area**: Top: insets.top + 16px, Bottom: insets.bottom + 40px
**Note**: This screen replaces the entire view - no tab bar visible

### 4. Playlists Screen (Tab 2)
**Purpose**: View and manage user-created playlists
**Layout**:
- Default header with "Playlists" title, right button "Create New"
- Scrollable list of playlist cards
- Empty state if no playlists created (illustration + CTA button)
- Tap playlist → opens Playlist Detail Screen (stack push)
**Components**: List view, empty state, playlist cards with track count
**Safe Area**: Top: 24px, Bottom: tabBarHeight + 24px

### 5. Playlist Detail Screen
**Purpose**: View and play tracks within a playlist
**Layout**:
- Custom header with back button (left), playlist name (center), edit button (right)
- Scrollable list of tracks
- Swipe-to-delete gesture
- Empty state if no tracks added
**Safe Area**: Top: 24px, Bottom: insets.bottom + 24px

### 6. Account Screen (Tab 3)
**Purpose**: Manage profile, subscription, and settings
**Layout**:
- Default header with "Account" title
- Scrollable form/list view
- Sections: Profile (avatar, username), Subscription (status, manage payment), Settings (theme, notifications), Actions (log out, delete account)
- Log out nested under Settings with confirmation alert
- Delete account nested under Settings > Account > Delete with double confirmation
**Safe Area**: Top: 24px, Bottom: tabBarHeight + 24px

### 7. Subscription Management Screen
**Purpose**: Update payment info and view subscription status
**Layout**:
- Custom header with back button
- Subscription status card (active, next billing date)
- Payment method section with update CTA
- Cancel subscription button (requires confirmation)
**Safe Area**: Top: 24px, Bottom: insets.bottom + 24px

---

## Design System

### Color Palette
- **Primary**: `#4A90E2` (Calming blue with depth)
- **Accent**: `#7B68EE` (Twilight purple for meditation)
- **Background**: `#0A0E1A` (Deep night sky)
- **Surface**: `#1A1F2E` (Elevated cards)
- **Text Primary**: `#FFFFFF`
- **Text Secondary**: `#A0A8B8`
- **Success**: `#5AD07A`
- **Error**: `#E94B3C`

Use soft gradients for hero sections: `linear-gradient(135deg, #4A90E2 0%, #7B68EE 100%)`

### Typography
- **Font**: Nunito (Google Font) for friendly, calming readability
- **Type Scale**:
  - Heading 1: 32px, Bold
  - Heading 2: 24px, SemiBold
  - Body: 16px, Regular
  - Caption: 14px, Regular
  - Button: 16px, SemiBold

### Visual Design
- **Icons**: Feather icons from @expo/vector-icons (pause, play, heart, settings, user, list)
- **Touchable Feedback**: Opacity 0.7 on press
- **Floating Buttons**: Subtle shadow (offset: {width: 0, height: 2}, opacity: 0.10, radius: 2)
- **Cards**: 16px border radius, subtle elevation
- **Audio Player Controls**: Large (64px) central play/pause button, smaller (40px) secondary controls

---

## Assets to Generate

1. **icon.png** - App icon featuring abstract wave pattern in gradient (blue to purple)
   - WHERE USED: Device home screen

2. **splash-icon.png** - Simplified wave/frequency icon
   - WHERE USED: App launch screen

3. **empty-playlists.png** - Soft illustration of headphones with musical notes
   - WHERE USED: Playlists screen empty state

4. **empty-playlist-detail.png** - Gentle illustration of an open playlist folder
   - WHERE USED: Playlist detail screen when no tracks added

5. **default-avatar.png** - Circular avatar with zen symbol or sound wave
   - WHERE USED: Account screen user profile

6. **wave-animation-preview.png** - Thumbnail of shimmering wave visual
   - WHERE USED: Visual selector in player settings

7. **particles-animation-preview.png** - Thumbnail of particle flow visual
   - WHERE USED: Visual selector in player settings

8. **water-animation-preview.png** - Thumbnail of water ripple visual
   - WHERE USED: Visual selector in player settings