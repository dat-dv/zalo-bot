import assert from 'node:assert/strict';
import test from 'node:test';
import { arePotentialDuplicateTaskTitles, normalizeTaskTitle } from './task-title.util';

void test('normalizes Vietnamese task titles before comparison', () => {
  assert.equal(normalizeTaskTitle('  Học C# (Ánh xạ bằng TS)  '), 'hoc c anh xa bang ts');
});

void test('recognizes exact and expanded task titles as potential duplicates', () => {
  assert.equal(arePotentialDuplicateTaskTitles('Học C#', 'Học C# (ánh xạ bằng TS)'), true);
  assert.equal(arePotentialDuplicateTaskTitles('Học Java', 'Ôn cấu trúc dữ liệu'), false);
});
