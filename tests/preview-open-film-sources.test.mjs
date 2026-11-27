import test from "node:test";
import assert from "node:assert/strict";
import { OPEN_FILMS, commonsChoices } from "../src/pages/previewOpenFilmSources.js";
const film=OPEN_FILMS[0];
const url="https://upload.wikimedia.org/wikipedia/commons/transcoded/c/c0/Big_Buck_Bunny_4K.webm/Big_Buck_Bunny_4K.webm.";
const fixture=rows=>({query:{pages:[{title:film.file,videoinfo:[{derivatives:rows.map(src=>({src}))}]}]}});
test("open film preview ranks unique real media URLs and excludes unsafe or oversized choices",()=>{
  const rows=commonsChoices(fixture([url+"480p.vp9.webm",url+"720p.vp9.webm",url+"720p.vp9.webm",url+"2160p.vp9.webm",url+"360p.vp9.webm","https://example.test/360p.vp9.webm",url.replace("https:","http:")+"1080p.vp9.webm"]),film);
  assert.deepEqual(rows.map(r=>r.height),[720,480,360]);
  assert.ok(rows.every(r=>r.type==="file"&&r.src===r.url&&!r.mediaInfo));
  assert.deepEqual(commonsChoices(fixture([url+"480p.vp9.webm"]),{file:"File:Other.webm"}),[]);
});
