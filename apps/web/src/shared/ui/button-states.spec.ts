import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { BUTTON_TONE } from './button-styles';

/**
 * Guards the unified button states: the base layer in `styles.css` owns cursor, disabled
 * dimming, the focus outline and transitions, colours come from `BUTTON_TONE`, so no button
 * re-spells them. Scans every `<button>`/`<Button>` opening tag together with the constants and
 * helpers it references (same file, then exported ones; recursively), looking only inside string
 * literals.
 */

const WEB_DIR = fileURLToPath(new URL('../../..', import.meta.url));
const SCAN_DIRS = ['src', 'app'];
const COLOUR =
  'slate|gray|zinc|neutral|stone|white|black|transparent|current|sky|blue|indigo|violet|purple|rose|red|pink|orange|amber|yellow|lime|green|emerald|teal|cyan';

const RULES: readonly { reason: string; pattern: RegExp }[] = [
  {
    reason: 'cursor comes from the base layer',
    pattern: /(?<![\w:-])cursor-(?:pointer|not-allowed)\b/g,
  },
  {
    reason: 'disabled dimming comes from the base layer',
    pattern: /disabled:opacity-(?!100\b)[\w./[\]]+/g,
  },
  {
    reason: 'disabled cursor comes from the base layer',
    pattern: /disabled:cursor-(?!default\b)[\w-]+/g,
  },
  {
    reason: 'focus outline comes from the base layer',
    pattern:
      // Allowed: moving the outline inward, or an extra pseudo-element cue next to it.
      /(?<![\w-])focus:[^\s'"`]+|focus-visible:(?!-?outline-offset-|after:|before:)[^\s'"`]+|(?<![\w:-])outline-(?:none|hidden|0)\b/g,
  },
  {
    reason: 'transitions come from the base layer',
    pattern: /(?<![\w:-])transition(?:-colors|-all)?(?![\w[-])/g,
  },
  { reason: 'pressed feedback comes from the base layer', pattern: /active:scale-[\w.]+/g },
  {
    // Left over from the old global button CSS; sizing `!` that beats a parent `[&_…]` rule stays.
    reason: 'no !important colours',
    pattern: new RegExp(
      `(?<![\\w)\\]])!(?:bg|text|border|ring|outline|shadow)-(?:${COLOUR})\\b[^\\s'"\`]*|(?<![\\w-])(?:bg|text|border)-(?:${COLOUR})\\b[^\\s'"\`!]*!(?![\\w-])`,
      'g',
    ),
  },
];

/** A disableable button must not change colour on hover: use `not-disabled:hover:`. */
const BARE_HOVER = /(?<![\w:-])(?:dark:)?hover:[^\s'"`]+/g;
const DISABLED_ATTRIBUTE = /\sdisabled(?=[\s=/>])/;

type Split = { code: string; strings: string[] };

const QUOTES = new Set(["'", '"', '`']);

/** Index just past the string literal that starts at `start` (template `${}` aware). */
function stringEnd(text: string, start: number): number {
  const quote = text[start];
  for (let i = start + 1; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\\') i++;
    else if (ch === quote) return i + 1;
    else if (quote === '`' && ch === '$' && text[i + 1] === '{') i = balancedEnd(text, i + 1) - 1;
  }
  return text.length;
}

/** Index just past the comment that starts at `start`, or `start` when there is none. */
function commentEnd(text: string, start: number): number {
  if (text[start] !== '/') return start;
  if (text[start + 1] === '/') {
    const end = text.indexOf('\n', start);
    return end === -1 ? text.length : end;
  }
  if (text[start + 1] === '*') {
    const end = text.indexOf('*/', start + 2);
    return end === -1 ? text.length : end + 2;
  }
  return start;
}

/** Index just past the bracket group that opens at `start`. */
function balancedEnd(text: string, start: number): number {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    const afterComment = commentEnd(text, i);
    if (afterComment !== i) {
      i = afterComment - 1;
    } else if (QUOTES.has(ch)) {
      i = stringEnd(text, i) - 1;
    } else if (ch === '{' || ch === '(' || ch === '[') {
      depth++;
    } else if (ch === '}' || ch === ')' || ch === ']') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return text.length;
}

/** Splits source text into code and string-literal contents; template expressions count as code. */
function splitStrings(text: string): Split {
  const split: Split = { code: '', strings: [] };
  let i = 0;
  while (i < text.length) {
    const afterComment = commentEnd(text, i);
    if (afterComment !== i) {
      i = afterComment;
      continue;
    }
    if (!QUOTES.has(text[i])) {
      split.code += text[i++];
      continue;
    }
    const end = stringEnd(text, i);
    const body = text.slice(i + 1, end - 1);
    if (text[i] !== '`') {
      split.strings.push(body);
    } else {
      let literal = '';
      for (let j = 0; j < body.length; j++) {
        if (body[j] === '$' && body[j + 1] === '{') {
          const exprEnd = balancedEnd(body, j + 1);
          const inner = splitStrings(body.slice(j + 2, exprEnd - 1));
          split.code += ` ${inner.code} `;
          split.strings.push(...inner.strings);
          literal += ' ';
          j = exprEnd - 1;
        } else {
          literal += body[j];
        }
      }
      split.strings.push(literal);
    }
    i = end;
  }
  return split;
}

/** Text of the `const`/`let`/`function` statement that starts at `start`. */
function statementText(text: string, start: number, isFunction: boolean): string {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    const afterComment = commentEnd(text, i);
    if (afterComment !== i) {
      i = afterComment - 1;
    } else if (QUOTES.has(ch)) {
      i = stringEnd(text, i) - 1;
    } else if (ch === '{' || ch === '(' || ch === '[') {
      depth++;
    } else if (ch === '}' || ch === ')' || ch === ']') {
      depth--;
      if (isFunction && depth === 0 && ch === '}') return text.slice(start, i + 1);
    } else if (ch === ';' && depth === 0) {
      return text.slice(start, i + 1);
    }
  }
  return text.slice(start);
}

/** Index just past the JSX opening tag that starts at `start`. */
function openingTagEnd(text: string, start: number): number {
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (QUOTES.has(ch)) i = stringEnd(text, i) - 1;
    else if (ch === '{') i = balancedEnd(text, i) - 1;
    else if (ch === '>') return i + 1;
  }
  return text.length;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !name.endsWith('.spec.ts') ? [path] : [];
  });
}

type SourceFile = { path: string; text: string; declarations: Map<string, string[]> };

// Indented declarations count too: a component may build its button classes in a local const.
const DECLARATION = /^([ \t]*)(export\s+)?(const|let|function)\s+([A-Za-z_$][\w$]*)/gm;

const append = (map: Map<string, string[]>, name: string, body: string) =>
  map.set(name, [...(map.get(name) ?? []), body]);

function indexSource(path: string, text: string, exported: Map<string, string[]>): SourceFile {
  const declarations = new Map<string, string[]>();
  for (const match of text.matchAll(DECLARATION)) {
    const body = statementText(text, match.index + match[1].length, match[3] === 'function');
    append(declarations, match[4], body);
    if (match[2] && match[1] === '') append(exported, match[4], body);
  }
  return { path, text, declarations };
}

function loadSources(): { files: SourceFile[]; exported: Map<string, string[]> } {
  const exported = new Map<string, string[]>();
  const files = SCAN_DIRS.flatMap((dir) => sourceFiles(join(WEB_DIR, dir))).map((path) =>
    indexSource(path, readFileSync(path, 'utf8'), exported),
  );
  return { files, exported };
}

/** String literals of a tag plus everything its identifiers resolve to (same file first). */
function resolvedStrings(file: SourceFile, exported: Map<string, string[]>, tag: string): string[] {
  const strings: string[] = [];
  const seen = new Set<string>();
  const pending = [tag];
  while (pending.length > 0) {
    const split = splitStrings(pending.pop() ?? '');
    strings.push(...split.strings);
    for (const [name] of split.code.matchAll(/[A-Za-z_$][\w$]*/g)) {
      if (seen.has(name)) continue;
      seen.add(name);
      pending.push(...(file.declarations.get(name) ?? exported.get(name) ?? []));
    }
  }
  return strings;
}

function buttonViolations(files: SourceFile[], exported: Map<string, string[]>): string[] {
  const violations: string[] = [];
  for (const file of files) {
    for (const match of file.text.matchAll(/<(?:button|Button)\b/g)) {
      const tag = file.text.slice(match.index, openingTagEnd(file.text, match.index));
      const where = `${relative(WEB_DIR, file.path)}:${file.text.slice(0, match.index).split('\n').length}`;
      const strings = resolvedStrings(file, exported, tag);
      const found = new Set<string>();
      for (const rule of RULES) {
        for (const value of strings) {
          for (const [token] of value.matchAll(rule.pattern))
            found.add(`${token} (${rule.reason})`);
        }
      }
      if (DISABLED_ATTRIBUTE.test(splitStrings(tag).code)) {
        for (const value of strings) {
          for (const [token] of value.matchAll(BARE_HOVER))
            found.add(`${token} (disableable button: use not-disabled:hover:)`);
        }
      }
      for (const issue of found) violations.push(`${where} ${issue}`);
    }
  }
  return violations;
}

test('BUTTON_TONE hovers never fire on a disabled button', () => {
  for (const [tone, classes] of Object.entries(BUTTON_TONE)) {
    assert.deepEqual(classes.match(BARE_HOVER) ?? [], [], tone);
  }
});

test('the guard follows classes into constants, including ones local to a component', () => {
  const fixture = [
    "const SHAPE = 'inline-flex cursor-pointer';",
    'export function Fixture({ busy }: { busy: boolean }) {',
    "  const tone = busy ? 'disabled:opacity-40' : '!bg-white';",
    '  return <button className={`${SHAPE} ${tone} not-disabled:hover:bg-sky-50 hover:bg-slate-50`} disabled={busy} />;',
    '}',
  ].join('\n');
  const exported = new Map<string, string[]>();
  const file = indexSource(join(WEB_DIR, 'fixture.tsx'), fixture, exported);
  assert.deepEqual(buttonViolations([file], exported), [
    'fixture.tsx:4 cursor-pointer (cursor comes from the base layer)',
    'fixture.tsx:4 disabled:opacity-40 (disabled dimming comes from the base layer)',
    'fixture.tsx:4 !bg-white (no !important colours)',
    'fixture.tsx:4 hover:bg-slate-50 (disableable button: use not-disabled:hover:)',
  ]);
});

test('buttons leave cursor, disabled, focus, transition and pressed states to the base layer', () => {
  const { files, exported } = loadSources();
  const violations = buttonViolations(files, exported);
  assert.equal(violations.length, 0, `\n${violations.join('\n')}`);
});
