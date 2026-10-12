// 検索用の表記ゆれ正規化。
// ひらがな/カタカナ、全角/半角、大文字/小文字、長音「ー」、ヴ、小さい文字、記号・空白を吸収する。

const SMALL_TO_NORMAL: Record<string, string> = {
  ぁ: 'あ', ぃ: 'い', ぅ: 'う', ぇ: 'え', ぉ: 'お',
  っ: 'つ', ゃ: 'や', ゅ: 'ゆ', ょ: 'よ', ゎ: 'わ', ゕ: 'か', ゖ: 'け',
};

const ROWS: Record<string, string> = {
  あ: 'あかさたなはまやらわがざだばぱ',
  い: 'いきしちにひみりぎじぢびぴ',
  う: 'うくすつぬふむゆるぐずづぶぷ',
  え: 'えけせてねへめれげぜでべぺ',
  お: 'おこそとのほもよろをごぞどぼぽ',
};

const VOWEL_OF: Record<string, string> = {};
for (const [vowel, chars] of Object.entries(ROWS)) {
  for (const c of chars) VOWEL_OF[c] = vowel;
}

function kataToHira(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

export function normalize(input: string | undefined | null): string {
  if (!input) return '';
  let s = input.normalize('NFKC').toLowerCase();
  s = kataToHira(s);
  // ヴ系 → バ行
  s = s
    .replace(/ゔぁ/g, 'ば')
    .replace(/ゔぃ/g, 'び')
    .replace(/ゔぇ/g, 'べ')
    .replace(/ゔぉ/g, 'ぼ')
    .replace(/ゔ/g, 'ぶ');
  // 小さい文字 → 通常
  s = s.replace(/[ぁぃぅぇぉっゃゅょゎゕゖ]/g, (c) => SMALL_TO_NORMAL[c] ?? c);
  // 記号・空白を除去（長音は残す）
  s = s.replace(/[^\p{L}\p{N}ー]/gu, '');

  // 長音・おう/えい の吸収
  let out = '';
  for (const c of s) {
    const prev = out[out.length - 1];
    const prevVowel = prev ? VOWEL_OF[prev] : undefined;
    if (c === 'ー') {
      out += prevVowel ?? '';
      continue;
    }
    if (c === 'う' && prevVowel === 'お') {
      out += 'お';
      continue;
    }
    if (c === 'い' && prevVowel === 'え') {
      out += 'え';
      continue;
    }
    out += c;
  }
  return out;
}

/** スペース区切りの全ての語が haystack に含まれるか */
export function matchesQuery(haystackNormalized: string, query: string): boolean {
  const terms = query.split(/[\s　]+/).map(normalize).filter(Boolean);
  return terms.every((t) => haystackNormalized.includes(t));
}
