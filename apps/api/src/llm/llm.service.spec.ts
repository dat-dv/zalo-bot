import assert from 'node:assert/strict';
import test from 'node:test';
import { ConfigService } from '@nestjs/config';
import { GeminiProvider } from './providers/gemini.provider';
import { OpenAiProvider } from './providers/openai.provider';
import { LlmService } from './llm.service';

void test('GeminiProvider returns fallback message when API key is missing', async () => {
  const mockConfigService = {
    get: (key: string) => {
      if (key === 'llm.gemini.apiKey') return '';
      return undefined;
    },
  } as unknown as ConfigService;

  const provider = new GeminiProvider(mockConfigService);
  const res = await provider.generate('hello');
  assert.match(res.text || '', /Chưa cấu hình API Key/);
});

void test('GeminiProvider calls API and parses functionCall correctly', async () => {
  const mockConfigService = {
    get: (key: string) => {
      if (key === 'llm.gemini.apiKey') return 'mock_gemini_key';
      if (key === 'llm.gemini.model') return 'gemini-2.5-flash';
      return undefined;
    },
  } as unknown as ConfigService;

  const originalFetch = globalThis.fetch;
  let requestBody = '';

  globalThis.fetch = (input: string | URL | Request, init?: RequestInit) => {
    requestBody = typeof init?.body === 'string' ? init.body : '';
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          candidates: [
            {
              content: {
                parts: [
                  {
                    functionCall: {
                      name: 'MANAGE_DEBT',
                      args: { direction: 'payable', counterparty: 'a', amount: 100000 },
                    },
                  },
                ],
              },
            },
          ],
        }),
    } as Response);
  };

  try {
    const provider = new GeminiProvider(mockConfigService);
    const res = await provider.generate(
      'nợ a 100k',
      [
        {
          name: 'MANAGE_DEBT',
          description: 'Ghi nợ',
        },
      ],
      'system prompt',
    );

    assert.ok(res.toolCall);
    assert.equal(res.toolCall.name, 'MANAGE_DEBT');
    assert.equal(res.toolCall.args.amount, 100000);
    assert.match(requestBody, /"functionDeclarations"/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

void test('OpenAiProvider calls API and parses tool_calls correctly', async () => {
  const mockConfigService = {
    get: (key: string) => {
      if (key === 'llm.openai.apiKey') return 'mock_openai_key';
      if (key === 'llm.openai.model') return 'gpt-4o-mini';
      return undefined;
    },
  } as unknown as ConfigService;

  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => {
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    function: {
                      name: 'RECORD_TRANSACTION',
                      arguments: JSON.stringify({
                        type: 'expense',
                        amount: 35000,
                      }),
                    },
                  },
                ],
              },
            },
          ],
        }),
    } as Response);
  };

  try {
    const provider = new OpenAiProvider(mockConfigService);
    const res = await provider.generate('ăn phở 35k', [
      {
        name: 'RECORD_TRANSACTION',
        description: 'Thu chi',
      },
    ]);

    assert.ok(res.toolCall);
    assert.equal(res.toolCall.name, 'RECORD_TRANSACTION');
    assert.equal(res.toolCall.args.amount, 35000);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

void test('LlmService routes to active provider dynamically', async () => {
  const mockConfigService = {
    get: (key: string) => {
      if (key === 'llm.provider') return 'openai';
      return undefined;
    },
  } as unknown as ConfigService;

  const geminiProvider = {
    name: 'gemini',
    generate: () => Promise.resolve({ text: 'gemini reply' }),
  } as unknown as GeminiProvider;

  const openAiProvider = {
    name: 'openai',
    generate: () => Promise.resolve({ text: 'openai reply' }),
  } as unknown as OpenAiProvider;

  const llmService = new LlmService(mockConfigService, geminiProvider, openAiProvider);

  const res = await llmService.generate('test');
  assert.equal(res.text, 'openai reply');
});
