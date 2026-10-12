import { test } from 'node:test';
import assert from 'node:assert/strict';
import { songsToCsv, logsToCsv, parseCsv, rowsToSongs, rowsToLogs, detectKind } from '../src/csv.ts';
import type { Song, ScoreLog } from '../src/types.ts';

const song: Song = {
  id: 's1', title: 'Pretender, "Live"', artist: 'Official髭男dism', rating: 4, key: -3,
  preferredMachine: 'DAM', mood: 'ミディアム', tags: ['友達と', '練習'], favorite: true,
  memo: '1行目\n2行目', createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
};
const log: ScoreLog = { id: 'l1', songId: 's1', date: '2026-10-10', machine: 'DAM', scoringMode: '精密採点Ai', score: 88.123, keyUsed: -3, createdAt: '2026-10-10T10:00:00.000Z' };

test('曲CSVの往復', () => {
  const rows = parseCsv(songsToCsv([song]));
  assert.equal(detectKind(rows), 'songs');
  const [back] = rowsToSongs(rows, []);
  assert.equal(back.title, song.title);
  assert.equal(back.memo, song.memo);
  assert.deepEqual(back.tags, song.tags);
  assert.equal(back.key, -3);
  assert.equal(back.rating, 4);
  assert.equal(back.favorite, true);
});

test('ログCSVの往復', () => {
  const rows = parseCsv(logsToCsv([log], [song]));
  assert.equal(detectKind(rows), 'logs');
  const { logs, skipped } = rowsToLogs(rows, [song]);
  assert.equal(skipped, 0);
  assert.equal(logs[0].score, 88.123);
  assert.equal(logs[0].scoringMode, '精密採点Ai');
});

test('日本語ヘッダの最小CSV（他アプリからの移行）', () => {
  const rows = parseCsv('曲名,歌手名,キー\nマリーゴールド,あいみょん,-1\n');
  assert.equal(detectKind(rows), 'songs');
  const [s] = rowsToSongs(rows, []);
  assert.equal(s.artist, 'あいみょん');
  assert.equal(s.key, -1);
  assert.equal(s.rating, 3);
});
