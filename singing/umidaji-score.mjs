import { syllables } from './catalan-phones.mjs';

export const RATE = 44100;
const HOP = 512;
const FPS = RATE / HOP;

export function phrasesOf(notes) {
  const phrases = [];
  for (const note of notes) {
    const previous = phrases.at(-1)?.at(-1);
    const gap = previous ? note.t - previous.t - previous.d : Infinity;
    if (gap > .6 || (note.lineStart && gap > .25)) phrases.push([]);
    phrases.at(-1).push(note);
  }
  return phrases;
}

function slotsOf(notes) {
  const slots = [];
  for (let i = 0; i < notes.length;) {
    const first = notes[i++];
    const group = [first];
    while (i < notes.length && notes[i].word === first.word && notes[i].syllable > 0) group.push(notes[i++]);
    const sounds = first.word.split(/\s+/).flatMap(word => syllables(word).map((part, index) => [...part, index === 0]));
    for (let j = 1; sounds.length > group.length && j < sounds.length;) {
      const [onset, vowel, coda, wordStart] = sounds[j];
      if (wordStart && !onset.length && !sounds[j - 1][2].length) {
        sounds[j - 1][2] = [vowel, ...coda];
        sounds.splice(j, 1);
      } else j++;
    }
    for (const [j, note] of group.entries()) {
      const parts = sounds.slice(j, j === group.length - 1 ? sounds.length : j + 1);
      if (!parts.length) {
        slots.at(-1).end = Math.max(slots.at(-1).end, note.t + note.d);
        continue;
      }
      const duration = note.d / parts.length;
      for (const [k, [onset, vowel, coda]] of parts.entries()) {
        const start = note.t + k * duration;
        slots.push({ onset, vowel, coda, start, end: start + duration });
      }
    }
  }
  return slots;
}

export function phonemeSegments(notes) {
  const slots = slotsOf(notes);
  const segments = [];
  let previous = null;
  for (const { onset, vowel, coda, start, end } of slots) {
    let consonantStart = start - .07 * onset.length;
    if (previous) {
      const distance = Math.max(0, start - previous.vowel.start);
      consonantStart = Math.max(consonantStart, start - Math.max(.02 * onset.length, distance * .4));
      if (previous.end > consonantStart) {
        const minimumVowel = distance * .3;
        const minimumCoda = Math.min(.02 * previous.coda.length, distance * .3);
        consonantStart = Math.max(consonantStart, previous.vowel.start + minimumVowel + minimumCoda);
        const codaDuration = Math.min(previous.end - previous.vowel.end, consonantStart - previous.vowel.start - minimumVowel);
        previous.vowel.end = consonantStart - codaDuration;
        const step = codaDuration / previous.coda.length;
        for (const [i, part] of previous.coda.entries()) {
          part.start = previous.vowel.end + i * step;
          part.end = part.start + step;
        }
      }
    }
    const onsetStep = (start - consonantStart) / onset.length;
    for (const [i, phone] of onset.entries()) {
      const pos = consonantStart + i * onsetStep;
      segments.push({ phone, start: pos, end: pos + onsetStep });
    }
    const codaDuration = Math.min(.08 * coda.length, (end - start) * .4);
    const vowelSegment = { phone: vowel, start, end: end - codaDuration };
    const codaSegments = coda.map((phone, i) => ({
      phone, start: vowelSegment.end + i * codaDuration / coda.length,
      end: vowelSegment.end + (i + 1) * codaDuration / coda.length
    }));
    segments.push(vowelSegment, ...codaSegments);
    previous = { vowel: vowelSegment, coda: codaSegments, end };
  }
  return segments.filter(part => part.end - part.start > .005);
}

export function phraseInput(notes, shift) {
  const segments = phonemeSegments(notes), phones = [], durations = [];
  const start = segments[0].start - .25, end = segments.at(-1).end + .25;
  let cursor = start, frames = 0;
  function append(phone, until) {
    const length = Math.max(1, Math.round((until - start) * FPS) - frames);
    phones.push(phone); durations.push(length);
    frames += length;
  }
  for (const segment of segments) {
    if (segment.start - cursor > .02) append(segment.start - cursor < .35 ? 'SP' : 'AP', segment.start);
    if (segment.end > Math.max(cursor, segment.start)) {
      append(segment.phone, segment.end);
      cursor = segment.end;
    }
  }
  append('SP', end);
  const pitch = new Float32Array(frames), rest = new Uint8Array(frames).fill(1);
  const frameAt = t => Math.round((t - start) * FPS);
  for (const note of notes) {
    const from = Math.max(0, frameAt(note.t)), to = Math.min(frames, frameAt(note.t + note.d));
    if (to <= from) continue;
    pitch.fill(note.midi + shift, from, to);
    rest.fill(0, from, to);
  }
  let nearest = notes[0].midi + shift;
  for (let i = frames - 1; i >= 0; i--) {
    if (rest[i]) pitch[i] = nearest;
    else nearest = pitch[i];
  }
  const notesMidi = [], notesRest = [], notesDuration = [];
  for (let i = 0; i < frames; i++) {
    if (pitch[i] === notesMidi.at(-1) && rest[i] === notesRest.at(-1)) notesDuration[notesDuration.length - 1]++;
    else { notesMidi.push(pitch[i]); notesRest.push(rest[i]); notesDuration.push(1); }
  }
  return { start, frames, phones, durations, pitch, notesMidi, notesRest, notesDuration };
}
