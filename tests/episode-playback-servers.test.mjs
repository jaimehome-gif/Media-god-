import assert from 'node:assert/strict'
import test from 'node:test'
import { movieServers, episodeServers } from '../lib/playback-servers.ts'

test('movie selector keeps the default and builds the four saved Primetime links', () => {
  assert.deepEqual(movieServers(1375441, 'tt34206385').map(s => s.url), [
    'https://share.cdnm.ink/embed/imdb/tt34206385',
    'https://vidapi.xyz/embed/movie/tt34206385',
    'https://balance.medmedia03.wiki/embed/movie/1375441',
    'https://sv2.nontongo.stream/soap/movie/tt34206385',
    'https://vidfast.vc/movie/tt34206385',
  ])
})

test('missing or invalid identifiers only remove the affected servers', () => {
  assert.deepEqual(movieServers(1375441, 'tt1?').map(s => s.name), ['MedMedia'])
  assert.equal(movieServers(NaN, 'tt34206385').length, 4)
  assert.deepEqual(movieServers(0), [])
})

test('both TV servers target the requested show, season and episode', () => {
  assert.deepEqual(episodeServers(1399, 2, 7).map(s => s.url), [
    'https://vidfast.vc/tv/1399/2/7',
    'https://vidsrc.sh/embed/tv/1399/2/7',
  ])
  assert.deepEqual(episodeServers(1399, 1, 0), [])
})
