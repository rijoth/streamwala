# Onboarding Feature (`src/features/onboarding`)

## Purpose
Provides the 10-foot TV onboarding wizard shown on fresh installation when no active playlist exists in IndexedDB.

## Features
- Welcome pitch and auto-focused "Get Started" CTA.
- 4 source options: M3U URL, Xtream Codes credentials, local file upload, and Legal Public Demo streams.
- Client-side validation, reachability checks, and `#EXTM3U` format sniffing.
- Built-in CORS and Mixed Content diagnostic modal with one-click resolution.
- Live streaming import progress with channels and categories counter.
