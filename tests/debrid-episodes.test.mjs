import test from 'node:test'
import assert from 'node:assert/strict'
import {
  matchesExactEpisode, isSeasonPack, matchesEpisodeResult, matchesEpisodeFile,
  matchesSeriesTitle, isVideoFile, isSampleOrTrailer,
} from '../lib/episode-matching.ts'

test('accepts common episode names, including ranges and 1x formats', () => {
  assert.equal(matchesExactEpisode('Example.Show.S01E03.1080p.mkv', 1, 3), true)
  assert.equal(matchesExactEpisode('Example Show 1x03.mp4', 1, 3), true)
  assert.equal(matchesExactEpisode('Example S01E03-E05', 1, 4), true)
  assert.equal(matchesExactEpisode('Example S01E04', 1, 5), false)
  assert.equal(matchesExactEpisode('Example S02E03', 1, 3), false)
})
test('keeps season packs but rejects other series and seasons', () => {
  assert.equal(isSeasonPack('Example Show Season 1 Complete', 1), true)
  assert.equal(isSeasonPack('Example.Show.S01.1080p', 1), true)
  assert.equal(isSeasonPack('Example.Show.S01E01.1080p', 1), false)
  assert.equal(isSeasonPack('Example.Show.S10.1080p', 1), false)
  assert.equal(matchesEpisodeResult('The.Example.Show.S01.1080p', 'The Example Show', 1, 5), true)
  assert.equal(matchesEpisodeResult('Other Show S01', 'The Example Show', 1, 5), false)
})
test('selects EXACT playable episode within a multi-file pack', () => {
  const parent = 'Example Show Season 2'
  assert.equal(matchesEpisodeFile('/Season 2/Episode 03.mkv', 2, 3, parent), true)
  assert.equal(matchesEpisodeFile('/Season 2/Episode 04.mkv', 2, 3, parent), false)
  assert.equal(matchesEpisodeFile('/Show S02E03 1080p.mkv', 2, 3, parent), true)
  assert.equal(matchesEpisodeFile('/Show S02E02 1080p.mkv', 2, 3, parent), false)
  assert.equal(matchesEpisodeFile('/Show S02E03 sample.mkv', 2, 3, parent), false)
  assert.equal(matchesEpisodeFile('/Show S02E03 trailer.mp4', 2, 3, parent), false)
  assert.equal(matchesEpisodeFile('/Subtitle.srt', 2, 3, parent), false)
  assert.equal(matchesEpisodeFile('/unknown-file.mkv', 2, 3, parent), false)
  assert.equal(isSampleOrTrailer('/path/sample.mkv'), true)
  assert.equal(isVideoFile('/S02E03.mp4'), true)
  assert.equal(matchesSeriesTitle('The.Example.Show.S01E01', 'The Example Show'), true)
})
