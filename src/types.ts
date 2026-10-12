export type Machine = 'DAM' | 'JOYSOUND' | 'その他';
export type PreferredMachine = 'DAM' | 'JOYSOUND' | 'どちらでも';
export type Mood = '盛り上がる' | 'ミディアム' | 'しっとり';

export const MACHINES: Machine[] = ['DAM', 'JOYSOUND', 'その他'];
export const PREFERRED_MACHINES: PreferredMachine[] = ['DAM', 'JOYSOUND', 'どちらでも'];
export const MOODS: Mood[] = ['盛り上がる', 'ミディアム', 'しっとり'];

export const RATING_LABELS: Record<number, string> = {
  5: '十八番',
  4: '自信あり',
  3: '無難に歌える',
  2: 'いける…かも',
  1: '練習中',
};

export interface Song {
  id: string;
  title: string;
  titleKana?: string;
  artist: string;
  artistKana?: string;
  artworkUrl?: string;
  itunesTrackId?: number;
  /** 歌える度 1〜5 */
  rating: number;
  /** -12〜+12 */
  key: number;
  preferredMachine: PreferredMachine;
  mood: Mood | null;
  tags: string[];
  favorite: boolean;
  memo: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScoreLog {
  id: string;
  songId: string;
  /** YYYY-MM-DD */
  date: string;
  machine: Machine;
  scoringMode?: string;
  score: number | null;
  keyUsed: number;
  memo?: string;
  createdAt: string;
}

export interface SongStats {
  best: number | null;
  latest: number | null;
  count: number;
  lastDate: string | null;
}
