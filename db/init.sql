-- Database schema for media-god (derived from lib/db/schema.ts)
-- Creates better-auth tables and app-specific tables.

-- --- Better Auth required tables ---
CREATE TABLE IF NOT EXISTS "user" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "emailVerified" boolean NOT NULL DEFAULT false,
  "image" text,
  "createdAt" timestamp NOT NULL DEFAULT NOW(),
  "updatedAt" timestamp NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "session" (
  "id" text PRIMARY KEY,
  "expiresAt" timestamp NOT NULL,
  "token" text NOT NULL UNIQUE,
  "createdAt" timestamp NOT NULL DEFAULT NOW(),
  "updatedAt" timestamp NOT NULL DEFAULT NOW(),
  "ipAddress" text,
  "userAgent" text,
  "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "account" (
  "id" text PRIMARY KEY,
  "accountId" text NOT NULL,
  "providerId" text NOT NULL,
  "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamp,
  "refreshTokenExpiresAt" timestamp,
  "scope" text,
  "password" text,
  "createdAt" timestamp NOT NULL DEFAULT NOW(),
  "updatedAt" timestamp NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "verification" (
  "id" text PRIMARY KEY,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expiresAt" timestamp NOT NULL,
  "createdAt" timestamp DEFAULT NOW(),
  "updatedAt" timestamp DEFAULT NOW()
);

-- --- App tables for streaming features ---
CREATE TABLE IF NOT EXISTS "watchlist" (
  "id" serial PRIMARY KEY,
  "userId" text NOT NULL,
  "mediaId" integer NOT NULL,
  "mediaType" text NOT NULL,
  "title" text NOT NULL,
  "posterPath" text,
  "createdAt" timestamp NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "favorites" (
  "id" serial PRIMARY KEY,
  "userId" text NOT NULL,
  "mediaId" integer NOT NULL,
  "mediaType" text NOT NULL,
  "title" text NOT NULL,
  "posterPath" text,
  "createdAt" timestamp NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "continue_watching" (
  "id" serial PRIMARY KEY,
  "userId" text NOT NULL,
  "mediaId" integer NOT NULL,
  "mediaType" text NOT NULL,
  "title" text NOT NULL,
  "posterPath" text,
  "progress" integer NOT NULL DEFAULT 0,
  "duration" integer NOT NULL DEFAULT 0,
  "seasonNumber" integer,
  "episodeNumber" integer,
  "updatedAt" timestamp NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "watch_party" (
  "id" text PRIMARY KEY,
  "hostId" text NOT NULL,
  "mediaId" integer NOT NULL,
  "mediaType" text NOT NULL,
  "title" text NOT NULL,
  "posterPath" text,
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "watch_party_members" (
  "id" serial PRIMARY KEY,
  "partyId" text NOT NULL,
  "userId" text NOT NULL,
  "joinedAt" timestamp NOT NULL DEFAULT NOW()
);
