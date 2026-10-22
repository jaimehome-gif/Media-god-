import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import * as matching from '../lib/episode-matching.ts'

function mockModule(routes, calls) {
  const source = readFileSync(new URL('../lib/real-debrid.ts', import.meta.url), 'utf8')
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const exports = {}
  const fetch = async (url, init = {}) => {
    const parsed = new URL(url)
    const key = `${init.method || 'GET'} ${parsed.pathname}`
    calls.push({ key, body: init.body ? String(init.body) : undefined })
    const result = routes[key]
    if (!result) throw new Error(`unexpected request: ${key}`)
    const response = typeof result === 'function' ? result(calls) : result
    return { ok: true, status: response === null ? 204 : 200, json: async () => response }
  }
  runInNewContext(code, {
    exports, require(specifier) {
      if (specifier === './episode-matching') return matching
      throw new Error(`unexpected import: ${specifier}`)
    },
    fetch, AbortSignal, URL, URLSearchParams,
  })
  return exports
}
const file = (id, name, selected = 0, bytes = 1000000000) =>
  ({ id, path: `/Example.Show.S01/${name}`, bytes, selected })
const files = [file(3, 'Example.Show.S01E01.mkv'), file(9, 'Example.Show.S01E02.mkv'), file(25, 'Example.Show.S01E03.mkv', 0, 9000000000)]

test('waiting_files_selection uses requested episode ID, NOT biggest video', async () => {
  const calls = []
  const routes = {
    'GET /rest/1.0/torrents/info/abc': (requestCalls) => requestCalls.length < 3
      ? { filename: 'Example Show S01', files, status: 'waiting_files_selection', links: [] }
      : { filename: 'Example Show S01', files, status: 'downloading', links: [], progress: 5 },
    'POST /rest/1.0/torrents/selectFiles/abc': null,
  }
  const rd = mockModule(routes, calls)
  const result = await rd.prepareTorrentStream('test-key', 'abc', { season: 1, episode: 2 })
  assert.equal(result.ready, false)
  assert.equal(calls.find(item => item.key.includes('selectFiles'))?.body, 'files=9')
})

test('downloaded multi-file packs use the correct selected file and link', async () => {
  const calls = []
  const selectedFiles = files.map(item => ({ ...item, selected: 1 }))
  const routes = {
    'GET /rest/1.0/torrents/info/xyz': {
      filename: 'Example Show S01', files: selectedFiles, status: 'downloaded',
      links: ['https://rd.example/file1', 'https://rd.example/file2', 'https://rd.example/file3'],
      progress: 100,
    },
    'POST /rest/1.0/unrestrict/link': {
      id: 'fileid', filename: 'Example.Show.S01E02.mkv', filesize: 1000000000,
      streamable: 1, download: 'https://files.example/download',
    },
    'GET /rest/1.0/streaming/transcode/fileid': { apple: { medium: 'https://video.example/index.m3u8' } },
  }
  const rd = mockModule(routes, calls)
  const result = await rd.prepareTorrentStream('test-key', 'xyz', { season: 1, episode: 2 })
  assert.equal(result.ready, true)
  assert.equal(result.streamingUrl, 'https://video.example/index.m3u8')
  assert.equal(calls.find(item => item.key.endsWith('/unrestrict/link'))?.body, 'link=https%3A%2F%2Frd.example%2Ffile2')
})

test('wrong episode is rejected rather than silently falling back to biggest file', async () => {
  const calls = []
  const rd = mockModule({ 'GET /rest/1.0/torrents/info/abc': {
    filename: 'Example Show S01', files, status: 'waiting_files_selection', links: [],
  } }, calls)
  await assert.rejects(
    () => rd.prepareTorrentStream('test-key', 'abc', { season: 1, episode: 8 }),
    error => error.code === 'EPISODE_NOT_FOUND',
  )
  assert.equal(calls.filter(item => item.key.includes('selectFiles')).length, 0)
})
