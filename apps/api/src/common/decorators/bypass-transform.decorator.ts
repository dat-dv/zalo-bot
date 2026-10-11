import { SetMetadata } from '@nestjs/common';
import { BYPASS_TRANSFORM_KEY } from '../constants/common.constants';

/**
 * Decorator to bypass standard response transformation ({ data: ... }).
 * Useful for endpoints returning raw binary streams, file downloads, or OAuth HTML.
 */
export const BypassTransform = () => SetMetadata(BYPASS_TRANSFORM_KEY, true);
