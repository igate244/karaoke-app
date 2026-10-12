import { useMemo, useRef, useState } from 'react';
import type { Machine, Mood, Song } from '../types';
import { MOODS, RATING_LABELS } from '../types';
import { EMPTY_STATS, allTags, getStatsMap, useStore } from '../store';
import { applyFilters, type Filters } from './ListScreen';
import { go } from '../router';
import { userPref, setUserPref } from '../users';
import { LogSheet } from '../components/LogSheet';
import { Artwork, Icon, Segmented, Stars, fmtScore, formatKey } from '../components/ui';

type Cond = Pick<Filters, 'minRating' | 'tags' | 'mood' | 'machine'>;

export function RandomScreen() {
  const { songs } = useStore();
  const [cond, setCondState] = useState<Cond>(() =>
    userPref<Cond>('randomCond', { minRating: 3, tags: [], mood: null, machine: null }),
  );
  const [current, setCurrent] = useState<Song | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const recent = useRef<string[]>([]);

  const setCond = (patch: Partial<Cond>) => {
    const next = { ...cond, ...patch };
    setCondState(next);
    setUserPref('randomCond', next);
  };

  const pool = useMemo(
    () => applyFilters(songs, { q: '', artist: null, favorite: false, ...cond }),
    [songs, cond],
  );

  const draw = () => {
    if (!pool.length) {
      setCurrent(null);
      return;
    }
    // 直近に出た曲はなるべく避ける
    const avoid = new Set(recent.current.slice(-Math.min(5, pool.length - 1)));
    const cands = pool.filter((s) => !avoid.has(s.id));
    const pick = cands[Math.floor(Math.random() * cands.length)];
    recent.current.push(pick.id);
    setCurrent(pick);
  };

  const tags = allTags();
  const st = current ? getStatsMap().get(current.id) ?? EMPTY_STATS : EMPTY_STATS;

  return (
    <div className="screen">
      <header className="screen-head">
        <h1>おまかせ選曲</h1>
      </header>

      <div className={`random-card ${current ? 'filled' : ''}`}>
        {current ? (
          <>
            <Artwork url={current.artworkUrl} size={96} />
            <h2>{current.title}</h2>
            <p className="muted">{current.artist}</p>
            <div className="random-meta">
              <Stars value={current.rating} size="md" />
              <span>{RATING_LABELS[current.rating]}</span>
            </div>
            <div className="random-meta">
              <span className={`key ${current.key ? 'changed' : ''}`}>キー {formatKey(current.key)}</span>
              {st.best != null && <span className="best">最高 {fmtScore(st.best)}</span>}
            </div>
          </>
        ) : (
          <p className="muted">{pool.length ? `${pool.length}曲の中から選ぶよ` : '条件に合う曲がないよ'}</p>
        )}
      </div>

      <div className="random-actions">
        <button className="btn primary big-cta" onClick={draw} disabled={!pool.length}>
          <Icon name="dice" size={20} /> {current ? 'もう1曲' : '選んで！'}
        </button>
        {current && (
          <div className="grid2">
            <button className="btn" onClick={() => setLogOpen(true)}>
              <Icon name="mic" size={16} /> 歌った！
            </button>
            <button className="btn" onClick={() => go(`/song/${current.id}`)}>
              詳細
            </button>
          </div>
        )}
      </div>

      <h2 className="section-title">条件</h2>
      <div className="field">
        <span>歌える度</span>
        <div className="seg">
          {[0, 2, 3, 4, 5].map((n) => (
            <button key={n} className={cond.minRating === n ? 'on' : ''} onClick={() => setCond({ minRating: n })}>
              {n === 0 ? 'すべて' : `★${n}${n < 5 ? '以上' : ''}`}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <span>曲調</span>
        <Segmented<Mood> options={MOODS} value={cond.mood} onChange={(v) => setCond({ mood: v })} allowNone />
      </div>
      <div className="field">
        <span>機種</span>
        <Segmented<Machine> options={['DAM', 'JOYSOUND']} value={cond.machine} onChange={(v) => setCond({ machine: v })} allowNone />
      </div>
      {tags.length > 0 && (
        <div className="field">
          <span>タグ</span>
          <div className="chips">
            {tags.map((t) => (
              <button
                key={t}
                className={`chip ${cond.tags.includes(t) ? 'on' : ''}`}
                onClick={() => setCond({ tags: cond.tags.includes(t) ? cond.tags.filter((x) => x !== t) : [...cond.tags, t] })}
              >
                #{t}
              </button>
            ))}
          </div>
        </div>
      )}

      <LogSheet song={current} open={logOpen} onClose={() => setLogOpen(false)} />
    </div>
  );
}
