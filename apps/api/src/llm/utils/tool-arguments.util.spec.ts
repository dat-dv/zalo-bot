import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanToolArguments,
  parseAmount,
  normalizeSchemaTypes,
  unwrapArgumentValue,
} from './tool-arguments.util';

void test('unwrapArgumentValue handles primitive values unchanged', () => {
  assert.equal(unwrapArgumentValue('amount', 15000), 15000);
  assert.equal(unwrapArgumentValue('category', 'Ăn uống'), 'Ăn uống');
  assert.equal(unwrapArgumentValue('note', 'uống cà phê'), 'uống cà phê');
  assert.equal(unwrapArgumentValue('flag', true), true);
  assert.equal(unwrapArgumentValue('empty', null), null);
  assert.equal(unwrapArgumentValue('undef', undefined), undefined);
});

void test('unwrapArgumentValue unwraps same-key nested objects', () => {
  assert.equal(unwrapArgumentValue('amount', { amount: 15000 }), 15000);
  assert.equal(unwrapArgumentValue('amount', { amount: { amount: 15000 } }), 15000);
  assert.equal(unwrapArgumentValue('category', { category: 'Ăn uống' }), 'Ăn uống');
  assert.equal(unwrapArgumentValue('note', { note: 'uống cà phê' }), 'uống cà phê');
  assert.equal(unwrapArgumentValue('type', { type: 'expense' }), 'expense');
});

void test('unwrapArgumentValue unwraps value / val wrappers', () => {
  assert.equal(unwrapArgumentValue('amount', { value: 15000 }), 15000);
  assert.equal(unwrapArgumentValue('amount', { val: 20000 }), 20000);
});

void test('cleanToolArguments flattens all wrapped fields in an argument object', () => {
  const malformed = {
    amount: { amount: 15000 },
    category: { category: 'Ăn uống' },
    note: { note: 'uống cà phê' },
    type: { type: 'expense' },
  };

  const cleaned = cleanToolArguments(malformed);
  assert.deepEqual(cleaned, {
    amount: 15000,
    category: 'Ăn uống',
    note: 'uống cà phê',
    type: 'expense',
  });
});

void test('parseAmount correctly parses numbers, strings, and objects', () => {
  assert.equal(parseAmount(15000), 15000);
  assert.equal(parseAmount('15000'), 15000);
  assert.equal(parseAmount('15,000'), 15000);
  assert.equal(parseAmount('15k'), 15000);
  assert.equal(parseAmount('15.5k'), 15500);
  assert.equal(parseAmount('15 ngàn'), 15000);
  assert.equal(parseAmount('15 nghìn'), 15000);
  assert.equal(parseAmount('15tr'), 15000000);
  assert.equal(parseAmount('1.5 triệu'), 1500000);
  assert.equal(parseAmount({ amount: 15000 }), 15000);
  assert.equal(parseAmount({ amount: { amount: '15k' } }), 15000);
  assert.equal(parseAmount({ value: 30000 }), 30000);
  assert.equal(parseAmount('invalid'), 0);
  assert.equal(parseAmount(null), 0);
  assert.equal(parseAmount(undefined), 0);
});

void test('normalizeSchemaTypes converts uppercase type names to lowercase', () => {
  const schema = {
    type: 'OBJECT',
    properties: {
      type: { type: 'STRING', enum: ['income', 'expense'] },
      amount: { type: 'NUMBER' },
      items: { type: 'ARRAY', items: { type: 'STRING' } },
    },
    required: ['type', 'amount'],
  };

  const normalized = normalizeSchemaTypes(schema) as Record<string, unknown>;
  assert.deepEqual(normalized, {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['income', 'expense'] },
      amount: { type: 'number' },
      items: { type: 'array', items: { type: 'string' } },
    },
    required: ['type', 'amount'],
  });
});
