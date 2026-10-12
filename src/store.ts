// ローカルファーストのデータストア（IndexedDB）。
// 持ち歌は多くても数千件なので、起動時に全件メモリへ載せて React から購読する。

import { useSyncExternalStore } from 'react';
import type { ScoreLog, Song, SongStats } from './types';
import { dbNameFor, getCurrentUser, setUserPref, userPref } from './users';
import { normalize } from './normalize';

interface State {
  ready: boolean;
  userId: string;
  songs: Song[];
  logs: ScoreLog[];
  /** 変更のたびに増える */
  revision: number;
}

let state: State = { ready: false, userId: '', songs: [], logs: [], revision: 0 };
let db: IDBDatabase | null = null;
const listeners = new Set<() => void>();
const changeHooks = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function setState(patch: Partial<State>) {
  state = { ...state, ...patch };
  emit();
}

function openDB(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, 1);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains('songs')) d.createObjectStore('songs', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('logs')) d.createObjectStore('logs', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getAll<T>(storeName: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db!.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

function writeTx(fn: (songs: IDBObjectStore, logs: IDBObjectStore) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db!.transaction(['songs', 'logs'], 'readwrite');
    fn(tx.objectStore('songs'), tx.objectStore('logs'));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function initStore() {
  const user = getCurrentUser();
  if (db) db.close();
  db = await openDB(dbNameFor(user.id));
  const [songs, logs] = await Promise.all([getAll<Song>('songs'), getAll<ScoreLog>('logs')]);
  setState({ ready: true, userId: user.id, songs, logs, revision: state.revision + 1 });
}

function changed() {
  setUserPref('dirtyAt', new Date().toISOString());
  for (const h of changeHooks) h();
}

/** データ変更時に呼ばれるフック（自動バックアップ用） */
export function onDataChanged(fn: () => void) {
  changeHooks.add(fn);
  return () => changeHooks.delete(fn);
}

export function isDirtySinceBackup(): boolean {
  const dirty = userPref<string | null>('dirtyAt', null);
  const backed = userPref<string | null>('lastBackupAt', null);
  if (!dirty) return false;
  return !backed || dirty > backed;
}

export async function putSong(song: Song) {
  const s = { ...song, updatedAt: new Date().toISOString() };
  await writeTx((songs) => songs.put(s));
  const exists = state.songs.some((x) => x.id === s.id);
  setState({
    songs: exists ? state.songs.map((x) => (x.id === s.id ? s : x)) : [...state.songs, s],
    revision: state.revision + 1,
  });
  changed();
  return s;
}

export async function deleteSong(id: string) {
  const logIds = state.logs.filter((l) => l.songId === id).map((l) => l.id);
  await writeTx((songs, logs) => {
    songs.delete(id);
    for (const lid of logIds) logs.delete(lid);
  });
  setState({
    songs: state.songs.filter((s) => s.id !== id),
    logs: state.logs.filter((l) => l.songId !== id),
    revision: state.revision + 1,
  });
  changed();
}

export async function putLog(log: ScoreLog) {
  await writeTx((_s, logs) => logs.put(log));
  const exists = state.logs.some((x) => x.id === log.id);
  setState({
    logs: exists ? state.logs.map((x) => (x.id === log.id ? log : x)) : [...state.logs, log],
    revision: state.revision + 1,
  });
  changed();
}

export async function deleteLog(id: string) {
  await writeTx((_s, logs) => logs.delete(id));
  setState({ logs: state.logs.filter((l) => l.id !== id), revision: state.revision + 1 });
  changed();
}

/** 複数件をまとめて追加・更新（CSV取り込み、タグ一括変更など） */
export async function bulkPut(songs: Song[], logs: ScoreLog[]) {
  await writeTx((ss, ls) => {
    for (const s of songs) ss.put(s);
    for (const l of logs) ls.put(l);
  });
  const songMap = new Map(state.songs.map((s) => [s.id, s]));
  for (const s of songs) songMap.set(s.id, s);
  const logMap = new Map(state.logs.map((l) => [l.id, l]));
  for (const l of logs) logMap.set(l.id, l);
  setState({ songs: [...songMap.values()], logs: [...logMap.values()], revision: state.revision + 1 });
  changed();
}

/** 全データを置き換え（バックアップからの復元） */
export async function replaceAll(songs: Song[], logs: ScoreLog[]) {
  await writeTx((ss, ls) => {
    ss.clear();
    ls.clear();
    for (const s of songs) ss.put(s);
    for (const l of logs) ls.put(l);
  });
  setState({ songs, logs, revision: state.revision + 1 });
  changed();
}

export function getState() {
  return state;
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useStore(): State {
  return useSyncExternalStore(subscribe, () => state);
}

// ---- 派生データ ----

let statsCache: { rev: number; map: Map<string, SongStats> } | null = null;

export function getStatsMap(): Map<string, SongStats> {
  if (statsCache && statsCache.rev === state.revision) return statsCache.map;
  const map = new Map<string, SongStats>();
  const sorted = [...state.logs].sort((a, b) =>
    a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : a.date.localeCompare(b.date),
  );
  for (const log of sorted) {
    const st = map.get(log.songId) ?? { best: null, latest: null, count: 0, lastDate: null };
    st.count += 1;
    st.lastDate = log.date;
    if (log.score != null) {
      st.latest = log.score;
      if (st.best == null || log.score > st.best) st.best = log.score;
    }
    map.set(log.songId, st);
  }
  statsCache = { rev: state.revision, map };
  return map;
}

export const EMPTY_STATS: SongStats = { best: null, latest: null, count: 0, lastDate: null };

let haystackCache: { rev: number; map: Map<string, string> } | null = null;

/** 検索用に正規化した文字列（曲名・アーティスト・読み・タグ） */
export function getHaystack(song: Song): string {
  if (!haystackCache || haystackCache.rev !== state.revision) {
    haystackCache = { rev: state.revision, map: new Map() };
  }
  let h = haystackCache.map.get(song.id);
  if (h == null) {
    h = [song.title, song.titleKana, song.artist, song.artistKana, ...song.tags, song.memo, ...logMemos(song.id).map((m) => m.text)]
      .map(normalize)
      .join('\u0000');
    haystackCache.map.set(song.id, h);
  }
  return h;
}

let logMemoCache: { rev: number; map: Map<string, { date: string; text: string }[]> } | null = null;

/** その曲の歌唱ログに書いたメモ（新しい順） */
function logMemos(songId: string): { date: string; text: string }[] {
  if (!logMemoCache || logMemoCache.rev !== state.revision) {
    const map = new Map<string, { date: string; text: string }[]>();
    for (const l of state.logs) {
      if (!l.memo?.trim()) continue;
      const arr = map.get(l.songId) ?? [];
      arr.push({ date: l.date, text: l.memo.trim() });
      map.set(l.songId, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => b.date.localeCompare(a.date));
    logMemoCache = { rev: state.revision, map };
  }
  return logMemoCache.map.get(songId) ?? [];
}

/** 検索語がメモに当たっていれば、一覧に出す抜粋を返す */
export function memoHit(song: Song, query: string): { label: string; text: string } | null {
  const terms = query.split(/[\s\u3000]+/).map(normalize).filter(Boolean);
  if (!terms.length) return null;
  const hits = (text: string) => {
    const n = normalize(text);
    return terms.some((t) => n.includes(t));
  };
  if (song.memo?.trim() && hits(song.memo)) return { label: 'メモ', text: song.memo.trim() };
  const lm = logMemos(song.id).find((m) => hits(m.text));
  if (lm) return { label: `歌唱メモ ${Number(lm.date.slice(5, 7))}/${Number(lm.date.slice(8, 10))}`, text: lm.text };
  return null;
}

export function allTags(): string[] {
  const set = new Set<string>();
  for (const s of state.songs) for (const t of s.tags) set.add(t);
  return [...set].sort((a, b) => a.localeCompare(b, 'ja'));
}

export function findDuplicate(title: string, artist: string, trackId?: number, exceptId?: string) {
  const nt = normalize(title);
  const na = normalize(artist);
  return state.songs.find(
    (s) =>
      s.id !== exceptId &&
      ((trackId != null && s.itunesTrackId === trackId) ||
        (normalize(s.title) === nt && normalize(s.artist) === na)),
  );
}
