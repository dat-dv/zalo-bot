import assert from 'node:assert/strict';
import test from 'node:test';
import type { ZcaChannelNoteEntity } from '../../../database/entities/zca-channel-note.entity';
import type { TransactionConfirmationService } from '../../confirmation/transaction-confirmation.service';
import type { ChannelNotesService } from '../../memory/channel-notes.service';
import type { LearnedFactsService } from '../../memory/learned-facts.service';
import type { ZcaMessengerService } from '../../zca-messenger.service';
import type { AgentInput } from '../../../types/agent-input.type';
import { ForgetMemoryToolStrategy } from './forget-memory-tool.strategy';
import { RememberNoteToolStrategy, noteByShortId } from './remember-note-tool.strategy';

const INPUT: AgentInput = { type: 'text', senderId: 'u1', chatId: 'g-1', displayName: 'Đạt' };

function note(id: string, text: string): ZcaChannelNoteEntity {
  return { id, text, channelId: 'g-1' } as ZcaChannelNoteEntity;
}

function harness(notes: ZcaChannelNoteEntity[]) {
  const sent: string[] = [];
  const cards: Array<{ type: string; payload: unknown }> = [];
  const messenger = {
    sendMessage: (_chatId: string, text: string) => {
      sent.push(text);
      return Promise.resolve(true);
    },
  } as unknown as ZcaMessengerService;
  const confirmation = {
    createPendingRememberNote: (params: { payload: unknown }) => {
      cards.push({ type: 'REMEMBER_NOTE', payload: params.payload });
      return Promise.resolve({});
    },
    createPendingForgetMemory: (params: { payload: unknown }) => {
      cards.push({ type: 'FORGET_MEMORY', payload: params.payload });
      return Promise.resolve({});
    },
  } as unknown as TransactionConfirmationService;
  const notesService = {
    list: () => Promise.resolve(notes),
    findMatching: () => Promise.resolve(notes.filter((n) => n.text.includes('mèo'))),
  } as unknown as ChannelNotesService;
  const facts = { findMatching: () => Promise.resolve([]) } as unknown as LearnedFactsService;
  return {
    sent,
    cards,
    remember: new RememberNoteToolStrategy(messenger, confirmation, notesService),
    forget: new ForgetMemoryToolStrategy(messenger, confirmation, notesService, facts),
  };
}

const context = (toolArgs: Record<string, unknown>) => ({
  input: INPUT,
  chatId: 'g-1',
  senderId: 'u1',
  displayName: 'Đạt',
  text: 'tao dặn rồi mày là con mèo đen 2 mái',
  toolArgs,
});

void test('noteByShortId maps the [nX] ids shown in the prompt', () => {
  const notes = [note('a', 'một'), note('b', 'hai')];
  assert.equal(noteByShortId(notes, 'n2')?.id, 'b');
  assert.equal(noteByShortId(notes, '[n1]')?.id, 'a');
  assert.equal(noteByShortId(notes, 'n3'), undefined);
  assert.equal(noteByShortId(notes, 42), undefined);
});

void test('REMEMBER_NOTE asks for confirmation, or replaces the note it names', async () => {
  const h = harness([note('a', 'Bot là con mèo trắng')]);

  await h.remember.execute(context({ text: '  Bot là con   mèo đen 2 mái ' }));
  await h.remember.execute(context({ text: 'Bot là con mèo đen', replaceNoteId: 'n1' }));

  assert.deepEqual(h.cards, [
    {
      type: 'REMEMBER_NOTE',
      payload: {
        text: 'Bot là con mèo đen 2 mái',
        replaceNoteId: undefined,
        replaceNoteText: undefined,
      },
    },
    {
      type: 'REMEMBER_NOTE',
      payload: {
        text: 'Bot là con mèo đen',
        replaceNoteId: 'a',
        replaceNoteText: 'Bot là con mèo trắng',
      },
    },
  ]);
});

void test('REMEMBER_NOTE skips a note it already has and refuses beyond the limit', async () => {
  const same = harness([note('a', 'Bot là con mèo đen 2 mái')]);
  await same.remember.execute(context({ text: 'bot là con MÈO ĐEN 2 mái' }));
  assert.equal(same.cards.length, 0);
  assert.match(same.sent[0], /nhớ điều này rồi/);

  const full = harness(Array.from({ length: 20 }, (_, i) => note(`n${i}`, `ghi nhớ ${i}`)));
  await full.remember.execute(context({ text: 'điều mới' }));
  assert.equal(full.cards.length, 0);
  assert.match(full.sent[0], /đủ 20 điều ghi nhớ/);
});

void test('FORGET_MEMORY lists exactly what it will forget, or says nothing matches', async () => {
  const h = harness([note('a', 'Bot là con mèo đen 2 mái')]);

  await h.forget.execute(context({ query: 'mèo đen' }));
  await harness([]).forget.execute(context({ query: 'chó' }));

  assert.deepEqual(h.cards, [
    {
      type: 'FORGET_MEMORY',
      payload: {
        query: 'mèo đen',
        noteIds: ['a'],
        factIds: [],
        items: ['Bot là con mèo đen 2 mái'],
      },
    },
  ]);
});
