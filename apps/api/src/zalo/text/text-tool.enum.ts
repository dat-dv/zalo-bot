export enum TextToolType {
  // Commands (Fast path)
  START = 'START',
  HELP = 'HELP',
  ECHO = 'ECHO',
  PING = 'PING',
  RESET = 'RESET',

  // Business Tools (Resolved via LLM Function Calling)
  MANAGE_DEBT = 'MANAGE_DEBT',
  RECORD_TRANSACTION = 'RECORD_TRANSACTION',
  SET_REMINDER = 'SET_REMINDER',
  GET_REPORT = 'GET_REPORT',

  // Conversational response
  CONVERSATION = 'CONVERSATION',
}
