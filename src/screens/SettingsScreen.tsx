import { useEffect, useRef, useState } from 'react';
import { allTags, bulkPut, getState, initStore, isDirtySinceBackup, useStore } from '../store';
import {
  addUser,
  getCurrentUser,
  getUsers,
  pref,
  removeUser,
  renameUser,
  setCurrentUser,
  setPref,
  setUserPref,
  userPref,
} from '../users';
import { backup, clientId, isSignedIn, listBackups, restore, signIn, signOut, type BackupFile } from '../drive';
import { detectKind, download, logsToCsv, parseCsv, rowsToLogs, rowsToSongs, songsToCsv } from '../csv';
import { Icon, Sheet, toast } from '../components/ui';

declare const __BUILD_TIME__: string;

function fmtDateTime(iso: string | null) {
  if (!iso) return 'まだ';
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function SettingsScreen() {
  const { songs, logs } = useStore();
  const [, force] = useState(0);
  const refresh = () => force((n) => n + 1);
  const user = getCurrentUser();
  const users = getUsers();

  return (
    <div className="screen">
      <header className="screen-head">
        <h1>設定</h1>
      </header>

      <DriveSection refresh={refresh} />

      <section className="card">
        <h2>利用者</h2>
        <p className="hint">家族や友だちと1台を共有するときに。データは利用者ごとに別々。</p>
        <ul className="plain-list">
          {users.map((u) => (
            <li key={u.id}>
              <button
                className={`user-btn ${u.id === user.id ? 'on' : ''}`}
                onClick={async () => {
                  if (u.id === user.id) return;
                  setCurrentUser(u.id);
                  await initStore();
                  sessionStorage.removeItem('karaoke:filters');
                  toast(`${u.name} に切り替えたよ`);
                  refresh();
                }}
              >
                {u.id === user.id ? '● ' : '○ '}
                {u.name}
              </button>
              <button
                className="icon-btn"
                aria-label="名前を変更"
                onClick={() => {
                  const n = prompt('名前', u.name);
                  if (n) {
                    renameUser(u.id, n);
                    refresh();
                  }
                }}
              >
                <Icon name="edit" size={16} />
              </button>
              {u.id !== user.id && (
                <button
                  className="icon-btn"
                  aria-label="利用者を削除"
                  onClick={() => {
                    if (!confirm(`${u.name} とそのデータをこの端末から削除する？（Driveのバックアップは残る）`)) return;
                    removeUser(u.id);
                    refresh();
                  }}
                >
                  <Icon name="trash" size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
        <button
          className="btn"
          onClick={() => {
            const n = prompt('新しい利用者の名前');
            if (!n) return;
            addUser(n);
            refresh();
          }}
        >
          ＋ 利用者を追加
        </button>
      </section>

      <CsvSection />

      <TagSection />

      <section className="card">
        <h2>このアプリ</h2>
        <p className="hint">
          持ち歌 {songs.length}曲 / 歌唱ログ {logs.length}件
          <br />
          ビルド {typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : '-'}
        </p>
        <button className="btn" onClick={() => location.reload()}>
          再読み込み（更新の反映）
        </button>
      </section>
    </div>
  );
}

function DriveSection({ refresh }: { refresh: () => void }) {
  const [busy, setBusy] = useState(false);
  const [list, setList] = useState<BackupFile[] | null>(null);
  const [cid, setCid] = useState(pref('googleClientId', ''));
  const signedIn = isSignedIn();
  const hasClient = Boolean(clientId());
  const auto = userPref('autoBackup', true);
  const last = userPref<string | null>('lastBackupAt', null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      refresh();
    }
  };

  return (
    <section className="card">
      <h2>
        <Icon name="cloud" size={18} /> Googleドライブ バックアップ
      </h2>
      {!hasClient ? (
        <>
          <p className="hint">GoogleのOAuthクライアントIDが未設定。OPERATIONS.md の手順で作ってここに貼るか、GitHubの変数 GOOGLE_CLIENT_ID に入れてね。</p>
          <label className="field">
            <span>クライアントID</span>
            <input value={cid} onChange={(e) => setCid(e.target.value)} placeholder="xxxx.apps.googleusercontent.com" />
          </label>
          <button
            className="btn"
            disabled={!cid.trim()}
            onClick={() => {
              setPref('googleClientId', cid.trim());
              refresh();
            }}
          >
            保存
          </button>
        </>
      ) : (
        <>
          <p className="hint">
            最後のバックアップ：{fmtDateTime(last)}
            {isDirtySinceBackup() && <b className="warn-inline">（未保存の変更あり）</b>}
          </p>
          {!signedIn ? (
            <button className="btn primary block" disabled={busy} onClick={() => run(async () => {
              await signIn();
              if (isDirtySinceBackup()) await backup('auto');
              toast('Googleに接続したよ');
            })}>
              Googleに接続
            </button>
          ) : (
            <div className="grid2">
              <button className="btn primary" disabled={busy} onClick={() => run(async () => {
                await backup('manual');
                toast('バックアップしたよ');
              })}>
                今すぐバックアップ
              </button>
              <button className="btn" disabled={busy} onClick={() => run(async () => setList(await listBackups()))}>
                復元…
              </button>
            </div>
          )}
          <label className="field check">
            <input
              type="checkbox"
              checked={auto}
              onChange={(e) => {
                setUserPref('autoBackup', e.target.checked);
                refresh();
              }}
            />
            <span>自動バックアップ（接続中は変更のたびに「自動」ファイルを上書き）</span>
          </label>
          {signedIn && (
            <button className="link-btn" onClick={() => { signOut(); refresh(); }}>
              接続を解除
            </button>
          )}
        </>
      )}

      <Sheet open={list != null} onClose={() => setList(null)} title="どのバックアップから戻す？">
        {list?.length === 0 && <p className="hint">バックアップが見つからないよ</p>}
        <p className="warn">復元すると、いまの利用者（{getCurrentUser().name}）のデータは置き換わるよ。</p>
        <ul className="plain-list">
          {list?.map((f) => (
            <li key={f.id}>
              <button
                className="user-btn"
                disabled={busy}
                onClick={() => {
                  if (!confirm(`「${f.name}」で置き換える？`)) return;
                  run(async () => {
                    const r = await restore(f.id);
                    setList(null);
                    toast(`${r.songs}曲・${r.logs}件を復元したよ`);
                  });
                }}
              >
                <b>{f.name}</b>
                <small className="muted"> {fmtDateTime(f.modifiedTime)}</small>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </section>
  );
}

function CsvSection() {
  const fileRef = useRef<HTMLInputElement>(null);
  const stamp = new Date().toISOString().slice(0, 10);
  return (
    <section className="card">
      <h2>CSV</h2>
      <p className="hint">スプレッドシートで一括編集したいときや、他のアプリからの移行に。曲名・アーティスト列があれば取り込めるよ。</p>
      <div className="grid2">
        <button className="btn" onClick={() => download(`持ち歌_${stamp}.csv`, songsToCsv(getState().songs))}>
          曲を書き出し
        </button>
        <button className="btn" onClick={() => download(`歌唱ログ_${stamp}.csv`, logsToCsv(getState().logs, getState().songs))}>
          ログを書き出し
        </button>
      </div>
      <button className="btn block" onClick={() => fileRef.current?.click()}>
        CSVを取り込む
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          const rows = parseCsv(await file.text());
          const kind = detectKind(rows);
          const { songs } = getState();
          if (kind === 'songs') {
            const out = rowsToSongs(rows, songs);
            if (!confirm(`${out.length}曲を取り込む？（同じ曲は上書き）`)) return;
            await bulkPut(out, []);
            toast(`${out.length}曲を取り込んだよ`);
          } else if (kind === 'logs') {
            const { logs, skipped } = rowsToLogs(rows, songs);
            if (!confirm(`${logs.length}件のログを取り込む？${skipped ? `（曲が見つからない${skipped}件は飛ばす）` : ''}`)) return;
            await bulkPut([], logs);
            toast(`${logs.length}件を取り込んだよ`);
          } else {
            toast('曲名・アーティストの列が見つからなかった');
          }
        }}
      />
    </section>
  );
}

function TagSection() {
  const { songs } = useStore();
  const tags = allTags();
  if (!tags.length) return null;
  const count = (t: string) => songs.filter((s) => s.tags.includes(t)).length;

  const renameTag = async (from: string) => {
    const to = prompt(`「${from}」の新しい名前（既存タグ名にすると統合）`, from)?.trim();
    if (!to || to === from) return;
    const changed = songs
      .filter((s) => s.tags.includes(from))
      .map((s) => ({ ...s, tags: [...new Set(s.tags.map((t) => (t === from ? to : t)))], updatedAt: new Date().toISOString() }));
    await bulkPut(changed, []);
    toast('タグを変更したよ');
  };
  const deleteTag = async (t: string) => {
    if (!confirm(`タグ「${t}」を全曲から外す？`)) return;
    const changed = songs
      .filter((s) => s.tags.includes(t))
      .map((s) => ({ ...s, tags: s.tags.filter((x) => x !== t), updatedAt: new Date().toISOString() }));
    await bulkPut(changed, []);
  };

  return (
    <section className="card">
      <h2>タグ管理</h2>
      <ul className="plain-list">
        {tags.map((t) => (
          <li key={t}>
            <span className="tag-name">
              #{t} <small className="muted">{count(t)}曲</small>
            </span>
            <button className="icon-btn" aria-label="名前を変更" onClick={() => renameTag(t)}>
              <Icon name="edit" size={16} />
            </button>
            <button className="icon-btn" aria-label="削除" onClick={() => deleteTag(t)}>
              <Icon name="trash" size={16} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** 未バックアップの変更が1日以上あるか（設定タブのバッジ用） */
export function useBackupReminder(): boolean {
  const { revision } = useStore();
  const [flag, setFlag] = useState(false);
  useEffect(() => {
    const last = userPref<string | null>('lastBackupAt', null);
    const old = !last || Date.now() - new Date(last).getTime() > 24 * 3600 * 1000;
    setFlag(Boolean(clientId()) && isDirtySinceBackup() && old && getState().songs.length > 0);
  }, [revision]);
  return flag;
}
