// iTunes Search API（APIキー不要）。CORS を確実に避けるため JSONP で呼ぶ。

export interface ItunesTrack {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName?: string;
  artworkUrl100?: string;
  releaseDate?: string;
}

let seq = 0;

export function searchItunes(term: string, limit = 25): Promise<ItunesTrack[]> {
  return new Promise((resolve, reject) => {
    const cb = `__itunes_cb_${Date.now()}_${seq++}`;
    const params = new URLSearchParams({
      term,
      country: 'JP',
      entity: 'song',
      lang: 'ja_jp',
      limit: String(limit),
      callback: cb,
    });
    const script = document.createElement('script');
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error('timeout'));
    }, 12000);
    function cleanup() {
      window.clearTimeout(timer);
      delete (window as unknown as Record<string, unknown>)[cb];
      script.remove();
    }
    (window as unknown as Record<string, unknown>)[cb] = (data: { results?: ItunesTrack[] }) => {
      cleanup();
      const seen = new Set<string>();
      const results = (data.results ?? []).filter((t) => {
        // 同じ曲名×アーティストの重複（シングル版/アルバム版）を1件にまとめる
        const k = `${t.trackName}\u0000${t.artistName}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      resolve(results);
    };
    script.onerror = () => {
      cleanup();
      reject(new Error('network'));
    };
    script.src = `https://itunes.apple.com/search?${params.toString()}`;
    document.head.appendChild(script);
  });
}

/** 100px のジャケット URL を少し大きいサイズに差し替える */
export function artwork(url: string | undefined, size = 200): string | undefined {
  if (!url) return undefined;
  return url.replace(/\/\d+x\d+bb\./, `/${size}x${size}bb.`);
}

/** 歌詞をGoogleで探すURL（歌詞そのものはアプリに取り込まない） */
export function lyricsSearchUrl(title: string, artist?: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent([title, artist, '歌詞'].filter(Boolean).join(' '))}`;
}

/** 覚えている歌詞の一部から曲を探すURL */
export function lyricsPhraseSearchUrl(phrase: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`"${phrase.trim()}" 歌詞`)}`;
}
