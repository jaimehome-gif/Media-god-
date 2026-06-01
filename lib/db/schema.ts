import { pgTable, text, timestamp, boolean, serial, integer } from 'drizzle-orm/pg-core'

// --- Better Auth required tables -------------------------------------------
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').defaultNow(),
  updatedAt: timestamp('updatedAt').defaultNow(),
})

// --- App tables for streaming features -------------------------------------
export const watchlist = pgTable('watchlist', {
  id: serial('id').primaryKey(),
  userId: text('userId').notNull(),
  mediaId: integer('mediaId').notNull(),
  mediaType: text('mediaType').notNull(),
  title: text('title').notNull(),
  posterPath: text('posterPath'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

export const favorites = pgTable('favorites', {
  id: serial('id').primaryKey(),
  userId: text('userId').notNull(),
  mediaId: integer('mediaId').notNull(),
  mediaType: text('mediaType').notNull(),
  title: text('title').notNull(),
  posterPath: text('posterPath'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

export const continueWatching = pgTable('continue_watching', {
  id: serial('id').primaryKey(),
  userId: text('userId').notNull(),
  mediaId: integer('mediaId').notNull(),
  mediaType: text('mediaType').notNull(),
  title: text('title').notNull(),
  posterPath: text('posterPath'),
  progress: integer('progress').notNull().default(0),
  duration: integer('duration').notNull().default(0),
  seasonNumber: integer('seasonNumber'),
  episodeNumber: integer('episodeNumber'),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const watchParty = pgTable('watch_party', {
  id: text('id').primaryKey(),
  hostId: text('hostId').notNull(),
  mediaId: integer('mediaId').notNull(),
  mediaType: text('mediaType').notNull(),
  title: text('title').notNull(),
  posterPath: text('posterPath'),
  isActive: boolean('isActive').notNull().default(true),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

export const watchPartyMembers = pgTable('watch_party_members', {
  id: serial('id').primaryKey(),
  partyId: text('partyId').notNull(),
  userId: text('userId').notNull(),
  joinedAt: timestamp('joinedAt').notNull().defaultNow(),
})
