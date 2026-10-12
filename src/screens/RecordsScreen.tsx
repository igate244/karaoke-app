import { useState } from 'react';
import { RATING_LABELS } from '../types';
import { EMPTY_STATS, getStatsMap, useStore } from '../store';
import { fmtDate, fmtScore } from '../components/ui';

export function RecordsScreen() {
  const { songs, logs } = useStore();
  const stats = getStatsMap();
  const [limit, setLimit] = useState(40);
  const byId = new Map(songs.map((s) => [s.id, s]));

  const ratingCounts = [5, 4, 3, 2, 1].map((r) => ({ r, n: songs.filter((s) => s.rating === r).length }));
  const maxCount = Math.max(1, ...ratingCounts.map((x) => x.n));

  const withStats = songs.map((s) => ({ s, st: stats.get(s.id) ?? EMPTY_STATS }));
  const mostSung = withStats.filter((x) => x.st.count > 0).sort((a, b) => b.st.count - a.st.count).slice(0, 10);
  const topScores = withStats.filter((x) => x.st.best != null).sort((a, b) => (b.st.best ?? 0) - (a.st.best ?? 0)).slice(0, 10);

  const recentLogs = [...logs]
    .sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)))
    .slice(0, limit);
  const days: { date: string; items: typeof recentLogs }[] = [];
  for (const l of recentLogs) {
    const last = days[days.length - 1];
    if (last && last.date === l.date) last.items.push(l);
    else days.push({ date: l.date, items: [l] });
  }
  const outings = new Set(logs.map((l) => l.date)).size;

  return (
    <div className="screen">
      <header className="screen-head">
        <h1>記録</h1>
      </header>

      <div className="tiles">
        <div className="tile">
          <b>{songs.length}</b>
          <span>持ち歌</span>
        </div>
        <div className="tile">
          <b>{logs.length}</b>
          <span>歌った回数</span>
        </div>
        <div className="tile">
          <b>{outings}</b>
          <span>カラオケ日数</span>
        </div>
      </div>

      <h2 className="section-title">歌える度の内訳</h2>
      <div className="bars">
        {ratingCounts.map(({ r, n }) => (
          <div key={r} className="bar-row">
            <span className="bar-label">
              <span className="star-mini">★{r}</span> {RATING_LABELS[r]}
            </span>
            <span className="bar-track">
              <span className="bar-fill" style={{ width: `${(n / maxCount) * 100}%` }} />
            </span>
            <span className="bar-n">{n}</span>
          </div>
        ))}
      </div>

      {mostSung.length > 0 && (
        <>
          <h2 className="section-title">よく歌う曲</h2>
          <ol className="rank">
            {mostSung.map(({ s, st }) => (
              <li key={s.id}>
                <a href={`#/song/${s.id}`}>
                  <span className="rank-title">{s.title}</span>
                  <span className="muted">{s.artist}</span>
                </a>
                <b>{st.count}回</b>
              </li>
            ))}
          </ol>
        </>
      )}

      {topScores.length > 0 && (
        <>
          <h2 className="section-title">最高点ランキング</h2>
          <ol className="rank">
            {topScores.map(({ s, st }) => (
              <li key={s.id}>
                <a href={`#/song/${s.id}`}>
                  <span className="rank-title">{s.title}</span>
                  <span className="muted">{s.artist}</span>
                </a>
                <b>{fmtScore(st.best)}</b>
              </li>
            ))}
          </ol>
        </>
      )}

      <h2 className="section-title">最近の歌唱ログ</h2>
      {days.length === 0 ? (
        <p className="hint">曲の画面の「歌った！」から記録できるよ</p>
      ) : (
        <>
          {days.map((d) => (
            <section key={d.date} className="day">
              <h3 className="group-head">{fmtDate(d.date)}</h3>
              <ul className="log-list">
                {d.items.map((l) => {
                  const s = byId.get(l.songId);
                  return (
                    <li key={l.id}>
                      <span className={`log-machine m-${l.machine === 'JOYSOUND' ? 'joy' : l.machine === 'DAM' ? 'dam' : 'other'}`}>
                        {l.machine === 'JOYSOUND' ? 'JOY' : l.machine}
                      </span>
                      <a className="log-main" href={s ? `#/song/${s.id}` : undefined}>
                        <span>{s?.title ?? '（削除された曲）'}</span>
                        <small>{s?.artist}</small>
                      </a>
                      <b className="log-score">{l.score != null ? fmtScore(l.score) : '—'}</b>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {logs.length > limit && (
            <button className="btn block" onClick={() => setLimit(limit + 60)}>
              もっと見る
            </button>
          )}
        </>
      )}
    </div>
  );
}
