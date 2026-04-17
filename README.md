# Beat Haven

Beat Haven is a React Native/Expo app for binaural beats and ambient audio streaming on iOS, Android, and web.

## What it does

- Streams 50 binaural beat WAV tracks from Replit Object Storage
- Includes playlist, favorites, and playback controls
- Supports Apple Sign-In, Google Sign-In, and email/password auth
- Uses Stripe for live web subscriptions
- Uses RevenueCat for native mobile subscriptions
- Shows a premium paywall with monthly, yearly, and lifetime tiers

## Subscription model

### Stripe web
- Monthly: $0.99/month
- Handles live checkout, billing portal, and webhook sync

### RevenueCat mobile
- Monthly: $4.99 with 7-day trial
- Yearly: $39.99 with 7-day trial
- Lifetime: $99.99 one-time purchase
- Entitlement: `premium`

## RevenueCat setup

The app expects these public RevenueCat API keys:

- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_TEST_API_KEY`

The native paywall uses the RevenueCat SDK on iOS and Android when these values are present.

## Environment variables

Required runtime values include:

- `DATABASE_URL`
- `SESSION_SECRET`
- `REPLIT_DEV_DOMAIN` / `REPLIT_DOMAINS`
- `APPLE_CLIENT_ID`
- `GOOGLE_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_CLIENT_ID`
- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_TEST_API_KEY`
- Stripe credentials from Replit connectors

## Local development

- Frontend: `npm run expo:dev`
- Backend: `npm run server:dev`

## Notes

- The app uses a custom `premium` entitlement for RevenueCat.
- Lifetime users stay premium even if recurring subscriptions later expire.
- Mobile manage actions open the App Store or Google Play billing screens.
- Web users continue using Stripe checkout and billing portal.

## Project files of interest

- `client/lib/revenuecat.tsx`
- `client/screens/SubscriptionScreen.tsx`
- `server/routes.ts`
- `server/webhookHandlers.ts`
- `server/storage.ts`
- `replit.md`
