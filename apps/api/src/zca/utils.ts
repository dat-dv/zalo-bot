import { createSharpImageMetadataGetter } from './zca-metadata.util';

/**
 * Pre-configured imageMetadataGetter using Sharp.
 * Used in Zalo constructor: new Zalo({ imageMetadataGetter })
 */
export const imageMetadataGetter = createSharpImageMetadataGetter();
export * from './zca-metadata.util';
