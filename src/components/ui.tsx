import { useEffect, useRef, useState, type ReactNode } from 'react';
import { RATING_LABELS } from '../types';

// ---- アイコン（インラインSVG・外部依存なし） ----

const PATHS: Record<string, string> = {
  list: 'M4 6h16M4 12h16M4 18h10',
  plus: 'M12 5v14M5 12h14',
  dice: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM8.5 8.5h.01M15.5 15.5h.01M15.5 8.5h.01M8.5 15.5h.01M12 12h.01',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  filter: 'M3 5h18l-7 8.5V19l-4 2v-7.5z',
  back: 'M15 18l-6-6 6-6',
  x: 'M18 6 6 18M6 6l12 12',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM19 11a7 7 0 0 1-14 0M12 18v3',
  heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  eyeOff: 'M17.9 17.9A10.1 10.1 0 0 1 12 20C5 20 1 12 1 12a18.5 18.5 0 0 1 5.1-5.9M9.9 4.2A9.1 9.1 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.2 3.2M14.1 14.1a3 3 0 1 1-4.2-4.2M1 1l22 22',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
  play: 'M5 3l14 9-14 9z',
  text: 'M4 7V4h16v3M9 20h6M12 4v16',
  cloud: 'M18 10h-1.3A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z',
  sort: 'M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4',
};

export function Icon({ name, size = 22, fill = false }: { name: keyof typeof PATHS | string; size?: number; fill?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name] ?? ''} />
    </svg>
  );
}

// ---- 歌える度 ----

export function Stars({
  value,
  onChange,
  size = 'md',
  showLabel = false,
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}) {
  return (
    <span className={`stars stars-${size}`} role={onChange ? 'radiogroup' : 'img'} aria-label={`歌える度 ${value}`}>
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <button
            key={n}
            type="button"
            className={n <= value ? 'on' : ''}
            onClick={() => onChange(n)}
            aria-label={`${n} ${RATING_LABELS[n]}`}
            aria-checked={n === value}
            role="radio"
          >
            ★
          </button>
        ) : (
          <span key={n} className={n <= value ? 'on' : ''}>
            ★
          </span>
        ),
      )}
      {showLabel && value > 0 && <em className="stars-label">{RATING_LABELS[value]}</em>}
    </span>
  );
}

export function formatKey(k: number) {
  if (!k) return '原曲';
  return k > 0 ? `+${k}` : String(k);
}

export function KeyStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="stepper">
      <button type="button" onClick={() => onChange(Math.max(-12, value - 1))} aria-label="キーを下げる">
        −
      </button>
      <output className={value ? 'changed' : ''}>{formatKey(value)}</output>
      <button type="button" onClick={() => onChange(Math.min(12, value + 1))} aria-label="キーを上げる">
        ＋
      </button>
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  allowNone = false,
}: {
  options: readonly T[];
  value: T | null;
  onChange: (v: T | null) => void;
  allowNone?: boolean;
}) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          className={o === value ? 'on' : ''}
          onClick={() => onChange(allowNone && o === value ? null : o)}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

// ---- ボトムシート ----

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="閉じる">
            <Icon name="x" />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

// ---- トースト ----

let toastFn: ((msg: string) => void) | null = null;
export function toast(msg: string) {
  toastFn?.(msg);
}

export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null);
  const t = useRef<number | undefined>(undefined);
  useEffect(() => {
    toastFn = (m) => {
      setMsg(m);
      window.clearTimeout(t.current);
      t.current = window.setTimeout(() => setMsg(null), 2400);
    };
    return () => {
      toastFn = null;
    };
  }, []);
  return msg ? (
    <div className="toast" role="status">
      {msg}
    </div>
  ) : null;
}

// ---- タグ入力 ----

export function TagInput({ value, onChange, suggestions }: { value: string[]; onChange: (v: string[]) => void; suggestions: string[] }) {
  const [text, setText] = useState('');
  const add = (t: string) => {
    const v = t.trim();
    if (v && !value.includes(v)) onChange([...value, v]);
    setText('');
  };
  const rest = suggestions.filter((s) => !value.includes(s));
  return (
    <div className="tag-input">
      <div className="chips">
        {value.map((t) => (
          <button key={t} type="button" className="chip on" onClick={() => onChange(value.filter((x) => x !== t))}>
            {t} <span aria-hidden="true">×</span>
          </button>
        ))}
      </div>
      <div className="row">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault();
              add(text);
            }
          }}
          placeholder="タグを入力して追加"
          enterKeyHint="done"
        />
        <button type="button" className="btn small" onClick={() => add(text)} disabled={!text.trim()}>
          追加
        </button>
      </div>
      {rest.length > 0 && (
        <div className="chips">
          {rest.map((t) => (
            <button key={t} type="button" className="chip" onClick={() => add(t)}>
              ＋{t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Artwork({ url, size = 48 }: { url?: string; size?: number }) {
  const [err, setErr] = useState(false);
  if (!url || err) {
    return (
      <span className="art art-empty" style={{ width: size, height: size }}>
        <Icon name="mic" size={size * 0.45} />
      </span>
    );
  }
  return <img className="art" src={url} width={size} height={size} alt="" loading="lazy" onError={() => setErr(true)} />;
}

export function fmtScore(n: number | null | undefined) {
  if (n == null) return '—';
  return Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/0+$/, '');
}

export function today() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function fmtDate(iso: string | null | undefined) {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  const thisYear = String(new Date().getFullYear());
  return y === thisYear ? `${Number(m)}/${Number(d)}` : `${y}/${Number(m)}/${Number(d)}`;
}
