'use client'

import { useState, useMemo } from 'react'
import { MediaCard } from './media-card'
import type { MediaItem, Genre } from '@/lib/tmdb'

interface HomeFiltersProps {
  items: MediaItem[]
  movieGenres: Genre[]
  tvGenres: Genre[]
}

type Category = 'all' | 'movie' | 'tv'
type SortBy = 'trending' | 'popularity' | 'rating'

export function HomeFilters({ items, movieGenres, tvGenres }: HomeFiltersProps) {
  const [category, setCategory] = useState<Category>('all')
  const [selectedGenre, setSelectedGenre] = useState<number | null>(null)
  const [sortBy, setSortBy] = useState<SortBy>('trending')

  // Build a combined genre list, deduped by id
  const allGenres = useMemo(() => {
    const map = new Map<number, string>()
    for (const g of movieGenres) map.set(g.id, g.name)
    for (const g of tvGenres) map.set(g.id, g.name)
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name)
    )
  }, [movieGenres, tvGenres])

  // Only show genres that actually appear in the current category's items
  const availableGenres = useMemo(() => {
    const filtered = category === 'all' ? items : items.filter((i) => i.media_type === category)
    const ids = new Set<number>()
    for (const item of filtered) {
      for (const gid of item.genre_ids || []) ids.add(gid)
    }
    return allGenres.filter((g) => ids.has(g.id))
  }, [allGenres, items, category])

  const filtered = useMemo(() => {
    let result = [...items]

    // Category filter
    if (category !== 'all') {
      result = result.filter((i) => i.media_type === category)
    }

    // Genre filter
    if (selectedGenre !== null) {
      result = result.filter((i) => (i.genre_ids || []).includes(selectedGenre))
    }

    // Sort
    if (sortBy === 'popularity') {
      result.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
    } else if (sortBy === 'rating') {
      result.sort((a, b) => b.vote_average - a.vote_average)
    }
    // 'trending' keeps original order

    return result
  }, [items, category, selectedGenre, sortBy])

  return (
    <section className="px-4 sm:px-6 lg:px-8">
      <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-4">Browse</h2>

      {/* Filter bar */}
      <div className="flex flex-col gap-3 mb-6">
        {/* Category + Sort row */}
        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'movie', 'tv'] as Category[]).map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setCategory(cat)
                setSelectedGenre(null)
              }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                category === cat
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {cat === 'all' ? 'All' : cat === 'movie' ? 'Movies' : 'TV Shows'}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            >
              <option value="trending">Trending</option>
              <option value="popularity">Popularity</option>
              <option value="rating">Top Rated</option>
            </select>
          </div>
        </div>

        {/* Genre pills */}
        {availableGenres.length > 0 && (
          <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
            <button
              onClick={() => setSelectedGenre(null)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                selectedGenre === null
                  ? 'bg-primary/20 text-primary border border-primary/40'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-transparent'
              }`}
            >
              All Genres
            </button>
            {availableGenres.map((genre) => (
              <button
                key={genre.id}
                onClick={() =>
                  setSelectedGenre(selectedGenre === genre.id ? null : genre.id)
                }
                className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  selectedGenre === genre.id
                    ? 'bg-primary/20 text-primary border border-primary/40'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-transparent'
                }`}
              >
                {genre.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground mb-4">
        {filtered.length} {filtered.length === 1 ? 'title' : 'titles'} found
      </p>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filtered.map((item) => (
            <MediaCard key={`${item.id}-${item.media_type}`} item={item} size="sm" />
          ))}
        </div>
      ) : (
        <div className="py-12 text-center text-muted-foreground">
          No titles match your filters. Try a different genre or category.
        </div>
      )}
    </section>
  )
}
