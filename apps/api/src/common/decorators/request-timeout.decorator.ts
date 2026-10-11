import { SetMetadata } from '@nestjs/common';
import { REQUEST_TIMEOUT_KEY } from '../constants/common.constants';

/**
 * Decorator to set a custom request timeout (in milliseconds) for a specific route handler.
 */
export const SetRequestTimeout = (milliseconds: number) =>
  SetMetadata(REQUEST_TIMEOUT_KEY, milliseconds);
