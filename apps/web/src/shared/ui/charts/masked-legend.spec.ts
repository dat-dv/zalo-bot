import assert from 'node:assert/strict';
import test from 'node:test';
import { maskedLegendLabels } from './masked-legend';

void test('maskedLegendLabels drops the ranking by amount', () => {
  const rankedByAmount = ['Đi lại', 'Ăn uống', 'Mua sắm', 'Khác'];

  assert.deepEqual(maskedLegendLabels(rankedByAmount, 'vi-VN'), [
    'Ăn uống',
    'Đi lại',
    'Khác',
    'Mua sắm',
  ]);
});

void test('maskedLegendLabels gives the same order whatever order the amounts came in', () => {
  const labels = ['Ăn uống', 'Đi lại', 'Khác'];

  assert.deepEqual(
    maskedLegendLabels(labels, 'vi-VN'),
    maskedLegendLabels([...labels].reverse(), 'vi-VN'),
  );
});

void test('maskedLegendLabels leaves its input untouched', () => {
  const labels = ['Khác', 'Ăn uống'];

  maskedLegendLabels(labels, 'vi-VN');

  assert.deepEqual(labels, ['Khác', 'Ăn uống']);
});
