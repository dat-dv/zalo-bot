'use client';

import { useMutation } from '@tanstack/react-query';
import type {
  IDashboardAccessCodeRequest,
  IDashboardAccessTokenResponse,
} from '@zalobot/contracts';
import { signInWithAccessCode } from './access-code-api';

export function useAccessCodeSignInMutation() {
  return useMutation<IDashboardAccessTokenResponse, Error, IDashboardAccessCodeRequest>({
    mutationFn: (data) => signInWithAccessCode(data),
  });
}
