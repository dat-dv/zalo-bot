import type { ThreadAccessPolicy } from './thread-access-policy';

/** A 1-1 chat grants nothing of its own: only global access counts. */
export class PersonalAccessPolicy implements ThreadAccessPolicy {
  public allows(): boolean {
    return false;
  }
}
