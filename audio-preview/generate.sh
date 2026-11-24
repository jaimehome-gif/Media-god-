#!/bin/sh
set -eu
mkdir -p audio-preview/dist/media
cd audio-preview/dist/media
ffmpeg -hide_banner -loglevel error -y -f lavfi -i testsrc2=size=320x180:rate=24 -f lavfi -i sine=frequency=440:sample_rate=48000 -t 7 -c:v libx264 -profile:v baseline -pix_fmt yuv420p -g 24 -c:a aac -ac 2 -movflags +faststart sample.mp4
ffmpeg -hide_banner -loglevel error -y -f lavfi -i testsrc2=size=320x180:rate=24 -f lavfi -i sine=frequency=440:sample_rate=48000 -t 7 -c:v libvpx-vp9 -b:v 300k -c:a libopus -ac 2 sample.webm
ffmpeg -hide_banner -loglevel error -y -i sample.mp4 -c copy -f hls -hls_time 1 -hls_playlist_type vod -hls_segment_filename segment%03d.ts sample.m3u8
