import { GG_DRIVE_ROOT_FOLDER } from './google-drive.service';

export function sanitizeChannelId(val: string): string {
  return (val || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function buildChannelFolder(channelId: string): string {
  const safeId = sanitizeChannelId(channelId);
  return safeId || 'default_channel';
}

export function getChannelDriveFolderPath(
  channelId: string,
  category?: 'bill' | 'image' | 'video' | 'file' | 'audio',
): string {
  const channelFolder = buildChannelFolder(channelId);
  if (!category) {
    return `${GG_DRIVE_ROOT_FOLDER}/${channelFolder}`;
  }
  return `${GG_DRIVE_ROOT_FOLDER}/${channelFolder}/${category}`;
}

function normalizeDrivePath(path: string): string {
  return path
    .trim()
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join('/');
}

/**
 * The one Drive folder a channel's links point to. Uploads go into sub-folders of it
 * (`<root>/<category>/<YYYY-MM>` or `<customFolder>/<YYYY-MM>`), so a stored link must
 * always be this root — never the sub-folder of whichever file was uploaded last.
 */
export function resolveChannelDriveRoot(channelId: string, customFolder?: string | null): string {
  const custom = customFolder ? normalizeDrivePath(customFolder) : '';
  return custom || getChannelDriveFolderPath(channelId);
}

export function isSameDrivePath(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  return normalizeDrivePath(a) === normalizeDrivePath(b);
}

/** Album title shared by uploads and the "open album" link, so both target the same album. */
export function resolveChannelPhotosAlbumTitle(
  channelId: string,
  options: {
    photosAlbum?: string | null;
    photosAlbumTitle?: string | null;
    threadName?: string | null;
  },
): string {
  const override = options.photosAlbum?.trim();
  if (override) return override;
  const stored = options.photosAlbumTitle?.trim();
  if (stored) return stored;
  const threadName = options.threadName?.trim();
  return threadName ? `[Zalo] ${threadName}` : `[Zalo] Nhóm ${channelId}`;
}
