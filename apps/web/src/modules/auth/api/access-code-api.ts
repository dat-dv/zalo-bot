import axios from 'axios';
import {
  API_ROUTES,
  type IApiResponse,
  type IDashboardAccessCodeRequest,
  type IDashboardAccessTokenResponse,
} from '@zalobot/contracts';
import { httpClient } from '@/shared/api/http-client';

export async function signInWithAccessCode(
  data: IDashboardAccessCodeRequest,
): Promise<IDashboardAccessTokenResponse> {
  const response = await httpClient.post<IApiResponse<IDashboardAccessTokenResponse>>(
    API_ROUTES.accessCode,
    data,
  );
  return response.data.data;
}

export type AccessCodeErrorKind = 'rejected' | 'tooManyAttempts' | 'failed';

/** Maps a failed sign-in request to the message the form shows. */
export function getAccessCodeErrorKind(error: unknown): AccessCodeErrorKind {
  if (!axios.isAxiosError(error)) return 'failed';
  if (error.response?.status === 401) return 'rejected';
  if (error.response?.status === 429) return 'tooManyAttempts';
  return 'failed';
}
