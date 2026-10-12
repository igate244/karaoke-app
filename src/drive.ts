// Googleドライブ バックアップ（Google Identity Services のトークン方式、drive.file スコープ）。
// drive.file は「このアプリが作ったファイルだけ」触れる非機密スコープ。

import { getCurrentUser, pref, setPref, setUserPref, userPref } from './users';
import { getState, replaceAll } from './store';
import type { ScoreLog, Song } from './types';

declare const __GOOGLE_CLIENT_ID__: string;

const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const FOLDER_NAME = 'カラオケ持ち歌バックアップ';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

interface TokenClient {
  requestAccessToken(opts?: { prompt?: string }): void;
  callback: (resp: { access_token?: string; expires_in?: number; error?: string }) => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(cfg: {
            client_id: string;
            scope: string;
            callback: TokenClient['callback'];
            error_callback?: (e: { type: string }) => void;
          }): TokenClient;
          revoke(token: string, cb?: () => void): void;
        };
      };
    };
  }
}

export interface BackupPayload {
  app: 'karaoke-app';
  version: 1;
  exportedAt: string;
  userName: string;
  songs: Song[];
  logs: ScoreLog[];
}

export interface BackupFile {
  id: string;
  name: string;
  modifiedTime: string;
  size?: string;
  appProperties?: Record<string, string>;
}

export function clientId(): string {
  const fromBuild = typeof __GOOGLE_CLIENT_ID__ === 'string' ? __GOOGLE_CLIENT_ID__ : '';
  return pref<string>('googleClientId', '') || fromBuild;
}

// ---- トークン ----

const TOKEN_KEY = 'karaoke:driveToken';

function savedToken(): string | null {
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const { token, exp } = JSON.parse(raw) as { token: string; exp: number };
    return Date.now() < exp - 60_000 ? token : null;
  } catch {
    return null;
  }
}

export function isSignedIn(): boolean {
  return savedToken() != null;
}

let gisLoading: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (!gisLoading) {
    gisLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        gisLoading = null;
        reject(new Error('Googleのログイン部品を読み込めませんでした（オフライン？）'));
      };
      document.head.appendChild(s);
    });
  }
  return gisLoading;
}

let tokenClient: TokenClient | null = null;

/** ボタン操作から呼ぶ（ポップアップが出る） */
export async function signIn(): Promise<string> {
  const id = clientId();
  if (!id) throw new Error('GoogleのクライアントIDが未設定です');
  await loadGis();
  return new Promise((resolve, reject) => {
    tokenClient = window.google!.accounts.oauth2.initTokenClient({
      client_id: id,
      scope: SCOPE,
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error ?? 'ログインに失敗しました'));
          return;
        }
        try {
          sessionStorage.setItem(
            TOKEN_KEY,
            JSON.stringify({ token: resp.access_token, exp: Date.now() + (resp.expires_in ?? 3600) * 1000 }),
          );
        } catch {
          /* noop */
        }
        resolve(resp.access_token);
      },
      error_callback: (e) => reject(new Error(e.type === 'popup_closed' ? 'ログインが閉じられました' : e.type)),
    });
    tokenClient.requestAccessToken({ prompt: '' });
  });
}

export function signOut() {
  const t = savedToken();
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* noop */
  }
  if (t && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(t);
}

async function api<T>(url: string, init: RequestInit = {}): Promise<T> {
  const token = savedToken();
  if (!token) throw new Error('Googleにログインしてください');
  const res = await fetch(url, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      /* noop */
    }
    throw new Error('ログインの期限が切れました。もう一度ログインしてください');
  }
  if (!res.ok) throw new Error(`Drive API エラー (${res.status})`);
  const ct = res.headers.get('content-type') ?? '';
  return (ct.includes('json') ? res.json() : res.text()) as Promise<T>;
}

// ---- フォルダとファイル ----

async function ensureFolder(): Promise<string> {
  const cached = pref<string | null>('driveFolderId', null);
  if (cached) {
    try {
      const f = await api<{ id: string; trashed: boolean }>(`${API}/files/${cached}?fields=id,trashed`);
      if (!f.trashed) return f.id;
    } catch {
      /* 作り直す */
    }
  }
  const q = encodeURIComponent(
    `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );
  const list = await api<{ files: { id: string }[] }>(`${API}/files?q=${q}&fields=files(id)&spaces=drive`);
  let id = list.files[0]?.id;
  if (!id) {
    const created = await api<{ id: string }>(`${API}/files?fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
    });
    id = created.id;
  }
  setPref('driveFolderId', id);
  return id;
}

function multipart(metadata: object, body: string) {
  const boundary = `karaoke${Math.random().toString(36).slice(2)}`;
  const data =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`;
  return { boundary, data };
}

function payload(): BackupPayload {
  const { songs, logs } = getState();
  return {
    app: 'karaoke-app',
    version: 1,
    exportedAt: new Date().toISOString(),
    userName: getCurrentUser().name,
    songs,
    logs,
  };
}

function stamp(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

/**
 * kind=auto: 利用者ごとの「自動」ファイル1つを上書き
 * kind=manual: 日時付きファイルを新規作成（履歴として残る）
 */
export async function backup(kind: 'auto' | 'manual'): Promise<void> {
  const folder = await ensureFolder();
  const user = getCurrentUser();
  const body = JSON.stringify(payload());
  const appProperties = { app: 'karaoke-app', userId: user.id, userName: user.name, kind };

  if (kind === 'auto') {
    const autoId = userPref<string | null>('driveAutoFileId', null);
    if (autoId) {
      try {
        const { boundary, data } = multipart({ appProperties }, body);
        await api(`${UPLOAD}/files/${autoId}?uploadType=multipart&fields=id`, {
          method: 'PATCH',
          headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
          body: data,
        });
        setUserPref('lastBackupAt', new Date().toISOString());
        return;
      } catch (e) {
        if (String(e).includes('ログイン')) throw e;
        // ファイルが消されていたら作り直す
      }
    }
  }

  const name = kind === 'auto' ? `${user.name}_自動.json` : `${user.name}_${stamp()}.json`;
  const { boundary, data } = multipart({ name, parents: [folder], appProperties, mimeType: 'application/json' }, body);
  const created = await api<{ id: string }>(`${UPLOAD}/files?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body: data,
  });
  if (kind === 'auto') setUserPref('driveAutoFileId', created.id);
  setUserPref('lastBackupAt', new Date().toISOString());
}

export async function listBackups(): Promise<BackupFile[]> {
  const folder = await ensureFolder();
  const q = encodeURIComponent(`'${folder}' in parents and trashed=false`);
  const res = await api<{ files: BackupFile[] }>(
    `${API}/files?q=${q}&orderBy=modifiedTime desc&pageSize=50&fields=files(id,name,modifiedTime,size,appProperties)`,
  );
  return res.files;
}

export async function restore(fileId: string): Promise<{ songs: number; logs: number }> {
  const data = await api<BackupPayload | string>(`${API}/files/${fileId}?alt=media`);
  const p = (typeof data === 'string' ? JSON.parse(data) : data) as BackupPayload;
  if (p.app !== 'karaoke-app' || !Array.isArray(p.songs) || !Array.isArray(p.logs)) {
    throw new Error('このアプリのバックアップではありません');
  }
  await replaceAll(p.songs, p.logs);
  setUserPref('lastBackupAt', new Date().toISOString());
  return { songs: p.songs.length, logs: p.logs.length };
}

// ---- 自動バックアップ ----

let timer: number | undefined;

/** データ変更のたびに呼ぶ。ログイン中なら少し待ってまとめて上書き保存 */
export function scheduleAutoBackup(onDone?: (err?: unknown) => void) {
  if (!userPref<boolean>('autoBackup', true)) return;
  if (!isSignedIn()) return;
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    backup('auto').then(
      () => onDone?.(),
      (e) => onDone?.(e),
    );
  }, 4000);
}
