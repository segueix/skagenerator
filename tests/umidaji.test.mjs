import assert from 'node:assert/strict';
import { test } from 'node:test';
import { syllables } from '../singing/catalan-phones.mjs';
import { phonemeSegments, phraseInput } from '../singing/umidaji-score.mjs';

test('Umidaji conserva els sons distintius del català central', () => {
  const cases = {
    poc: ['p', 'oh', 'k'], taxi: ['t', 'a', 'k', 's', 'i'], caixa: ['k', 'a', 'sh', 'ax'],
    quatre: ['k', 'w', 'a', 't', 'r', 'ax'], sang: ['s', 'a', 'ng'], amor: ['ax', 'm', 'o', 'r'],
    ull: ['u', 'lh'], any: ['a', 'nh'], passeig: ['p', 'ax', 's', 'e', 'ch']
  };
  for (const [word, expected] of Object.entries(cases)) {
    assert.deepEqual(syllables(word).flat(2), expected, word);
  }
  assert.equal(syllables('avui').length, 2);
  assert.equal(syllables('conduir').length, 3);
});

test('la t de «tot prou» sobreviu a dues notes ràpides i arriba al model', () => {
  const notes = ['tot', 'prou'].map((word, i) => ({ word, t: i * .15, d: .15, midi: 64, syllable: 0 }));
  const segments = phonemeSegments(notes);
  assert.deepEqual(segments.map(s => s.phone), ['t', 'o', 't', 'p', 'r', 'oh', 'w']);
  assert(segments.every((s, i) => i === 0 || s.start >= segments[i - 1].end - 1e-9));
  const input = phraseInput(notes, 0);
  assert.deepEqual(input.phones, ['SP', 't', 'o', 't', 'p', 'r', 'oh', 'w', 'SP']);
  assert.equal(input.durations.reduce((a, b) => a + b), input.frames);
  assert.equal(input.notesDuration.reduce((a, b) => a + b), input.frames);
});
