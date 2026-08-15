'use client';

import React from 'react';
import { Download, ExternalLink, Play } from 'lucide-react';

interface Character {
  name: string;
  role: string;
  audioClipUrl?: string;
}

interface RelatedFilm {
  title: string;
  id: string;
  imdbUrl: string;
  watchUrl: string;
}

interface MediaDetailProps {
  title: string;
  synopsis: string;
  trailerUrl: string;
  downloadUrl: string;
  characters: Character[];
  relatedFilms: RelatedFilm[];
}

export function MediaDetailView({
  title,
  synopsis,
  trailerUrl,
  downloadUrl,
  characters,
  relatedFilms,
}: MediaDetailProps) {
  return (
    <div className="max-w-4xl mx-auto p-6 bg-[#08030d] text-gray-100 rounded-xl border border-red-950/40">
      <h1 className="text-3xl font-bold tracking-tight mb-3 text-red-500">{title}</h1>
      <p className="text-gray-300 mb-6 leading-relaxed">{synopsis}</p>

      <div className="relative aspect-video bg-black rounded-lg overflow-hidden mb-6 border border-gray-800">
        <iframe
          src={trailerUrl}
          className="w-full h-full"
          allowFullScreen
          title={`${title} Trailer`}
        />
      </div>

      <div className="flex items-center justify-between mb-8 pb-6 border-b border-gray-800">
        <span className="text-sm text-gray-400">Stream or save media file directly</span>
        <a
          href={downloadUrl}
          download
          className="flex items-center gap-2 bg-red-700 hover:bg-red-600 text-white px-4 py-2.5 rounded-lg font-medium transition-colors"
        >
          <Download className="w-4 h-4" />
          Save Video
        </a>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-200">Characters & Voice Logs</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {characters.map((char, index) => (
            <div key={index} className="p-4 bg-gray-900/60 rounded-lg border border-gray-800 flex items-center justify-between">
              <div>
                <h3 className="font-medium text-white">{char.name}</h3>
                <p className="text-xs text-gray-400">{char.role}</p>
              </div>
              {char.audioClipUrl && (
                <audio controls className="h-8 w-32 accent-red-600">
                  <source src={char.audioClipUrl} type="audio/mpeg" />
                </audio>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4 text-gray-200">Relevant Films & Connections</h2>
        <div className="space-y-3">
          {relatedFilms.map((film, index) => (
            <div key={index} className="flex items-center justify-between p-3.5 bg-gray-900/40 rounded-lg border border-gray-800">
              <span className="font-medium text-gray-200">{film.title}</span>
              <div className="flex items-center gap-3">
                <a
                  href={film.imdbUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-amber-400 hover:underline"
                >
                  IMDb <ExternalLink className="w-3 h-3" />
                </a>
                <a
                  href={film.watchUrl}
                  className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-white text-xs px-3 py-1.5 rounded-md transition-colors"
                >
                  <Play className="w-3 h-3" /> Watch Link
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}