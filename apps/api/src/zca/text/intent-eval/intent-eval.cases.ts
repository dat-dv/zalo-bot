import { TextToolType } from '../text-tool.enum';

/** No tool call: the bot just chats. */
export const CHAT = 'CHAT';

export type IntentExpectation = TextToolType | typeof CHAT;

export interface IntentEvalCase {
  /** The message as the bot receives it (bot mention already stripped). */
  text: string;
  expect: IntentExpectation;
}

/**
 * Vietnamese messages with the tool the bot must pick, run by `npm run eval:intent` against the
 * real LLM with the bot's own prompt. Includes the lines of the real chats of 25–26/10/2026 and the
 * pairs that are easy to confuse (the word "nhớ" appears in reminders, tasks and notes alike).
 */
export const INTENT_EVAL_CASES: readonly IntentEvalCase[] = [
  // Notes (Ghi nhớ): lasting facts about the bot or the group, no time, no task.
  { text: 'mày là con mèo đen 2 mái 10 tuổi', expect: TextToolType.REMEMBER_NOTE },
  { text: 'tao dặn rồi mày là con mèo đen 2 mái', expect: TextToolType.REMEMBER_NOTE },
  { text: 'từ giờ xưng em gọi anh chị nha', expect: TextToolType.REMEMBER_NOTE },
  { text: 'từ giờ gọi tao là đại ca', expect: TextToolType.REMEMBER_NOTE },
  { text: 'nhớ là Hằng ăn chay', expect: TextToolType.REMEMBER_NOTE },
  { text: 'chồng Hằng là anh Đạt', expect: TextToolType.REMEMBER_NOTE },
  { text: 'nhà mình ăn cơm lúc 7h tối', expect: TextToolType.REMEMBER_NOTE },
  { text: 'nhớ là chồng Hằng thích bánh tráng trộn', expect: TextToolType.REMEMBER_NOTE },
  { text: 'quên vụ mèo đen đi', expect: TextToolType.FORGET_MEMORY },
  { text: 'đừng nhớ chuyện đại ca nữa', expect: TextToolType.FORGET_MEMORY },

  // Reminders: be told at a moment.
  { text: '8h tối nhắc tắt bếp', expect: TextToolType.SET_REMINDER },
  { text: '15 phút nữa nhắc tôi gọi điện cho mẹ', expect: TextToolType.SET_REMINDER },
  { text: '7h tối nhớ mua sữa', expect: TextToolType.SET_REMINDER },
  {
    text: 'nhớ nhắc chồng Hằng mua bánh tráng trộn lúc 6h chiều',
    expect: TextToolType.SET_REMINDER,
  },
  { text: 'mai 9h họp', expect: TextToolType.SET_REMINDER },
  { text: '3h chiều mai nhắc tôi làm slide', expect: TextToolType.SET_REMINDER },
  { text: 'mỗi dịp 14/2 nhắc mua hoa', expect: TextToolType.SET_REMINDER },
  { text: '7h tối nhắc nấu cơm', expect: TextToolType.SET_REMINDER },
  { text: '6h sáng mai gọi tao dậy', expect: TextToolType.SET_REMINDER },

  // Tasks: something to get done, at most a due day.
  { text: 'thêm việc nộp báo cáo', expect: TextToolType.CREATE_TASK },
  { text: 'cần mua sữa chua', expect: TextToolType.CREATE_TASK },
  { text: 'nhớ mua sữa', expect: TextToolType.CREATE_TASK },
  { text: 'mai nhớ nộp hồ sơ', expect: TextToolType.CREATE_TASK },
  { text: 'thêm việc làm slide, 3h chiều mai nhắc tôi', expect: TextToolType.CREATE_TASK },
  { text: 'việc: sửa vòi nước nhà tắm', expect: TextToolType.CREATE_TASK },

  // Calendar: only when a calendar entry is asked for.
  { text: 'thêm lịch họp dự án 14h mai', expect: TextToolType.CREATE_CALENDAR_EVENT },
  { text: 'đặt lịch hẹn cà phê thứ 6 lúc 19h', expect: TextToolType.CREATE_CALENDAR_EVENT },

  // Plain chat: questions to the bot, jokes, insults, passing orders.
  { text: 'hello mày là con gì', expect: CHAT },
  { text: 'mày là con gì', expect: CHAT },
  { text: 'mày bao nhiêu tuổi rồi', expect: CHAT },
  { text: 'mày đang ở đâu', expect: CHAT },
  { text: 'cút lên mái nhà đi', expect: CHAT },
  { text: 'ở đó phơi nắng đi', expect: CHAT },
  { text: 'ngu à', expect: CHAT },
  { text: 'oke nha', expect: CHAT },
  { text: 'kêu chồng Hằng về ăn cơm', expect: CHAT },

  // Other tools keep working.
  { text: 'sáng nay đi bơi hết 70k ở hồ bơi tây thạnh', expect: TextToolType.RECORD_TRANSACTION },
  { text: 'cho Nam vay 200k', expect: TextToolType.MANAGE_DEBT },
  { text: 'hôm nay tiêu bao nhiêu', expect: TextToolType.GET_REPORT },
  { text: 'còn việc gì chưa xong', expect: TextToolType.LIST_TASKS },
];
