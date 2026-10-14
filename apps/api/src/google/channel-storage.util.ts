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
  category?: 'bill' | 'image' | 'video',
): string {
  const channelFolder = buildChannelFolder(channelId);
  if (!category) {
    return `${GG_DRIVE_ROOT_FOLDER}/${channelFolder}`;
  }
  return `${GG_DRIVE_ROOT_FOLDER}/${channelFolder}/${category}`;
}
