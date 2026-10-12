import { useState } from 'react';
import type { Song } from '../types';
import { findDuplicate, putSong, useStore } from '../store';
import { artwork, searchItunes, type ItunesTrack } from '../itunes';
import { go } from '../router';
import { pref, setPref } from '../users';
import { SongForm, emptySong } from '../components/SongForm';
import { Artwork, Icon, toast } from '../components/ui';

export function AddScreen() {
  useStore(); // 登録済み表示を最新に保つ
  const [tab, setTab] = useState<'search' | 'manual'>('search');
  const [q, setQ] = useState('');
  const [results, setResults] = useState<ItunesTrack[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Song | null>(null);
  const [keepAdding, setKeepAddingState] = useState(() => pref('keepAdding', false));
  const [formKey, setFormKey] = useState(0);

  const setKeepAdding = (v: boolean) => {
    setKeepAddingState(v);
    setPref('keepAdding', v);
  };

  const search = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    try {
      setResults(await searchItunes(q.trim()));
    } catch {
      setError(navigator.onLine ? '検索できなかった。少し待ってもう一度試してね' : 'オフラインなので検索できないよ。手入力なら登録できる');
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  const pick = (t: ItunesTrack) =>
    setDraft(
      emptySong({
        title: t.trackName,
        artist: t.artistName,
        artworkUrl: artwork(t.artworkUrl100),
        itunesTrackId: t.trackId,
      }),
    );

  const save = async (s: Song) => {
    await putSong(s);
    if (keepAdding) {
      toast(`「${s.title}」を登録したよ`);
      setDraft(null);
      setFormKey((k) => k + 1);
    } else {
      toast('登録したよ');
      go(`/song/${s.id}`);
    }
  };

  if (draft) {
    return (
      <div className="screen">
        <header className="screen-head">
          <button className="icon-btn" onClick={() => setDraft(null)} aria-label="戻る">
            <Icon name="back" />
          </button>
          <h1>持ち歌に追加</h1>
        </header>
        <SongForm key={draft.id} initial={draft} submitLabel="登録する" onSubmit={save} onCancel={() => setDraft(null)} />
      </div>
    );
  }

  return (
    <div className="screen">
      <header className="screen-head">
        <h1>曲を追加</h1>
        <label className="switch">
          <input type="checkbox" checked={keepAdding} onChange={(e) => setKeepAdding(e.target.checked)} />
          <span>続けて登録</span>
        </label>
      </header>
      <div className="seg tabs">
        <button className={tab === 'search' ? 'on' : ''} onClick={() => setTab('search')}>
          検索して追加
        </button>
        <button className={tab === 'manual' ? 'on' : ''} onClick={() => setTab('manual')}>
          手入力
        </button>
      </div>

      {tab === 'search' ? (
        <>
          <form className="searchbar" onSubmit={search}>
            <Icon name="search" size={18} />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="曲名・アーティスト名"
              enterKeyHint="search"
              aria-label="曲を検索"
              autoFocus
            />
            <button type="submit" className="btn small primary" disabled={!q.trim() || loading}>
              {loading ? '…' : '検索'}
            </button>
          </form>
          {error && <p className="warn">{error}</p>}
          {results && results.length === 0 && (
            <div className="empty">
              <p>見つからなかった</p>
              <button className="btn" onClick={() => setTab('manual')}>
                手入力で登録する
              </button>
            </div>
          )}
          {results && results.length > 0 && (
            <ul className="song-list">
              {results.map((t) => {
                const dup = findDuplicate(t.trackName, t.artistName, t.trackId);
                return (
                  <li key={t.trackId}>
                    <button className="song-row" onClick={() => (dup ? go(`/song/${dup.id}`) : pick(t))}>
                      <Artwork url={t.artworkUrl100} size={44} />
                      <div className="song-main">
                        <div className="song-title">{t.trackName}</div>
                        <div className="song-sub muted">
                          {t.artistName}
                          {t.releaseDate && ` · ${t.releaseDate.slice(0, 4)}`}
                        </div>
                      </div>
                      <div className="song-side">{dup ? <span className="badge">登録済み</span> : <Icon name="plus" size={20} />}</div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {!results && !error && (
            <p className="hint">iTunesの曲データから探せるよ。カラオケ限定曲や見つからない曲は「手入力」で。</p>
          )}
        </>
      ) : (
        <SongForm key={`manual-${formKey}`} initial={emptySong({ title: '', artist: '' })} submitLabel="登録する" onSubmit={save} />
      )}
    </div>
  );
}
