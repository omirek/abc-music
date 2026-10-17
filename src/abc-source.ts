export const STARTER_ABC = `X:1
T:Morning at the Harbor
C:ABC Studio
M:4/4
L:1/8
Q:1/4=108
K:G
GABd B2AG | E2DE G4 | A2BA G2E2 | D6 z2 |
B2AG E2DE | G3A B2d2 | e2dB A2G2 | G8 |`;

const NATURAL_ORDER = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const NOTE_PATTERN = /(?:\^\^|__|[=^_])?[A-Ga-g][,']*(?:\d+\/?\d*|\/+)?/g;

export interface NoteShape {
  letter: string;
  octave: number;
  accidental: string;
  length: string;
  matchStart: number;
  matchEnd: number;
}

export function findNoteShape(source: string): NoteShape | null {
  const matches = [...source.matchAll(NOTE_PATTERN)];
  if (matches.length !== 1) return null;
  const match = matches[0];
  const token = match[0];
  const parsed = /^(\^\^|__|[=^_])?([A-Ga-g])([,']*)(\d+\/?\d*|\/+)?$/.exec(token);
  if (!parsed) return null;
  const [, accidental = '', letter, octaveMarks, length = ''] = parsed;
  const octave = letter === letter.toLowerCase() ? 1 : 0;
  const markerOctave = [...octaveMarks].reduce((value, marker) => value + (marker === "'" ? 1 : -1), 0);
  return {
    letter: letter.toUpperCase(),
    octave: octave + markerOctave,
    accidental,
    length,
    matchStart: match.index ?? 0,
    matchEnd: (match.index ?? 0) + token.length,
  };
}

export function transposeNote(code: string, start: number, end: number, steps: number): string | null {
  const source = code.slice(start, end);
  const shape = findNoteShape(source);
  if (!shape) return null;
  const letterIndex = NATURAL_ORDER.indexOf(shape.letter);
  const pitchIndex = (shape.octave * 7) + letterIndex - steps;
  const targetOctave = Math.floor(pitchIndex / 7);
  const targetLetter = NATURAL_ORDER[((pitchIndex % 7) + 7) % 7];
  const encodedLetter = targetOctave >= 1 ? targetLetter.toLowerCase() : targetLetter;
  const octaveMarks = targetOctave >= 1
    ? "'".repeat(targetOctave - 1)
    : ','.repeat(Math.abs(targetOctave));
  const replacement = `${shape.accidental}${encodedLetter}${octaveMarks}${shape.length}`;
  const noteStart = start + shape.matchStart;
  const noteEnd = start + shape.matchEnd;
  return code.slice(0, noteStart) + replacement + code.slice(noteEnd);
}

export function makeNoteToken(
  letter: string,
  octave: number,
  accidental: string,
  length: string,
): string {
  const encodedLetter = octave >= 1 ? letter.toLowerCase() : letter.toUpperCase();
  const octaveMarks = octave >= 1
    ? "'".repeat(octave - 1)
    : ','.repeat(Math.abs(octave));
  return `${accidental}${encodedLetter}${octaveMarks}${length}`;
}

export function noteLengthSuffix(code: string, wholeNoteLength: number): string {
  const unitMatch = /^L:\s*(\d+)\s*\/\s*(\d+)/m.exec(code);
  const unitLength = unitMatch ? Number(unitMatch[1]) / Number(unitMatch[2]) : 1 / 8;
  const ratio = wholeNoteLength / unitLength;
  if (Math.abs(ratio - 1) < 0.0001) return '';
  if (Number.isInteger(ratio)) return String(ratio);
  const denominator = Math.round(1 / ratio);
  if (Math.abs(1 / denominator - ratio) < 0.0001) return `/${denominator}`;
  return `${Math.round(ratio * 8)}/8`;
}

export function tuneInsertionPoint(code: string, tuneNumber: number): number {
  const starts = [...code.matchAll(/^X:.*$/gm)].map((match) => match.index ?? 0);
  const start = starts[tuneNumber] ?? 0;
  const end = starts[tuneNumber + 1] ?? code.length;
  const section = code.slice(start, end);
  const lines = [...section.matchAll(/[^\n]*(?:\n|$)/g)];
  let position = start;
  for (const line of lines) {
    if (!line[0]) continue;
    const content = line[0].trim();
    if (content && !/^[A-Za-z]:/.test(content) && !content.startsWith('%')) {
      position = start + (line.index ?? 0) + line[0].replace(/\n$/, '').length;
    }
  }
  return position;
}

export function inspectABC(code: string): string[] {
  const diagnostics: string[] = [];
  if (!/^K:/m.test(code)) diagnostics.push('Brak wymaganej linii K: z tonacją.');
  if (!/^[A-Ga-g_^=\[]/m.test(code.split(/^K:.*$/m).slice(1).join(''))) {
    diagnostics.push('Nie znaleziono nut po nagłówku K:.');
  }
  if (code.trim() && !/^X:/m.test(code) && !/^T:/m.test(code)) {
    diagnostics.push('Dodaj nagłówek X: lub T:, aby opisać utwór.');
  }
  return diagnostics;
}