import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

export interface ParseIsoDatePipeOptions {
  optional?: boolean;
  fieldName?: string;
}

@Injectable()
export class ParseIsoDatePipe implements PipeTransform<unknown, Date | undefined> {
  constructor(private readonly options: ParseIsoDatePipeOptions = {}) {}

  transform(value: unknown): Date | undefined {
    const fieldName = this.options.fieldName || 'Ngày tháng';

    if (value === undefined || value === null || value === '') {
      if (this.options.optional) {
        return undefined;
      }
      throw new BadRequestException(`${fieldName} là bắt buộc.`);
    }

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value;
    }

    if (typeof value === 'string' || typeof value === 'number') {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    throw new BadRequestException(`${fieldName} không đúng định dạng ngày tháng hợp lệ.`);
  }
}
