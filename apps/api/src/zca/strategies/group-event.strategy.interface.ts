import type { API, GroupEvent } from 'zca-js';

export interface ZcaGroupEventStrategy {
  readonly name: string;
  canHandle(event: GroupEvent): boolean;
  handle(event: GroupEvent, api: API): Promise<boolean>;
}
