const accented: Record<string, string> = {
  a: 'á', b: 'ƀ', c: 'ç', d: 'ð', e: 'é', f: 'ƒ', g: 'ĝ', h: 'ĥ', i: 'í',
  j: 'ĵ', k: 'ķ', l: 'ļ', m: 'ɱ', n: 'ñ', o: 'ö', p: 'ρ', q: 'ǫ', r: 'ŕ',
  s: 'š', t: 'ţ', u: 'ú', v: 'ṽ', w: 'ŵ', x: 'ẋ', y: 'ý', z: 'ž',
  A: 'À', B: 'Ɓ', C: 'Ç', D: 'Ð', E: 'É', F: 'Ƒ', G: 'Ĝ', H: 'Ĥ', I: 'Í',
  J: 'Ĵ', K: 'Ķ', L: 'Ļ', M: 'Ṁ', N: 'Ñ', O: 'Ö', P: 'Þ', Q: 'Ǫ', R: 'Ŕ',
  S: 'Š', T: 'Ţ', U: 'Ú', V: 'Ṽ', W: 'Ŵ', X: 'Ẋ', Y: 'Ý', Z: 'Ž',
};

// Interpolation placeholders and markup must survive untouched or i18next can't fill them.
const untouchable = /(\{\{[^}]*\}\}|<[^>]*>|\$t\([^)]*\))/;

// Other languages often run about 30% longer than English, so padding shows where layouts will overflow.
const EXPANSION = 0.3;

function pseudoString(text: string): string {
  const chunks = text.split(untouchable);
  const visibleLength = chunks
    .filter((_chunk, index) => index % 2 === 0)
    .join('').length;
  const body = chunks
    .map((chunk, index) =>
      index % 2 === 1 ? chunk : chunk.replace(/[a-zA-Z]/g, (c) => accented[c] ?? c),
    )
    .join('');
  const padding = '~'.repeat(Math.ceil(visibleLength * EXPANSION));
  return `[${body} ${padding}]`;
}

type Resource = { [key: string]: string | Resource };

export function pseudoLocalise<T extends Resource>(resource: T): T {
  return Object.fromEntries(
    Object.entries(resource).map(([key, value]) => [
      key,
      typeof value === 'string' ? pseudoString(value) : pseudoLocalise(value),
    ]),
  ) as T;
}
