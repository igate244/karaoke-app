import { useMemo, useState } from 'react';
import type { Machine, Mood, Song } from '../types';
import { MOODS } from '../types';
import { EMPTY_STATS, allTags, getHaystack, getStatsMap, useStore } from '../store';
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
  mood: Mood | null;
  machine: Machine | null;
  favorite: boolean;
}

const EMPTY_FILTERS: Filters = { q: '', minRating: 0, artist: null, tags: [], mood: null, machine: null, favorite: false };

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
      (!f.mood || s.mood === f.mood) &&
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
  for (const t of f.tags) activeChips.push({ label: `#${t}`, clear: () => update({ tags: f.tags.filter((x) => x !== t) }) });
  if (f.mood) activeChips.push({ label: f.mood, clear: () => update({ mood: null }) });
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
        <div className="searchbar">
          <Icon name="search" size={18} />
          <input
            type="search"
            value={f.q}
            onChange={(e) => update({ q: e.target.value })}
            placeholder="曲名・アーティストで検索"
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
          <span className="count">{list.length}曲</span>
          <button className="icon-btn" onClick={toggleScore} aria-label={showScore ? '点数を隠す' : '点数を表示'}>
            <Icon name={showScore ? 'eye' : 'eyeOff'} size={18} />
          </button>
        </div>
        {activeChips.length > 0 && (
          <div className="chips active-chips">
            {activeChips.map((c) => (
              <button key={c.label} className="chip on" onClick={c.clear}>
                {c.label} ×
              </button>
            ))}
            <button className="chip ghost" onClick={() => update({ ...EMPTY_FILTERS, q: f.q })}>
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
      ) : (
        groups.map((g, gi) => (
          <section key={gi}>
            {g.head && <h3 className="group-head">{g.head}</h3>}
            <ul className="song-list">
              {g.items.map((s) => {
                const st = stats.get(s.id) ?? EMPTY_STATS;
                return (
                  <li key={s.id}>
                    <a className="song-row" href={`#/song/${s.id}`}>
                      <Artwork url={s.artworkUrl} size={44} />
                      <div className="song-main">
                        <div className="song-title">
                          {s.favorite && <span className="fav" aria-label="お気に入り">♥</span>}
                          {s.title}
                        </div>
                        <div className="song-sub">
                          {!g.head && (
                            <button
                              className="artist-link"
                              onClick={(e) => {
                                e.preventDefault();
                                update({ artist: s.artist });
                              }}
                            >
                              {s.artist}
                            </button>
                          )}
                          {st.lastDate && <span className="muted"> · {fmtDate(st.lastDate)}</span>}
                        </div>
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
              })}
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
          <span>曲調</span>
          <Segmented<Mood> options={MOODS} value={f.mood} onChange={(v) => update({ mood: v })} allowNone />
        </div>
        <div className="field">
          <span>機種</span>
          <Segmented<Machine> options={['DAM', 'JOYSOUND']} value={f.machine} onChange={(v) => update({ machine: v })} allowNone />
        </div>
        <label className="field check">
          <input type="checkbox" checked={f.favorite} onChange={(e) => update({ favorite: e.target.checked })} />
          <span>お気に入りだけ</span>
        </label>
        {tags.length > 0 && (
          <div className="field">
            <span>タグ（全部含む曲）</span>
            <div className="chips">
              {tags.map((t) => (
                <button
                  key={t}
                  className={`chip ${f.tags.includes(t) ? 'on' : ''}`}
                  onClick={() => update({ tags: f.tags.includes(t) ? f.tags.filter((x) => x !== t) : [...f.tags, t] })}
                >
                  #{t}
                </button>
              ))}
            </div>
          </div>
        )}
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
