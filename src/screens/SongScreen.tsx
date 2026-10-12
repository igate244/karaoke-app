import { useState } from 'react';
import { RATING_LABELS } from '../types';
import { EMPTY_STATS, deleteLog, deleteSong, getStatsMap, putSong, useStore } from '../store';
import { back, go } from '../router';
import { SongForm } from '../components/SongForm';
import { LogSheet } from '../components/LogSheet';
import { ScoreChart } from '../components/ScoreChart';
import { Artwork, Icon, Stars, fmtDate, fmtScore, formatKey, toast } from '../components/ui';

export function SongScreen({ id, edit }: { id: string; edit: boolean }) {
  const { songs, logs } = useStore();
  const song = songs.find((s) => s.id === id);
  const [logOpen, setLogOpen] = useState(false);

  if (!song) {
    return (
      <div className="screen">
        <div className="empty">
          <p>この曲は見つからないよ</p>
          <button className="btn" onClick={() => go('/')}>
            一覧へ
          </button>
        </div>
      </div>
    );
  }

  if (edit) {
    return (
      <div className="screen">
        <header className="screen-head">
          <button className="icon-btn" onClick={() => back(`/song/${id}`)} aria-label="戻る">
            <Icon name="back" />
          </button>
          <h1>編集</h1>
        </header>
        <SongForm
          initial={song}
          submitLabel="保存"
          onSubmit={async (s) => {
            await putSong(s);
            toast('保存したよ');
            back(`/song/${id}`);
          }}
          onCancel={() => back(`/song/${id}`)}
        />
        <button
          className="btn danger block"
          onClick={async () => {
            if (!confirm(`「${song.title}」と歌唱ログを削除する？`)) return;
            await deleteSong(song.id);
            toast('削除したよ');
            go('/');
          }}
        >
          <Icon name="trash" size={16} /> この曲を削除
        </button>
      </div>
    );
  }

  const st = getStatsMap().get(song.id) ?? EMPTY_STATS;
  const songLogs = logs
    .filter((l) => l.songId === song.id)
    .sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)));
  const searchQ = encodeURIComponent(`${song.title} ${song.artist}`);

  return (
    <div className="screen">
      <header className="screen-head">
        <button className="icon-btn" onClick={() => back('/')} aria-label="戻る">
          <Icon name="back" />
        </button>
        <span className="spacer" />
        <button
          className={`icon-btn ${song.favorite ? 'fav-on' : ''}`}
          onClick={() => putSong({ ...song, favorite: !song.favorite })}
          aria-label={song.favorite ? 'お気に入り解除' : 'お気に入り'}
        >
          <Icon name="heart" fill={song.favorite} />
        </button>
        <button className="icon-btn" onClick={() => go(`/song/${song.id}/edit`)} aria-label="編集">
          <Icon name="edit" />
        </button>
      </header>

      <div className="detail-hero">
        <Artwork url={song.artworkUrl} size={88} />
        <div>
          <h1 className="detail-title">{song.title}</h1>
          <button className="artist-link big" onClick={() => {
            try {
              sessionStorage.setItem('karaoke:filters', JSON.stringify({ q: '', minRating: 0, artist: song.artist, tags: [], mood: null, machine: null, favorite: false }));
            } catch { /* noop */ }
            go('/');
          }}>
            {song.artist}
          </button>
        </div>
      </div>

      <div className="detail-rating">
        <Stars value={song.rating} onChange={(v) => putSong({ ...song, rating: v })} size="lg" />
        <span>{RATING_LABELS[song.rating]}</span>
      </div>

      <dl className="facts">
        <div>
          <dt>キー</dt>
          <dd className={song.key ? 'accent' : ''}>{formatKey(song.key)}</dd>
        </div>
        <div>
          <dt>最高点</dt>
          <dd>{fmtScore(st.best)}</dd>
        </div>
        <div>
          <dt>歌った回数</dt>
          <dd>{st.count}</dd>
        </div>
        <div>
          <dt>最後に歌った</dt>
          <dd>{st.lastDate ? fmtDate(st.lastDate) : '—'}</dd>
        </div>
      </dl>

      <div className="chips">
        {song.preferredMachine !== 'どちらでも' && <span className="chip static">{song.preferredMachine}</span>}
        {song.mood && <span className="chip static">{song.mood}</span>}
        {song.tags.map((t) => (
          <span key={t} className="chip static">
            #{t}
          </span>
        ))}
      </div>
      {song.memo && <p className="memo">{song.memo}</p>}

      <button className="btn primary block big-cta" onClick={() => setLogOpen(true)}>
        <Icon name="mic" size={20} /> 歌った！
      </button>

      <div className="links">
        <a className="btn" href={`https://www.youtube.com/results?search_query=${searchQ}`} target="_blank" rel="noreferrer">
          <Icon name="play" size={16} /> YouTube
        </a>
        <a className="btn" href={`https://www.google.com/search?q=${searchQ}+歌詞`} target="_blank" rel="noreferrer">
          <Icon name="text" size={16} /> 歌詞
        </a>
      </div>

      <h2 className="section-title">得点の推移</h2>
      {songLogs.filter((l) => l.score != null).length >= 2 ? (
        <ScoreChart logs={songLogs} />
      ) : (
        <p className="hint">点数つきで2回以上記録するとグラフが出るよ</p>
      )}

      <h2 className="section-title">歌唱ログ</h2>
      {songLogs.length === 0 ? (
        <p className="hint">まだ記録がないよ</p>
      ) : (
        <ul className="log-list">
          {songLogs.map((l) => (
            <li key={l.id}>
              <span className="log-date">{fmtDate(l.date)}</span>
              <span className={`log-machine m-${l.machine === 'JOYSOUND' ? 'joy' : l.machine === 'DAM' ? 'dam' : 'other'}`}>
                {l.machine === 'JOYSOUND' ? 'JOY' : l.machine}
              </span>
              <span className="log-main">
                <b>{l.score != null ? fmtScore(l.score) : '採点なし'}</b>
                <small>
                  {[l.scoringMode, l.keyUsed !== song.key ? `キー${formatKey(l.keyUsed)}` : '', l.memo]
                    .filter(Boolean)
                    .join(' · ')}
                </small>
              </span>
              <button
                className="icon-btn"
                aria-label="この記録を削除"
                onClick={async () => {
                  if (!confirm('この記録を削除する？')) return;
                  await deleteLog(l.id);
                }}
              >
                <Icon name="x" size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <LogSheet song={song} open={logOpen} onClose={() => setLogOpen(false)} />
    </div>
  );
}
