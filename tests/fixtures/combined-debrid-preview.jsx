import "../../src/index.css";
import { mountTorrentTitle } from "./website-torrent-sources.jsx";
mountTorrentTitle({url:new URL("/decoder-lab/samples/aac.mp4",location.href).href, mode:"missing-codecs",videoCodec:"h264",audioCodec:"aac"});
