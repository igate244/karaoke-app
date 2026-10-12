import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, matchesQuery } from '../src/normalize.ts';

const same = (a: string, b: string) => assert.equal(normalize(a), normalize(b), `${a} ≠ ${b}`);

test('ひらがな/カタカナを同一視', () => {
  same('ありがとう', 'アリガトウ');
});

test('長音とおう/えいを同一視', () => {
  same('ありがとー', 'ありがとう');
  same('ありがとお', 'ありがとう');
  same('しょーめー', 'しょうめい');
  same('しょうめえ', 'しょうめい');
});

test('ヴとバ行', () => {
  same('ヴァイオリン', 'バイオリン');
  same('ヴォーカル', 'ボーカル');
});

test('全角/半角・大文字/小文字・記号・空白', () => {
  same('ＭＩＳＩＡ', 'misia');
  same('ｶﾗｵｹ', 'カラオケ');
  same('Mr.Children', 'mr children');
  same('B\'z', 'bz');
});

test('小さい文字', () => {
  same('シャッター', 'しやつたあ');
});

test('複数語のAND検索', () => {
  const hay = normalize('残酷な天使のテーゼ 高橋洋子 アニメ');
  assert.ok(matchesQuery(hay, 'テーゼ 高橋'));
  assert.ok(matchesQuery(hay, 'てーぜ'));
  assert.ok(matchesQuery(hay, 'てえぜ'));
  assert.ok(!matchesQuery(hay, 'テーゼ 宇多田'));
  assert.ok(matchesQuery(hay, ''));
});
