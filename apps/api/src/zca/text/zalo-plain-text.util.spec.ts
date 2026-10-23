import assert from 'node:assert/strict';
import test from 'node:test';
import { TextStyle } from 'zca-js';
import { toZaloPlainMessage, toZaloPlainText } from './zalo-plain-text.util';

void test('toZaloPlainText drops bold markers', () => {
  assert.equal(toZaloPlainText('**Ghi chú:** ăn sáng'), 'Ghi chú: ăn sáng');
  assert.equal(toZaloPlainText('***rất*** quan trọng'), 'rất quan trọng');
  assert.equal(toZaloPlainText('món __phở__ ngon'), 'món phở ngon');
  assert.equal(toZaloPlainText('**a** và **b**'), 'a và b');
});

void test('toZaloPlainText drops italic stars glued to words only', () => {
  assert.equal(toZaloPlainText('*nghiêng* nhé'), 'nghiêng nhé');
  assert.equal(toZaloPlainText('đây là (*ghi chú*).'), 'đây là (ghi chú).');
  assert.equal(toZaloPlainText('5*3*2 = 30'), '5*3*2 = 30');
  assert.equal(toZaloPlainText('a * b * c'), 'a * b * c');
});

void test('toZaloPlainText drops code fences and inline code, keeping their content', () => {
  assert.equal(toZaloPlainText('Gõ `yes 629` để xác nhận'), 'Gõ yes 629 để xác nhận');
  assert.equal(toZaloPlainText('Ví dụ:\n```text\nyes 629\n```\nXong.'), 'Ví dụ:\nyes 629\nXong.');
  assert.equal(toZaloPlainText('```yes 629```'), 'yes 629');
});

void test('toZaloPlainText drops heading marks but keeps hashtags', () => {
  assert.equal(toZaloPlainText('## Món ngon\nPhở'), 'Món ngon\nPhở');
  assert.equal(toZaloPlainText('#zalobot #1'), '#zalobot #1');
});

void test('toZaloPlainText turns star bullets into • and keeps dash bullets', () => {
  assert.equal(toZaloPlainText('* Phở\n+ Bún\n  * Bún bò'), '• Phở\n• Bún\n  • Bún bò');
  assert.equal(toZaloPlainText('- Phở\n- Bún'), '- Phở\n- Bún');
  assert.equal(toZaloPlainText('* **Phở:** 40k'), '• Phở: 40k');
});

void test('toZaloPlainText drops horizontal rules and extra blank lines', () => {
  assert.equal(toZaloPlainText('Phần 1\n\n---\n\nPhần 2'), 'Phần 1\n\nPhần 2');
  assert.equal(toZaloPlainText('A\n***\nB'), 'A\nB');
  assert.equal(toZaloPlainText('A\n\n\n\nB'), 'A\n\nB');
});

void test('toZaloPlainText drops unclosed markers', () => {
  assert.equal(toZaloPlainText('**Lưu ý: chưa đóng'), 'Lưu ý: chưa đóng');
  assert.equal(toZaloPlainText('đoạn cuối**'), 'đoạn cuối');
});

void test('toZaloPlainText rewrites markdown links as label: url', () => {
  assert.equal(
    toZaloPlainText('[Xem ảnh](https://photos.app.goo.gl/a_b*c)'),
    'Xem ảnh: https://photos.app.goo.gl/a_b*c',
  );
  assert.equal(toZaloPlainText('[https://x.com](https://x.com)'), 'https://x.com');
});

void test('toZaloPlainText keeps URLs untouched', () => {
  const drive = 'https://drive.google.com/drive/folders/1__AbC_d*e';
  assert.equal(toZaloPlainText(`Thư mục: ${drive}`), `Thư mục: ${drive}`);
  assert.equal(toZaloPlainText('**https://x.com/a_b**'), 'https://x.com/a_b');
  assert.equal(toZaloPlainText('`https://x.com/a__b`'), 'https://x.com/a__b');
});

void test('toZaloPlainText leaves bot templates unchanged', () => {
  const card =
    '⏳ Xác nhận lưu 🔴 khoản chi?\n\n' +
    '• Phân loại: 🔴 Khoản chi\n' +
    '• Số tiền: 30.000 đ\n' +
    '• Ghi chú: ăn bánh tráng nướng buổi tối\n\n' +
    '👉 Thả tim (❤️) hoặc soạn: yes 629 (để xác nhận)\n' +
    '👉 Soạn: edit 629 <nội dung sửa> (để điều chỉnh)\n' +
    '⏱️ Tự động hết hạn sau 5 phút.';
  assert.equal(toZaloPlainText(card), card);
  assert.equal(
    toZaloPlainText(
      '✅ [230] Chi 15.000đ · Ăn uống · bánh mỳ\n📍 đối diện ctgroup · 🕗 08:30 21/10',
    ),
    '✅ [230] Chi 15.000đ · Ăn uống · bánh mỳ\n📍 đối diện ctgroup · 🕗 08:30 21/10',
  );
  assert.equal(toZaloPlainText('user_id: abc_def'), 'user_id: abc_def');
});

void test('toZaloPlainText never turns a message into an empty one', () => {
  assert.equal(toZaloPlainText('---'), '---');
});

void test('toZaloPlainMessage cleans text but keeps messages with mentions or styles as built', () => {
  assert.equal(toZaloPlainMessage('**Chào**'), 'Chào');
  assert.deepEqual(toZaloPlainMessage({ msg: '**Chào**', ttl: 0 }), { msg: 'Chào', ttl: 0 });

  const tagged = { msg: '**@Nam** nhớ họp', mentions: [{ pos: 2, uid: '1', len: 4 }] };
  assert.equal(toZaloPlainMessage(tagged), tagged);
  const styled = { msg: '**Chào**', styles: [{ start: 0, len: 4, st: TextStyle.Bold }] };
  assert.equal(toZaloPlainMessage(styled), styled);
});
