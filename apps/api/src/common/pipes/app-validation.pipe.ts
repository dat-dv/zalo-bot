import {
  BadRequestException,
  Injectable,
  ValidationError,
  ValidationPipe,
  ValidationPipeOptions,
} from '@nestjs/common';

function formatValidationErrors(errors: ValidationError[]): string[] {
  const messages: string[] = [];

  for (const error of errors) {
    if (error.constraints) {
      messages.push(...Object.values(error.constraints));
    }
    if (error.children && error.children.length > 0) {
      messages.push(...formatValidationErrors(error.children));
    }
  }

  return messages;
}

@Injectable()
export class AppValidationPipe extends ValidationPipe {
  constructor(options?: ValidationPipeOptions) {
    super({
      whitelist: true,
      transform: true,
      forbidUnknownValues: false,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: (errors: ValidationError[]) => {
        const messages = formatValidationErrors(errors);
        return new BadRequestException({
          statusCode: 400,
          message: messages.length > 0 ? messages : 'Dữ liệu yêu cầu không hợp lệ',
          error: 'Bad Request',
        });
      },
      ...options,
    });
  }
}
