import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEmbeddingText } from './embedding-text';
import { EMBED_MAX_CHARS } from './local-embedder';

void test('buildEmbeddingText puts the message first, then the two messages before it', () => {
  const text = buildEmbeddingText({ senderName: 'Nam', text: 'ok  chốt\nquán đó' }, [
    { senderName: 'Hằng', text: 'đi ăn lẩu không' },
    { senderName: 'Đạt', text: 'lẩu Thái ở Q3' },
    { senderName: 'Hằng', text: 'tối nay nha' },
  ]);
  assert.equal(text, 'Nam: ok chốt quán đó\nHằng: tối nay nha\nĐạt: lẩu Thái ở Q3');
});

void test('buildEmbeddingText drops context lines before cutting the message', () => {
  const long = 'x'.repeat(EMBED_MAX_CHARS - 10);
  assert.equal(
    buildEmbeddingText({ senderName: null, text: long }, [
      { senderName: 'A', text: 'ngữ cảnh dài' },
    ]),
    long,
  );
  const tooLong = 'y'.repeat(EMBED_MAX_CHARS + 50);
  assert.equal(buildEmbeddingText({ senderName: null, text: tooLong }, []).length, EMBED_MAX_CHARS);
});
