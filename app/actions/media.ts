'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { watchlist, favorites, continueWatching, watchParty, watchPartyMembers } from '@/lib/db/schema'
import { and, eq, desc } from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { nanoid } from 'nanoid'

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user.id
}

export async function getOptionalUserId() {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    return session?.user?.id || null
  } catch {
    return null
  }
}

// Watchlist actions
export async function addToWatchlist(data: {
  mediaId: number
  mediaType: string
  title: string
  posterPath: string | null
}) {
  const userId = await getUserId()
  
  const existing = await db
    .select()
    .from(watchlist)
    .where(
      and(
        eq(watchlist.userId, userId),
        eq(watchlist.mediaId, data.mediaId),
        eq(watchlist.mediaType, data.mediaType)
      )
    )
    .limit(1)

  if (existing.length > 0) {
    return { success: false, message: 'Already in watchlist' }
  }

  await db.insert(watchlist).values({
    userId,
    mediaId: data.mediaId,
    mediaType: data.mediaType,
    title: data.title,
    posterPath: data.posterPath,
  })

  revalidatePath('/')
  return { success: true }
}

export async function removeFromWatchlist(mediaId: number, mediaType: string) {
  const userId = await getUserId()
  
  await db
    .delete(watchlist)
    .where(
      and(
        eq(watchlist.userId, userId),
        eq(watchlist.mediaId, mediaId),
        eq(watchlist.mediaType, mediaType)
      )
    )

  revalidatePath('/')
  return { success: true }
}

export async function getWatchlist() {
  const userId = await getUserId()
  
  return db
    .select()
    .from(watchlist)
    .where(eq(watchlist.userId, userId))
    .orderBy(desc(watchlist.createdAt))
}

export async function isInWatchlist(mediaId: number, mediaType: string) {
  const userId = await getOptionalUserId()
  if (!userId) return false
  
  const result = await db
    .select()
    .from(watchlist)
    .where(
      and(
        eq(watchlist.userId, userId),
        eq(watchlist.mediaId, mediaId),
        eq(watchlist.mediaType, mediaType)
      )
    )
    .limit(1)

  return result.length > 0
}

// Favorites actions
export async function addToFavorites(data: {
  mediaId: number
  mediaType: string
  title: string
  posterPath: string | null
}) {
  const userId = await getUserId()
  
  const existing = await db
    .select()
    .from(favorites)
    .where(
      and(
        eq(favorites.userId, userId),
        eq(favorites.mediaId, data.mediaId),
        eq(favorites.mediaType, data.mediaType)
      )
    )
    .limit(1)

  if (existing.length > 0) {
    return { success: false, message: 'Already in favorites' }
  }

  await db.insert(favorites).values({
    userId,
    mediaId: data.mediaId,
    mediaType: data.mediaType,
    title: data.title,
    posterPath: data.posterPath,
  })

  revalidatePath('/')
  return { success: true }
}

export async function removeFromFavorites(mediaId: number, mediaType: string) {
  const userId = await getUserId()
  
  await db
    .delete(favorites)
    .where(
      and(
        eq(favorites.userId, userId),
        eq(favorites.mediaId, mediaId),
        eq(favorites.mediaType, mediaType)
      )
    )

  revalidatePath('/')
  return { success: true }
}

export async function getFavorites() {
  const userId = await getUserId()
  
  return db
    .select()
    .from(favorites)
    .where(eq(favorites.userId, userId))
    .orderBy(desc(favorites.createdAt))
}

export async function isInFavorites(mediaId: number, mediaType: string) {
  const userId = await getOptionalUserId()
  if (!userId) return false
  
  const result = await db
    .select()
    .from(favorites)
    .where(
      and(
        eq(favorites.userId, userId),
        eq(favorites.mediaId, mediaId),
        eq(favorites.mediaType, mediaType)
      )
    )
    .limit(1)

  return result.length > 0
}

// Continue Watching actions
export async function updateContinueWatching(data: {
  mediaId: number
  mediaType: string
  title: string
  posterPath: string | null
  progress: number
  duration: number
  seasonNumber?: number
  episodeNumber?: number
}) {
  const userId = await getUserId()
  
  const existing = await db
    .select()
    .from(continueWatching)
    .where(
      and(
        eq(continueWatching.userId, userId),
        eq(continueWatching.mediaId, data.mediaId),
        eq(continueWatching.mediaType, data.mediaType)
      )
    )
    .limit(1)

  if (existing.length > 0) {
    await db
      .update(continueWatching)
      .set({
        progress: data.progress,
        duration: data.duration,
        seasonNumber: data.seasonNumber,
        episodeNumber: data.episodeNumber,
        updatedAt: new Date(),
      })
      .where(eq(continueWatching.id, existing[0].id))
  } else {
    await db.insert(continueWatching).values({
      userId,
      mediaId: data.mediaId,
      mediaType: data.mediaType,
      title: data.title,
      posterPath: data.posterPath,
      progress: data.progress,
      duration: data.duration,
      seasonNumber: data.seasonNumber,
      episodeNumber: data.episodeNumber,
    })
  }

  revalidatePath('/')
  return { success: true }
}

export async function getContinueWatching() {
  const userId = await getUserId()
  
  return db
    .select()
    .from(continueWatching)
    .where(eq(continueWatching.userId, userId))
    .orderBy(desc(continueWatching.updatedAt))
}

export async function removeContinueWatching(mediaId: number, mediaType: string) {
  const userId = await getUserId()
  
  await db
    .delete(continueWatching)
    .where(
      and(
        eq(continueWatching.userId, userId),
        eq(continueWatching.mediaId, mediaId),
        eq(continueWatching.mediaType, mediaType)
      )
    )

  revalidatePath('/')
  return { success: true }
}

// Watch Party actions
export async function createWatchParty(data: {
  mediaId: number
  mediaType: string
  title: string
  posterPath: string | null
}) {
  const userId = await getUserId()
  const partyId = nanoid(10)
  
  await db.insert(watchParty).values({
    id: partyId,
    hostId: userId,
    mediaId: data.mediaId,
    mediaType: data.mediaType,
    title: data.title,
    posterPath: data.posterPath,
  })

  await db.insert(watchPartyMembers).values({
    partyId,
    userId,
  })

  return { success: true, partyId }
}

export async function joinWatchParty(partyId: string) {
  const userId = await getUserId()
  
  const party = await db
    .select()
    .from(watchParty)
    .where(and(eq(watchParty.id, partyId), eq(watchParty.isActive, true)))
    .limit(1)

  if (party.length === 0) {
    return { success: false, message: 'Watch party not found or ended' }
  }

  const existing = await db
    .select()
    .from(watchPartyMembers)
    .where(and(eq(watchPartyMembers.partyId, partyId), eq(watchPartyMembers.userId, userId)))
    .limit(1)

  if (existing.length === 0) {
    await db.insert(watchPartyMembers).values({
      partyId,
      userId,
    })
  }

  return { success: true, party: party[0] }
}

export async function endWatchParty(partyId: string) {
  const userId = await getUserId()
  
  const party = await db
    .select()
    .from(watchParty)
    .where(and(eq(watchParty.id, partyId), eq(watchParty.hostId, userId)))
    .limit(1)

  if (party.length === 0) {
    return { success: false, message: 'Not authorized' }
  }

  await db.update(watchParty).set({ isActive: false }).where(eq(watchParty.id, partyId))

  return { success: true }
}

export async function getWatchParty(partyId: string) {
  const party = await db
    .select()
    .from(watchParty)
    .where(eq(watchParty.id, partyId))
    .limit(1)

  if (party.length === 0) return null

  const members = await db
    .select()
    .from(watchPartyMembers)
    .where(eq(watchPartyMembers.partyId, partyId))

  return { ...party[0], memberCount: members.length }
}

export async function getActiveWatchParties() {
  const userId = await getUserId()
  
  return db
    .select()
    .from(watchParty)
    .where(and(eq(watchParty.hostId, userId), eq(watchParty.isActive, true)))
    .orderBy(desc(watchParty.createdAt))
}

export { nanoid }
