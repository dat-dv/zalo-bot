import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { AppValidationPipe } from './app-validation.pipe';
import { IsNotEmpty, IsNumber, Min } from 'class-validator';

class CreateTestDto {
  @IsNotEmpty({ message: 'Title cannot be empty' })
  title!: string;

  @IsNumber({}, { message: 'Amount must be a number' })
  @Min(1000, { message: 'Amount must be at least 1000' })
  amount!: number;
}

void test('AppValidationPipe transforms valid data', async () => {
  const pipe = new AppValidationPipe();
  const rawInput = { title: 'Test transaction', amount: 50000 };

  const result = (await pipe.transform(rawInput, {
    type: 'body',
    metatype: CreateTestDto,
  })) as CreateTestDto;

  assert.equal(result.title, 'Test transaction');
  assert.equal(result.amount, 50000);
});

void test('AppValidationPipe throws BadRequestException with clean messages on invalid data', async () => {
  const pipe = new AppValidationPipe();
  const rawInput = { title: '', amount: 50 };

  await assert.rejects(
    async () => {
      await pipe.transform(rawInput, {
        type: 'body',
        metatype: CreateTestDto,
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof BadRequestException);
      const res = err.getResponse() as {
        message: string[];
      };
      assert.ok(Array.isArray(res.message));
      assert.ok(res.message.includes('Title cannot be empty'));
      assert.ok(res.message.includes('Amount must be at least 1000'));
      return true;
    },
  );
});
