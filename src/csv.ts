// CSV 入出力。Excel / Googleスプレッドシートで開けるよう BOM 付き UTF-8。

import type { Machine, Mood, PreferredMachine, ScoreLog, Song } from './types';
import { MACHINES, MOODS, PREFERRED_MACHINES } from './types';
import { newId } from './users';
import { normalize } from './normalize';

const SONG_COLS = [
  'id', 'title', 'titleKana', 'artist', 'artistKana', 'rating', 'key', 'preferredMachine',
  'mood', 'tags', 'favorite', 'memo', 'artworkUrl', 'itunesTrackId', 'createdAt', 'updatedAt',
] as const;

const LOG_COLS = [
  'id', 'songId', 'songTitle', 'artist', 'date', 'machine', 'scoringMode', 'score', 'keyUsed',
  'memo', 'createdAt',
] as const;

function esc(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: Record<string, unknown>[], cols: readonly string[]): string {
  return '﻿' + [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\r\n');
}

export function songsToCsv(songs: Song[]): string {
  return toCsv(
    songs.map((s) => ({ ...s, tags: s.tags.join('|'), favorite: s.favorite ? 1 : 0, mood: s.mood ?? '' })),
    SONG_COLS,
  );
}

export function logsToCsv(logs: ScoreLog[], songs: Song[]): string {
  const byId = new Map(songs.map((s) => [s.id, s]));
  return toCsv(
    logs.map((l) => ({ ...l, songTitle: byId.get(l.songId)?.title ?? '', artist: byId.get(l.songId)?.artist ?? '' })),
    LOG_COLS,
  );
}

export function parseCsv(text: string): Record<string, string>[] {
  const src = text.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else q = false;
      } else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((r) => r.some((x) => x.trim() !== ''));
  if (!header) return [];
  const h = header.map((x) => x.trim());
  return body.map((r) => Object.fromEntries(h.map((k, i) => [k, r[i] ?? ''])));
}

// 列名のゆれ（日本語ヘッダ）も受け付ける
const ALIASES: Record<string, string> = {
  曲名: 'title', タイトル: 'title', 歌手名: 'artist', アーティスト: 'artist', 歌手: 'artist',
  キー: 'key', 歌える度: 'rating', 評価: 'rating', タグ: 'tags', メモ: 'memo', 曲調: 'mood',
  点数: 'score', 得点: 'score', 日付: 'date', 機種: 'machine',
};

function canon(row: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) out[ALIASES[k] ?? k] = v;
  return out;
}

const clampInt = (v: string, min: number, max: number, def: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && v.trim() !== '' ? Math.min(max, Math.max(min, n)) : def;
};

export type CsvKind = 'songs' | 'logs' | 'unknown';

export function detectKind(rows: Record<string, string>[]): CsvKind {
  if (!rows.length) return 'unknown';
  const keys = Object.keys(canon(rows[0]));
  if (keys.includes('score') || keys.includes('songId')) return 'logs';
  if (keys.includes('title') && keys.includes('artist')) return 'songs';
  return 'unknown';
}

export function rowsToSongs(rows: Record<string, string>[], existing: Song[]): Song[] {
  const now = new Date().toISOString();
  const byKey = new Map(existing.map((s) => [`${normalize(s.title)}\u0000${normalize(s.artist)}`, s]));
  const byId = new Map(existing.map((s) => [s.id, s]));
  const out: Song[] = [];
  for (const raw of rows) {
    const r = canon(raw);
    if (!r.title?.trim() || !r.artist?.trim()) continue;
    const prev = (r.id && byId.get(r.id)) || byKey.get(`${normalize(r.title)}\u0000${normalize(r.artist)}`);
    out.push({
      id: prev?.id ?? (r.id || newId()),
      title: r.title.trim(),
      titleKana: r.titleKana?.trim() || prev?.titleKana || undefined,
      artist: r.artist.trim(),
      artistKana: r.artistKana?.trim() || prev?.artistKana || undefined,
      artworkUrl: r.artworkUrl || prev?.artworkUrl || undefined,
      itunesTrackId: r.itunesTrackId ? Number(r.itunesTrackId) : prev?.itunesTrackId,
      rating: clampInt(r.rating ?? '', 1, 5, prev?.rating ?? 3),
      key: clampInt(r.key ?? '', -12, 12, prev?.key ?? 0),
      preferredMachine: PREFERRED_MACHINES.includes(r.preferredMachine as PreferredMachine)
        ? (r.preferredMachine as PreferredMachine)
        : prev?.preferredMachine ?? 'どちらでも',
      mood: MOODS.includes(r.mood as Mood) ? (r.mood as Mood) : prev?.mood ?? null,
      tags: r.tags != null && r.tags !== '' ? r.tags.split(/[|｜]/).map((t) => t.trim()).filter(Boolean) : prev?.tags ?? [],
      favorite: r.favorite != null && r.favorite !== '' ? ['1', 'true', 'TRUE', '○', '★'].includes(r.favorite) : prev?.favorite ?? false,
      memo: r.memo ?? prev?.memo ?? '',
      createdAt: r.createdAt || prev?.createdAt || now,
      updatedAt: now,
    });
  }
  return out;
}

export function rowsToLogs(rows: Record<string, string>[], songs: Song[]): { logs: ScoreLog[]; skipped: number } {
  const ids = new Set(songs.map((s) => s.id));
  const byKey = new Map(songs.map((s) => [`${normalize(s.title)}\u0000${normalize(s.artist)}`, s]));
  const logs: ScoreLog[] = [];
  let skipped = 0;
  for (const raw of rows) {
    const r = canon(raw);
    const title = r.songTitle ?? r.title ?? '';
    const song = (r.songId && ids.has(r.songId) ? songs.find((s) => s.id === r.songId) : undefined) ??
      byKey.get(`${normalize(title)}\u0000${normalize(r.artist ?? '')}`);
    if (!song) {
      skipped++;
      continue;
    }
    const score = r.score?.trim() ? Number(r.score) : null;
    logs.push({
      id: r.id || newId(),
      songId: song.id,
      date: /^\d{4}-\d{2}-\d{2}/.test(r.date ?? '') ? r.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      machine: MACHINES.includes(r.machine as Machine) ? (r.machine as Machine) : 'その他',
      scoringMode: r.scoringMode || undefined,
      score: score != null && Number.isFinite(score) ? score : null,
      keyUsed: clampInt(r.keyUsed ?? r.key ?? '', -12, 12, song.key),
      memo: r.memo || undefined,
      createdAt: r.createdAt || new Date().toISOString(),
    });
  }
  return { logs, skipped };
}

export function download(filename: string, text: string, type = 'text/csv') {
  const blob = new Blob([text], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
