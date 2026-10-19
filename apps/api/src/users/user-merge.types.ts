import type {
  DeepPartial,
  EntityTarget,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  ObjectLiteral,
} from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

/** Narrow subset of TypeORM EntityManager used by the user merge flow. */
export interface UserMergeManager {
  findOne<E extends ObjectLiteral>(
    target: EntityTarget<E>,
    options: FindOneOptions<E>,
  ): Promise<E | null>;
  find<E extends ObjectLiteral>(target: EntityTarget<E>, options: FindManyOptions<E>): Promise<E[]>;
  count<E extends ObjectLiteral>(
    target: EntityTarget<E>,
    options: FindManyOptions<E>,
  ): Promise<number>;
  update<E extends ObjectLiteral>(
    target: EntityTarget<E>,
    criteria: FindOptionsWhere<E>,
    partial: QueryDeepPartialEntity<E>,
  ): Promise<unknown>;
  delete<E extends ObjectLiteral>(
    target: EntityTarget<E>,
    criteria: FindOptionsWhere<E>,
  ): Promise<unknown>;
  save<E extends ObjectLiteral>(target: EntityTarget<E>, entity: DeepPartial<E>): Promise<unknown>;
}

/** Unit of work: read access plus an atomic transaction boundary. */
export interface UserMergeUnitOfWork {
  readonly manager: UserMergeManager;
  transaction<T>(work: (manager: UserMergeManager) => Promise<T>): Promise<T>;
}

/** UsersService capabilities required after a merge (cache and whitelist refresh). */
export interface UserMergeUsersPort {
  isBotAccount(userId: string): boolean;
  afterUsersMerged(sourceUserId: string, targetUserId: string): Promise<void>;
}

export const USER_MERGE_UNIT_OF_WORK = Symbol('USER_MERGE_UNIT_OF_WORK');
export const USER_MERGE_USERS_PORT = Symbol('USER_MERGE_USERS_PORT');
