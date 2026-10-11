import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { ParsePositiveNumberPipe } from './parse-positive-number.pipe';

void test('ParsePositiveNumberPipe parses valid positive numbers', () => {
  const pipe = new ParsePositiveNumberPipe();
  assert.equal(pipe.transform('150000'), 150000);
  assert.equal(pipe.transform(42), 42);
});

void test('ParsePositiveNumberPipe handles optional allowZero correctly', () => {
  const pipe = new ParsePositiveNumberPipe({ allowZero: true });
  assert.equal(pipe.transform(0), 0);
  assert.equal(pipe.transform('0'), 0);
});

void test('ParsePositiveNumberPipe throws BadRequestException on negative or non-numeric input', () => {
  const pipe = new ParsePositiveNumberPipe({ fieldName: 'Số tiền' });

  assert.throws(
    () => {
      pipe.transform('-1000');
    },
    (err: unknown) => {
      assert.ok(err instanceof BadRequestException);
      assert.match((err as Error).message, /Số tiền phải là một số hợp lệ lớn hơn 0/);
      return true;
    },
  );

  assert.throws(
    () => {
      pipe.transform('abc');
    },
    (err: unknown) => {
      assert.ok(err instanceof BadRequestException);
      return true;
    },
  );
});
