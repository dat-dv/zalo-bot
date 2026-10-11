import { Injectable, PipeTransform } from '@nestjs/common';

function trimDeep<T>(value: T): T {
  if (typeof value === 'string') {
    return value.trim() as unknown as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => trimDeep(item)) as unknown as T;
  }

  if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
    const trimmedObj: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      trimmedObj[key] = trimDeep(val);
    }
    return trimmedObj as T;
  }

  return value;
}

@Injectable()
export class TrimStringsPipe implements PipeTransform {
  transform<T>(value: T): T {
    return trimDeep(value);
  }
}
