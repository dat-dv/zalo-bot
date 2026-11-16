import { createHash, timingSafeEqual } from 'crypto';
import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { SetRequestTimeout } from '../common/decorators/request-timeout.decorator';
import { LLM_PROXY_REQUEST_TIMEOUT_MS, LlmProxyService } from './llm-proxy.service';

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

/** Constant-time check of `Authorization: Bearer <key>` against the expected key. */
export function isAuthorizedBearer(header: string | undefined, expected: string): boolean {
  if (!expected) return false;
  const match = /^Bearer\s+(.+)$/i.exec(header ?? '');
  if (!match) return false;
  return timingSafeEqual(digest(match[1].trim()), digest(expected));
}

/**
 * Internal OpenAI-compatible endpoint for the Cognee container
 * (`LLM_ENDPOINT=http://api:<port>/api/internal/llm/v1`). Not reachable from the Internet: the
 * web nginx answers 404 for `/api/internal/`. The key is `COGNEE_USER_PASSWORD`, which the API
 * and Cognee already share, so no extra env is needed.
 */
@ApiExcludeController()
@Controller('internal/llm/v1')
export class LlmProxyController {
  constructor(
    private readonly proxy: LlmProxyService,
    private readonly config: ConfigService,
  ) {}

  @Post('chat/completions')
  @SetRequestTimeout(LLM_PROXY_REQUEST_TIMEOUT_MS)
  async chatCompletions(
    @Req() req: Request,
    @Body() body: unknown,
    @Res() res: Response,
  ): Promise<void> {
    const key = this.config.get<string>('cognee.userPassword') ?? '';
    if (!isAuthorizedBearer(req.headers.authorization, key)) {
      res.status(401).json({ error: { message: 'Unauthorized.', type: 'zalobot_llm_proxy' } });
      return;
    }
    const result = await this.proxy.chatCompletions(body);
    res.status(result.status).json(result.body);
  }
}
