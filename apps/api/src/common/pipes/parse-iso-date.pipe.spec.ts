import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { ParseIsoDatePipe } from './parse-iso-date.pipe';

void test('ParseIsoDatePipe parses valid ISO date string', () => {
  const pipe = new ParseIsoDatePipe();
  const dateStr = '2026-10-12T00:00:00.000Z';
  const result = pipe.transform(dateStr);

  assert.ok(result instanceof Date);
  assert.equal(result.toISOString(), dateStr);
});

void test('ParseIsoDatePipe handles optional empty input', () => {
  const pipe = new ParseIsoDatePipe({ optional: true });
  assert.equal(pipe.transform(undefined), undefined);
  assert.equal(pipe.transform(''), undefined);
});

void test('ParseIsoDatePipe throws BadRequestException on invalid date', () => {
  const pipe = new ParseIsoDatePipe({ fieldName: 'startAt' });
  assert.throws(
    () => {
      pipe.transform('invalid-date-string');
    },
    (err: unknown) => {
      assert.ok(err instanceof BadRequestException);
      assert.match((err as Error).message, /startAt không đúng định dạng/);
      return true;
    },
  );
});
