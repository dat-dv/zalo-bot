'use client';

import { getThreadDriveOpenUrl } from '../api/zca-api';
import { useGoogleDriveFolderLinkQuery } from '../api/zca-query';
import { GoogleStorageAccountPanel } from '../presentation/components/google-storage-account-panel';
import { GoogleStorageHowItWorks } from '../presentation/components/google-storage-how-it-works';

/** `/google-storage`: the shared Google account that stores every channel's media. */
export function GoogleStorageScreen() {
  const { data: driveRootData } = useGoogleDriveFolderLinkQuery();

  return (
    <div className="flex w-full max-w-3xl flex-col gap-3 p-1">
      <GoogleStorageAccountPanel driveUrl={driveRootData?.webViewLink || getThreadDriveOpenUrl()} />
      <GoogleStorageHowItWorks />
    </div>
  );
}
