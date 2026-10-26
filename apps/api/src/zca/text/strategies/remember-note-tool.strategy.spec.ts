import assert from 'node:assert/strict';
import test from 'node:test';
import type { ZcaChannelNoteEntity } from '../../../database/entities/zca-channel-note.entity';
import type { ZcaLearnedFactEntity } from '../../../database/entities/zca-learned-fact.entity';
import type { ChannelNotesService } from '../../memory/channel-notes.service';
import type { ChatMemoryService, ConfirmedActionMemory } from '../../memory/chat-memory.service';
import type { LearnedFactsService } from '../../memory/learned-facts.service';
import type { ThreadConfigService } from '../../thread-config.service';
import type { ZcaMessengerService } from '../../zca-messenger.service';
import type { AgentInput } from '../../../types/agent-input.type';
import { ForgetMemoryToolStrategy } from './forget-memory-tool.strategy';
import { RememberNoteToolStrategy, noteByShortId, toolReply } from './remember-note-tool.strategy';

const INPUT: AgentInput = {
  type: 'text',
  senderId: 'u1',
  chatId: 'g-1',
  displayName: 'Văn Đạt',
  messageId: 'm-1',
};

function note(id: string, text: string): ZcaChannelNoteEntity {
  return { id, text, channelId: 'g-1', updatedAt: new Date(0) } as ZcaChannelNoteEntity;
}

function fact(id: string, text: string): ZcaLearnedFactEntity {
  return { id, fact: text, subjectKind: 'bot', subjectName: 'Đen' } as ZcaLearnedFactEntity;
}

function harness(notes: ZcaChannelNoteEntity[], facts: ZcaLearnedFactEntity[] = []) {
  const sent: string[] = [];
  const saved: Array<{ op: string; id?: string; text?: string }> = [];
  const actions: ConfirmedActionMemory[] = [];
  const messenger = {
    sendMessage: (_chatId: string, text: string) => {
      sent.push(text);
      return Promise.resolve(true);
    },
  } as unknown as ZcaMessengerService;
  const notesService = {
    list: () => Promise.resolve(notes),
    add: (_chatId: string, text: string) => {
      if (notes.length >= 20) return Promise.resolve({ reason: 'limit' });
      saved.push({ op: 'add', text });
      return Promise.resolve({ note: note('new', text) });
    },
    update: (_chatId: string, id: string, text: string) => {
      saved.push({ op: 'update', id, text });
      return Promise.resolve({ note: note(id, text) });
    },
    remove: (_chatId: string, ids: string[]) => {
      ids.forEach((id) => saved.push({ op: 'remove-note', id }));
      return Promise.resolve(ids.length);
    },
    findMatching: () => Promise.resolve(notes.filter((n) => n.text.includes('mèo'))),
  } as unknown as ChannelNotesService;
  const factsService = {
    findMatching: () => Promise.resolve(facts),
    remove: (_chatId: string, ids: string[]) => {
      ids.forEach((id) => saved.push({ op: 'remove-fact', id }));
      return Promise.resolve(ids.length);
    },
  } as unknown as LearnedFactsService;
  const threadConfigs = {
    findStoredConfig: () =>
      Promise.resolve({
        isListened: true,
        threadType: 'group',
        chatMemory: { enabled: true },
      }),
  } as unknown as ThreadConfigService;
  const chatMemory = {
    recordAction: (_c: string, _t: string, action: ConfirmedActionMemory) => {
      actions.push(action);
      return Promise.resolve();
    },
  } as unknown as ChatMemoryService;
  return {
    sent,
    saved,
    actions,
    remember: new RememberNoteToolStrategy(messenger, notesService, threadConfigs, chatMemory),
    forget: new ForgetMemoryToolStrategy(messenger, notesService, factsService),
  };
}

const context = (toolArgs: Record<string, unknown>) => ({
  input: INPUT,
  chatId: 'g-1',
  senderId: 'u1',
  displayName: 'Văn Đạt',
  text: 'mày là con mèo đen 2 mái 10 tuổi',
  toolArgs,
});

void test('noteByShortId maps the [nX] ids shown in the prompt', () => {
  const notes = [note('a', 'một'), note('b', 'hai')];
  assert.equal(noteByShortId(notes, 'n2')?.id, 'b');
  assert.equal(noteByShortId(notes, '[n1]')?.id, 'a');
  assert.equal(noteByShortId(notes, 'n3'), undefined);
  assert.equal(noteByShortId(notes, 42), undefined);
});

void test('toolReply uses the in-character reply, else the fallback', () => {
  assert.equal(toolReply({ reply: '  dạ em nhớ rồi 🐈‍⬛ ' }, 'x'), 'dạ em nhớ rồi 🐈‍⬛');
  assert.equal(toolReply({}, 'Dạ em nhớ rồi: x'), 'Dạ em nhớ rồi: x');
});

void test('REMEMBER_NOTE saves at once, answers in character and remembers it was done', async () => {
  const h = harness([]);

  await h.remember.execute(
    context({
      text: 'Bot là con mèo đen 2 mái 10 tuổi',
      reply: 'dạ em nhớ rồi, em là mèo đen 2 mái 10 tuổi nè 🐈‍⬛',
    }),
  );

  assert.deepEqual(h.saved, [{ op: 'add', text: 'Bot là con mèo đen 2 mái 10 tuổi' }]);
  assert.deepEqual(h.sent, ['dạ em nhớ rồi, em là mèo đen 2 mái 10 tuổi nè 🐈‍⬛']);
  assert.equal(h.actions[0]?.text, '(đã duyệt) Đã ghi nhớ: Bot là con mèo đen 2 mái 10 tuổi');
  assert.equal(h.actions[0]?.requesterName, 'Văn Đạt');
});

void test('REMEMBER_NOTE replaces the note it names and falls back to a default answer', async () => {
  const h = harness([note('a', 'Bot là con mèo trắng')]);

  await h.remember.execute(context({ text: 'Bot là con mèo đen', replaceNoteId: 'n1' }));

  assert.deepEqual(h.saved, [{ op: 'update', id: 'a', text: 'Bot là con mèo đen' }]);
  assert.deepEqual(h.sent, ['Dạ em nhớ rồi: Bot là con mèo đen']);
});

void test('REMEMBER_NOTE does not save a note twice and refuses beyond the limit', async () => {
  const same = harness([note('a', 'Bot là con mèo đen 2 mái')]);
  await same.remember.execute(
    context({ text: 'bot là con MÈO ĐEN 2 mái', reply: 'em nhớ rồi mà' }),
  );
  assert.equal(same.saved.length, 0);
  assert.deepEqual(same.sent, ['em nhớ rồi mà']);

  const full = harness(Array.from({ length: 20 }, (_, i) => note(`n${i}`, `ghi nhớ ${i}`)));
  await full.remember.execute(context({ text: 'điều mới' }));
  assert.equal(full.saved.length, 0);
  assert.match(full.sent[0], /đủ 20 điều ghi nhớ/);
});

void test('FORGET_MEMORY forgets at once, asks to narrow a vague request, or says nothing matches', async () => {
  const h = harness([note('a', 'Bot là con mèo đen 2 mái')], [fact('f1', 'Là mèo')]);
  await h.forget.execute(context({ query: 'mèo', reply: 'dạ em quên rồi' }));
  assert.deepEqual(h.saved, [
    { op: 'remove-note', id: 'a' },
    { op: 'remove-fact', id: 'f1' },
  ]);
  assert.deepEqual(h.sent, ['dạ em quên rồi']);

  const many = harness(
    Array.from({ length: 6 }, (_, i) => note(`m${i}`, `mèo ${i}`)),
    [],
  );
  await many.forget.execute(context({ query: 'mèo' }));
  assert.equal(many.saved.length, 0);
  assert.match(many.sent[0], /Có 6 điều khớp/);

  const none = harness([]);
  await none.forget.execute(context({ query: 'chó' }));
  assert.match(none.sent[0], /không nhớ điều gì khớp/);
});
