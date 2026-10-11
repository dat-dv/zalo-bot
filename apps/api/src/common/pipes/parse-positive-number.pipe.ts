import { BadRequestException, Injectable, Optional, PipeTransform } from '@nestjs/common';

export interface ParsePositiveNumberPipeOptions {
  optional?: boolean;
  fieldName?: string;
  allowZero?: boolean;
}

@Injectable()
export class ParsePositiveNumberPipe implements PipeTransform<unknown, number | undefined> {
  constructor(@Optional() private readonly options: ParsePositiveNumberPipeOptions = {}) {}

  transform(value: unknown): number | undefined {
    const fieldName = this.options.fieldName || 'Giá trị';

    if (value === undefined || value === null || value === '') {
      if (this.options.optional) {
        return undefined;
      }
      throw new BadRequestException(`${fieldName} là bắt buộc.`);
    }

    const parsed = Number(value);
    const minLimit = this.options.allowZero ? 0 : 0;
    const isValid = this.options.allowZero
      ? Number.isFinite(parsed) && parsed >= minLimit
      : Number.isFinite(parsed) && parsed > minLimit;

    if (!isValid) {
      const expectation = this.options.allowZero ? 'lớn hơn hoặc bằng 0' : 'lớn hơn 0';
      throw new BadRequestException(`${fieldName} phải là một số hợp lệ ${expectation}.`);
    }

    return parsed;
  }
}
