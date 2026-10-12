import { useState } from 'react';
import type { PreferredMachine, Song } from '../types';
import { PREFERRED_MACHINES, RATING_LABELS } from '../types';
import { allTags, findDuplicate } from '../store';
import { newId } from '../users';
import { Artwork, KeyStepper, Segmented, Stars, TagInput } from './ui';

export type SongDraft = Partial<Song> & { title: string; artist: string };

export function emptySong(draft: SongDraft): Song {
  const now = new Date().toISOString();
  return {
    id: newId(),
    rating: 0,
    key: 0,
    preferredMachine: 'どちらでも',
    mood: null,
    tags: [],
    favorite: false,
    memo: '',
    createdAt: now,
    updatedAt: now,
    ...draft,
  };
}

export function SongForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: Song;
  submitLabel: string;
  onSubmit: (s: Song) => void | Promise<void>;
  onCancel?: () => void;
}) {
  const [s, setS] = useState<Song>(initial);
  const [showKana, setShowKana] = useState(Boolean(initial.titleKana || initial.artistKana));
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Song>(k: K, v: Song[K]) => setS((p) => ({ ...p, [k]: v }));

  const dup = s.title.trim() && s.artist.trim() ? findDuplicate(s.title, s.artist, s.itunesTrackId, s.id) : undefined;
  const valid = s.title.trim() && s.artist.trim() && s.rating > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    try {
      await onSubmit({
        ...s,
        title: s.title.trim(),
        artist: s.artist.trim(),
        titleKana: s.titleKana?.trim() || undefined,
        artistKana: s.artistKana?.trim() || undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form" onSubmit={submit}>
      {s.artworkUrl && (
        <div className="form-art">
          <Artwork url={s.artworkUrl} size={72} />
        </div>
      )}
      <label className="field">
        <span>曲名</span>
        <input value={s.title} onChange={(e) => set('title', e.target.value)} required />
      </label>
      <label className="field">
        <span>アーティスト</span>
        <input value={s.artist} onChange={(e) => set('artist', e.target.value)} required />
      </label>
      {!showKana ? (
        <button type="button" className="link-btn" onClick={() => setShowKana(true)}>
          ＋ 読みを入れる（英語・漢字の曲を、かなで検索したいとき）
        </button>
      ) : (
        <div className="grid2">
          <label className="field">
            <span>曲名の読み</span>
            <input value={s.titleKana ?? ''} onChange={(e) => set('titleKana', e.target.value)} placeholder="ひらがなでOK" />
          </label>
          <label className="field">
            <span>アーティストの読み</span>
            <input value={s.artistKana ?? ''} onChange={(e) => set('artistKana', e.target.value)} placeholder="ひらがなでOK" />
          </label>
        </div>
      )}
      {dup && <p className="warn">「{dup.title} / {dup.artist}」はもう登録済みだよ</p>}

      <div className="field">
        <span>
          歌える度 <b className="req">必須</b>
        </span>
        <div className="rating-pick">
          <Stars value={s.rating} onChange={(v) => set('rating', v)} size="lg" />
          <em>{s.rating ? RATING_LABELS[s.rating] : 'タップして選ぶ'}</em>
        </div>
      </div>

      <div className="field">
        <span>キー</span>
        <KeyStepper value={s.key} onChange={(v) => set('key', v)} />
      </div>

      <div className="field">
        <span>よく使う機種</span>
        <Segmented<PreferredMachine> options={PREFERRED_MACHINES} value={s.preferredMachine} onChange={(v) => v && set('preferredMachine', v)} />
      </div>

      <div className="field">
        <span>タグ</span>
        <TagInput value={s.tags} onChange={(v) => set('tags', v)} suggestions={allTags()} />
      </div>

      <label className="field check">
        <input type="checkbox" checked={s.favorite} onChange={(e) => set('favorite', e.target.checked)} />
        <span>お気に入り</span>
      </label>

      <label className="field">
        <span>メモ</span>
        <textarea rows={3} value={s.memo} onChange={(e) => set('memo', e.target.value)} placeholder="Aメロ低め注意、など" />
      </label>

      <div className="form-actions">
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel}>
            キャンセル
          </button>
        )}
        <button type="submit" className="btn primary" disabled={!valid || busy}>
          {s.rating ? submitLabel : '歌える度を選んでね'}
        </button>
      </div>
    </form>
  );
}
