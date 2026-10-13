import sharp from 'sharp';
import type { ImageMetadataGetter, ImageMetadataGetterResponse } from 'zca-js';

/**
 * Creates an imageMetadataGetter callback using Sharp.
 * In zca-js v2.0+, imageMetadataGetter is required to obtain image dimensions
 * and file size when sending local image files.
 */
export function createSharpImageMetadataGetter(): ImageMetadataGetter {
  return async (filePath: string): Promise<ImageMetadataGetterResponse> => {
    try {
      const metadata = await sharp(filePath).metadata();
      if (!metadata.width || !metadata.height) {
        return null;
      }
      return {
        width: metadata.width,
        height: metadata.height,
        size: metadata.size ?? 0,
      };
    } catch {
      return null;
    }
  };
}
