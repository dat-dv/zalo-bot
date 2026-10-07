import assert from 'node:assert/strict';
import test from 'node:test';
import { buildReceiptAnalysisPrompt, parseReceiptImageAnalysis } from './gemini.service';

void test('includes Vietnam time context in the direct OCR JSON prompt', () => {
  const prompt = buildReceiptAnalysisPrompt('Thanh toán hôm nay', {
    nowText: 'Hôm nay là: Thứ Hai, ngày 25/08/2026 lúc 09:30:00 (Múi giờ Asia/Ho_Chi_Minh)',
    nowIso: '2026-08-25T09:30:00+07:00',
  });

  assert.match(prompt, /Asia\/Ho_Chi_Minh/);
  assert.match(prompt, /2026-08-25T09:30:00\+07:00/);
  assert.match(prompt, /Thanh toán hôm nay/);
});

void test('parses a complete receipt into a confirmation-ready transaction', () => {
  const result = parseReceiptImageAnalysis(
    JSON.stringify({
      kind: 'ready',
      type: 'expense',
      amount: 65000,
      category: 'Ăn uống',
      note: 'Cơm trưa',
      summary: 'Hoá đơn cơm trưa 65.000đ.',
    }),
  );

  assert.deepEqual(result, {
    kind: 'ready',
    type: 'expense',
    amount: 65000,
    category: 'Ăn uống',
    note: 'Cơm trưa',
    occurredAt: undefined,
    summary: 'Hoá đơn cơm trưa 65.000đ.',
  });
});

void test('does not create a transaction from an incomplete image analysis', () => {
  const result = parseReceiptImageAnalysis(
    JSON.stringify({
      kind: 'missing_fields',
      missingFields: ['amount'],
      summary: 'Chỉ đọc được tên cửa hàng.',
    }),
  );

  assert.deepEqual(result, {
    kind: 'missing_fields',
    missingFields: ['amount'],
    summary: 'Chỉ đọc được tên cửa hàng.',
  });
});
