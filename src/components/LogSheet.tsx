import { useEffect, useMemo, useRef, useState } from 'react';
import type { Machine, ScoreLog, Song } from '../types';
import { MACHINES } from '../types';
import { getState, putLog } from '../store';
import { newId, setUserPref, userPref } from '../users';
import { KeyStepper, Segmented, Sheet, today, toast } from './ui';

/** 「歌った！」の記録シート。最小入力：点数 → 保存 */
export function LogSheet({ song, open, onClose }: { song: Song | null; open: boolean; onClose: () => void }) {
  const [machine, setMachine] = useState<Machine>('DAM');
  const [mode, setMode] = useState('');
  const [score, setScore] = useState('');
  const [key, setKey] = useState(0);
  const [date, setDate] = useState(today());
  const [memo, setMemo] = useState('');
  const [more, setMore] = useState(false);
  const scoreRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || !song) return;
    const last = userPref<{ machine: Machine; modes: Partial<Record<Machine, string>> } | null>('lastLogDefaults', null);
    const m: Machine =
      song.preferredMachine === 'DAM' || song.preferredMachine === 'JOYSOUND' ? song.preferredMachine : last?.machine ?? 'DAM';
    setMachine(m);
    setMode(last?.modes?.[m] ?? '');
    setScore('');
    setKey(song.key);
    setDate(today());
    setMemo('');
    setMore(false);
    window.setTimeout(() => scoreRef.current?.focus(), 150);
  }, [open, song]);

  const modeSuggestions = useMemo(() => {
    const set = new Set<string>();
    for (const l of getState().logs) if (l.machine === machine && l.scoringMode) set.add(l.scoringMode);
    if (machine === 'DAM') ['精密採点Ai', '精密採点DX-G', '精密採点Ai Heart'].forEach((s) => set.add(s));
    if (machine === 'JOYSOUND') ['分析採点AI+', '分析採点マスター'].forEach((s) => set.add(s));
    return [...set];
  }, [machine, open]);

  if (!song) return null;

  const save = async () => {
    const n = score.trim() === '' ? null : Number(score);
    if (n != null && (!Number.isFinite(n) || n < 0 || n > 100)) {
      toast('点数は0〜100で入れてね');
      return;
    }
    const log: ScoreLog = {
      id: newId(),
      songId: song.id,
      date,
      machine,
      scoringMode: mode.trim() || undefined,
      score: n,
      keyUsed: key,
      memo: memo.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    await putLog(log);
    const last = userPref<{ machine: Machine; modes: Partial<Record<Machine, string>> }>('lastLogDefaults', {
      machine,
      modes: {},
    });
    setUserPref('lastLogDefaults', { machine, modes: { ...last.modes, [machine]: log.scoringMode ?? '' } });
    toast(n != null ? `${n}点で記録したよ` : '歌った記録をつけたよ');
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={`歌った！ ${song.title}`}>
      <label className="field">
        <span>点数（空欄でもOK）</span>
        <input
          ref={scoreRef}
          className="score-input"
          type="number"
          inputMode="decimal"
          step="0.001"
          min={0}
          max={100}
          placeholder="例 88.512"
          value={score}
          onChange={(e) => setScore(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />
      </label>
      <div className="field">
        <span>機種</span>
        <Segmented options={MACHINES} value={machine} onChange={(v) => v && setMachine(v)} />
      </div>
      {!more ? (
        <button type="button" className="link-btn" onClick={() => setMore(true)}>
          採点モード・キー・日付・メモ（{mode || '未設定'} / キー{key === 0 ? '原曲' : key > 0 ? `+${key}` : key}）
        </button>
      ) : (
        <>
          <label className="field">
            <span>採点モード</span>
            <input list="mode-suggest" value={mode} onChange={(e) => setMode(e.target.value)} placeholder="例 精密採点Ai" />
            <datalist id="mode-suggest">
              {modeSuggestions.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </label>
          <div className="field">
            <span>この時のキー</span>
            <KeyStepper value={key} onChange={setKey} />
          </div>
          <label className="field">
            <span>日付</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value || today())} />
          </label>
          <label className="field">
            <span>メモ</span>
            <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="サビで息切れ、など" />
          </label>
        </>
      )}
      <button className="btn primary block" onClick={save}>
        保存
      </button>
    </Sheet>
  );
}
