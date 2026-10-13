import { useMemo, useState } from 'react';
import type { Machine, Song } from '../types';
import { EMPTY_STATS, allTags, getHaystack, getStatsMap, memoHit, useStore } from '../store';
import { matchesQuery, normalize } from '../normalize';
import { go } from '../router';
import { pref, setPref } from '../users';
import { Artwork, Icon, Segmented, Sheet, Stars, fmtDate, fmtScore, formatKey } from '../components/ui';

type SortKey = 'rating' | 'artist' | 'title' | 'best' | 'lastSung' | 'created';
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'rating', label: '歌える度' },
  { key: 'artist', label: 'アーティスト' },
  { key: 'title', label: '曲名' },
  { key: 'best', label: '最高点' },
  { key: 'lastSung', label: '最近歌った' },
  { key: 'created', label: '登録が新しい' },
];

export interface Filters {
  q: string;
  minRating: number;
  artist: string | null;
  tags: string[];
  machine: Machine | null;
  favorite: boolean;
}

const EMPTY_FILTERS: Filters = { q: '', minRating: 0, artist: null, tags: [], machine: null, favorite: false };

function loadFilters(): Filters {
  try {
    const raw = sessionStorage.getItem('karaoke:filters');
    return raw ? { ...EMPTY_FILTERS, ...JSON.parse(raw) } : EMPTY_FILTERS;
  } catch {
    return EMPTY_FILTERS;
  }
}

export function applyFilters(songs: Song[], f: Filters): Song[] {
  const na = f.artist ? normalize(f.artist) : null;
  return songs.filter(
    (s) =>
      s.rating >= f.minRating &&
      (!na || normalize(s.artist) === na) &&
      f.tags.every((t) => s.tags.includes(t)) &&
      (!f.machine || s.preferredMachine === f.machine || s.preferredMachine === 'どちらでも') &&
      (!f.favorite || s.favorite) &&
      (!f.q.trim() || matchesQuery(getHaystack(s), f.q)),
  );
}

export function ListScreen() {
  const { songs } = useStore();
  const stats = getStatsMap();
  const [f, setF] = useState<Filters>(loadFilters);
  const [sort, setSortState] = useState<SortKey>(() => pref<SortKey>('sort', 'rating'));
  const [showScore, setShowScoreState] = useState(() => pref('showScore', true));
  const [filterOpen, setFilterOpen] = useState(false);
  const [view, setViewState] = useState<'songs' | 'artists'>(() => pref<'songs' | 'artists'>('listView', 'songs'));
  const setView = (v: 'songs' | 'artists') => {
    setViewState(v);
    setPref('listView', v);
    window.scrollTo(0, 0);
  };

  const update = (patch: Partial<Filters>) => {
    const next = { ...f, ...patch };
    setF(next);
    try {
      sessionStorage.setItem('karaoke:filters', JSON.stringify(next));
    } catch {
      /* noop */
    }
  };
  const setSort = (s: SortKey) => {
    setSortState(s);
    setPref('sort', s);
  };
  const toggleScore = () => {
    setShowScoreState(!showScore);
    setPref('showScore', !showScore);
  };

  const list = useMemo(() => {
    const out = applyFilters(songs, f);
    const st = (s: Song) => stats.get(s.id) ?? EMPTY_STATS;
    const byTitle = (a: Song, b: Song) => (a.titleKana || a.title).localeCompare(b.titleKana || b.title, 'ja');
    const byArtist = (a: Song, b: Song) =>
      (a.artistKana || a.artist).localeCompare(b.artistKana || b.artist, 'ja') || byTitle(a, b);
    const cmp: Record<SortKey, (a: Song, b: Song) => number> = {
      rating: (a, b) => b.rating - a.rating || (st(b).best ?? -1) - (st(a).best ?? -1) || byTitle(a, b),
      artist: byArtist,
      title: byTitle,
      best: (a, b) => (st(b).best ?? -1) - (st(a).best ?? -1) || b.rating - a.rating,
      lastSung: (a, b) => (st(b).lastDate ?? '').localeCompare(st(a).lastDate ?? '') || b.rating - a.rating,
      created: (a, b) => b.createdAt.localeCompare(a.createdAt),
    };
    return out.sort(cmp[sort]);
  }, [songs, f, sort, stats]);

  const activeChips: { label: string; clear: () => void }[] = [];
  if (f.minRating) activeChips.push({ label: `★${f.minRating}以上`, clear: () => update({ minRating: 0 }) });
  if (f.artist) activeChips.push({ label: f.artist, clear: () => update({ artist: null }) });
  if (f.machine) activeChips.push({ label: f.machine, clear: () => update({ machine: null }) });
  if (f.favorite) activeChips.push({ label: 'お気に入り', clear: () => update({ favorite: false }) });

  // アーティスト順のときは見出しでまとめる
  const groups: { head: string | null; items: Song[] }[] = [];
  if (sort === 'artist') {
    for (const s of list) {
      const last = groups[groups.length - 1];
      if (last && normalize(last.head) === normalize(s.artist)) last.items.push(s);
      else groups.push({ head: s.artist, items: [s] });
    }
  } else groups.push({ head: null, items: list });

  const artists = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of songs) if (!m.has(normalize(s.artist))) m.set(normalize(s.artist), s.artist);
    return [...m.values()].sort((a, b) => a.localeCompare(b, 'ja'));
  }, [songs]);
  const tags = allTags();

  return (
    <div className="screen">
      <div className="list-top">
        <div className="seg view-toggle" role="tablist" aria-label="表示">
          <button role="tab" aria-selected={view === 'songs'} className={view === 'songs' ? 'on' : ''} onClick={() => setView('songs')}>
            曲
          </button>
          <button role="tab" aria-selected={view === 'artists'} className={view === 'artists' ? 'on' : ''} onClick={() => setView('artists')}>
            アーティスト
          </button>
        </div>
        <div className="searchbar">
          <Icon name="search" size={18} />
          <input
            type="search"
            value={f.q}
            onChange={(e) => update({ q: e.target.value })}
            placeholder="曲名・アーティスト・メモで検索"
            enterKeyHint="search"
            aria-label="検索"
          />
          {f.q && (
            <button className="icon-btn" onClick={() => update({ q: '' })} aria-label="検索をクリア">
              <Icon name="x" size={18} />
            </button>
          )}
        </div>
        <div className="toolbar">
          <button className={`chip ${activeChips.length ? 'on' : ''}`} onClick={() => setFilterOpen(true)}>
            <Icon name="filter" size={14} /> 絞り込み{activeChips.length ? ` ${activeChips.length}` : ''}
          </button>
          {view === 'songs' && (
          <label className="sort-select">
            <Icon name="sort" size={14} />
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="並び順">
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          )}
          <span className="count">{list.length}曲</span>
          <button className="icon-btn" onClick={toggleScore} aria-label={showScore ? '点数を隠す' : '点数を表示'}>
            <Icon name={showScore ? 'eye' : 'eyeOff'} size={18} />
          </button>
        </div>
        {tags.length > 0 && (
          <div className="tag-bar" role="group" aria-label="タグで絞り込み">
            {tags.map((t) => {
              const on = f.tags.includes(t);
              return (
                <button
                  key={t}
                  className={`chip ${on ? 'on' : ''}`}
                  aria-pressed={on}
                  onClick={() => update({ tags: on ? f.tags.filter((x) => x !== t) : [...f.tags, t] })}
                >
                  #{t}
                </button>
              );
            })}
          </div>
        )}
        {activeChips.length > 0 && (
          <div className="chips active-chips">
            {activeChips.map((c) => (
              <button key={c.label} className="chip on" onClick={c.clear}>
                {c.label} ×
              </button>
            ))}
            <button className="chip ghost" onClick={() => update({ ...EMPTY_FILTERS, q: f.q, tags: f.tags })}>
              全部はずす
            </button>
          </div>
        )}
      </div>

      {songs.length === 0 ? (
        <div className="empty">
          <Icon name="mic" size={40} />
          <p>まだ持ち歌がないよ</p>
          <button className="btn primary" onClick={() => go('/add')}>
            最初の1曲を登録
          </button>
        </div>
      ) : list.length === 0 ? (
        <div className="empty">
          <p>条件に合う曲がないよ</p>
        </div>
      ) : view === 'artists' ? (
        <ArtistView songs={list} f={f} showScore={showScore} />
      ) : (
        groups.map((g, gi) => (
          <section key={gi}>
            {g.head && <h3 className="group-head">{g.head}</h3>}
            <ul className="song-list">
              {g.items.map((s) => (
                  <SongRow key={s.id} s={s} f={f} showArtist={!g.head} showScore={showScore} onArtist={(name) => update({ artist: name })} />
              ))}
            </ul>
          </section>
        ))
      )}

      <Sheet open={filterOpen} onClose={() => setFilterOpen(false)} title="絞り込み">
        <div className="field">
          <span>歌える度</span>
          <div className="seg">
            {[0, 2, 3, 4, 5].map((n) => (
              <button key={n} className={f.minRating === n ? 'on' : ''} onClick={() => update({ minRating: n })}>
                {n === 0 ? 'すべて' : `★${n}${n < 5 ? '以上' : ''}`}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>機種</span>
          <Segmented<Machine> options={['DAM', 'JOYSOUND']} value={f.machine} onChange={(v) => update({ machine: v })} allowNone />
        </div>
        <label className="field check">
          <input type="checkbox" checked={f.favorite} onChange={(e) => update({ favorite: e.target.checked })} />
          <span>お気に入りだけ</span>
        </label>
        <label className="field">
          <span>アーティスト</span>
          <select value={f.artist ?? ''} onChange={(e) => update({ artist: e.target.value || null })}>
            <option value="">すべて</option>
            {artists.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <button className="btn primary block" onClick={() => setFilterOpen(false)}>
          {list.length}曲を見る
        </button>
      </Sheet>
    </div>
  );
}

function SongRow({
  s,
  f,
  showArtist,
  showScore,
  onArtist,
}: {
  s: Song;
  f: Filters;
  showArtist: boolean;
  showScore: boolean;
  onArtist?: (artist: string) => void;
}) {
  const st = getStatsMap().get(s.id) ?? EMPTY_STATS;
  const m = f.q.trim() ? memoHit(s, f.q) : null;
  return (
    <li>
      <a className="song-row" href={`#/song/${s.id}`}>
        <Artwork url={s.artworkUrl} size={44} />
        <div className="song-main">
          <div className="song-title">
            {s.favorite && <span className="fav" aria-label="お気に入り">♥</span>}
            {s.title}
          </div>
          <div className="song-sub">
            {showArtist && (
              <button
                className="artist-link"
                onClick={(e) => {
                  e.preventDefault();
                  onArtist?.(s.artist);
                }}
              >
                {s.artist}
              </button>
            )}
            {st.lastDate && <span className="muted">{showArtist ? ' · ' : ''}{fmtDate(st.lastDate)}</span>}
          </div>
          {m && (
            <div className="row-memo">
              <b>{m.label}</b> {m.text}
            </div>
          )}
          {s.tags.length > 0 && (
            <div className="row-tags">
              {s.tags.map((t) => (
                <span key={t} className={f.tags.includes(t) ? 'on' : ''}>
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="song-side">
          <Stars value={s.rating} size="sm" />
          <div className="song-meta">
            <span className={`key ${s.key ? 'changed' : ''}`}>{formatKey(s.key)}</span>
            {showScore && st.best != null && <span className="best">{fmtScore(st.best)}</span>}
          </div>
        </div>
      </a>
    </li>
  );
}

type ArtistSort = 'count' | 'name' | 'rating';
const ARTIST_SORTS: { key: ArtistSort; label: string }[] = [
  { key: 'count', label: '曲数が多い順' },
  { key: 'rating', label: '歌える度順' },
  { key: 'name', label: '名前順' },
];

interface ArtistGroup {
  key: string;
  name: string;
  kana: string;
  songs: Song[];
  maxRating: number;
}

function ArtistView({ songs, f, showScore }: { songs: Song[]; f: Filters; showScore: boolean }) {
  const [sort, setSortState] = useState<ArtistSort>(() => pref<ArtistSort>('artistSort', 'count'));
  const [open, setOpenState] = useState<string[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem('karaoke:openArtists') ?? '[]');
    } catch {
      return [];
    }
  });
  const setOpen = (v: string[]) => {
    setOpenState(v);
    try {
      sessionStorage.setItem('karaoke:openArtists', JSON.stringify(v));
    } catch {
      /* noop */
    }
  };
  const setSort = (v: ArtistSort) => {
    setSortState(v);
    setPref('artistSort', v);
  };

  const groups = useMemo(() => {
    const map = new Map<string, ArtistGroup>();
    for (const s of songs) {
      const key = normalize(s.artist);
      const g = map.get(key) ?? { key, name: s.artist, kana: s.artistKana || s.artist, songs: [], maxRating: 0 };
      g.songs.push(s);
      g.maxRating = Math.max(g.maxRating, s.rating);
      if (s.artistKana) g.kana = s.artistKana;
      map.set(key, g);
    }
    const byName = (a: ArtistGroup, b: ArtistGroup) => a.kana.localeCompare(b.kana, 'ja');
    const cmp: Record<ArtistSort, (a: ArtistGroup, b: ArtistGroup) => number> = {
      count: (a, b) => b.songs.length - a.songs.length || b.maxRating - a.maxRating || byName(a, b),
      rating: (a, b) => b.maxRating - a.maxRating || b.songs.length - a.songs.length || byName(a, b),
      name: byName,
    };
    const out = [...map.values()].sort(cmp[sort]);
    for (const g of out) g.songs.sort((a, b) => b.rating - a.rating || (a.titleKana || a.title).localeCompare(b.titleKana || b.title, 'ja'));
    return out;
  }, [songs, sort]);

  // 検索・絞り込み中は全部開いて見せる
  const filtering = Boolean(f.q.trim() || f.tags.length || f.minRating || f.machine || f.favorite);
  const isOpen = (k: string) => filtering || open.includes(k);

  return (
    <>
      <div className="artist-toolbar">
        <label className="sort-select">
          <Icon name="sort" size={14} />
          <select value={sort} onChange={(e) => setSort(e.target.value as ArtistSort)} aria-label="アーティストの並び順">
            {ARTIST_SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <span className="count">{groups.length}組</span>
        {!filtering && (
          <button className="chip ghost" onClick={() => setOpen(open.length ? [] : groups.map((g) => g.key))}>
            {open.length ? '全部閉じる' : '全部開く'}
          </button>
        )}
      </div>
      <ul className="artist-list">
        {groups.map((g) => {
          const o = isOpen(g.key);
          return (
            <li key={g.key} className={o ? 'open' : ''}>
              <button
                className="artist-row"
                aria-expanded={o}
                onClick={() => !filtering && setOpen(o ? open.filter((k) => k !== g.key) : [...open, g.key])}
              >
                <span className="artist-name">{g.name}</span>
                <span className="artist-count">{g.songs.length}曲</span>
                <Stars value={g.maxRating} size="sm" />
                {!filtering && <span className="chev" aria-hidden="true">{o ? '▾' : '▸'}</span>}
              </button>
              {o && (
                <ul className="song-list nested">
                  {g.songs.map((s) => (
                    <SongRow key={s.id} s={s} f={f} showArtist={false} showScore={showScore} />
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
