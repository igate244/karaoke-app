// 利用者（端末内の複数プロフィール）。データは利用者ごとに別の IndexedDB に入る。

export interface AppUser {
  id: string;
  name: string;
}

const USERS_KEY = 'karaoke:users';
const CURRENT_KEY = 'karaoke:currentUser';

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* noop */
  }
}

export function getUsers(): AppUser[] {
  const users = read<AppUser[]>(USERS_KEY, []);
  if (users.length === 0) {
    const first = { id: 'default', name: 'わたし' };
    write(USERS_KEY, [first]);
    return [first];
  }
  return users;
}

export function getCurrentUser(): AppUser {
  const users = getUsers();
  const id = read<string>(CURRENT_KEY, users[0].id);
  return users.find((u) => u.id === id) ?? users[0];
}

export function setCurrentUser(id: string) {
  write(CURRENT_KEY, id);
}

export function addUser(name: string): AppUser {
  const user = { id: newId(), name: name.trim() || '名無し' };
  write(USERS_KEY, [...getUsers(), user]);
  return user;
}

export function renameUser(id: string, name: string) {
  write(
    USERS_KEY,
    getUsers().map((u) => (u.id === id ? { ...u, name: name.trim() || u.name } : u)),
  );
}

export function removeUser(id: string) {
  write(
    USERS_KEY,
    getUsers().filter((u) => u.id !== id),
  );
  try {
    indexedDB.deleteDatabase(dbNameFor(id));
  } catch {
    /* noop */
  }
}

export function dbNameFor(userId: string) {
  return `karaoke-${userId}`;
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** 利用者ごとの設定値 */
export function userPref<T>(name: string, fallback: T): T {
  return read<T>(`karaoke:${getCurrentUser().id}:${name}`, fallback);
}

export function setUserPref(name: string, value: unknown) {
  write(`karaoke:${getCurrentUser().id}:${name}`, value);
}

/** 端末全体の設定値 */
export function pref<T>(name: string, fallback: T): T {
  return read<T>(`karaoke:pref:${name}`, fallback);
}

export function setPref(name: string, value: unknown) {
  write(`karaoke:pref:${name}`, value);
}
