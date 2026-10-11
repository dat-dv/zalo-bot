import assert from 'node:assert/strict';
import test from 'node:test';
import { TrimStringsPipe } from './trim-strings.pipe';

void test('TrimStringsPipe trims single string', () => {
  const pipe = new TrimStringsPipe();
  assert.equal(pipe.transform('  hello world   '), 'hello world');
});

void test('TrimStringsPipe trims nested object and array strings', () => {
  const pipe = new TrimStringsPipe();
  const input = {
    name: '  Nguyen Van A  ',
    tags: ['  tag1 ', ' tag2  '],
    nested: {
      description: '   detailed note   ',
      count: 42,
    },
  };

  const output = pipe.transform(input);
  assert.deepEqual(output, {
    name: 'Nguyen Van A',
    tags: ['tag1', 'tag2'],
    nested: {
      description: 'detailed note',
      count: 42,
    },
  });
});
