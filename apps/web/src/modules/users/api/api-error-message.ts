import axios from 'axios';

/**
 * Lấy thông điệp lỗi từ response NestJS (`{ message: string | string[] }`), fallback về
 * thông điệp của axios/Error để admin thấy lý do thật (vd. chưa có chủ sổ).
 */
export function apiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data: unknown = error.response?.data;
    if (data && typeof data === 'object' && 'message' in data) {
      const { message } = data;
      if (typeof message === 'string' && message) return message;
      if (Array.isArray(message)) {
        const parts = message.filter((m): m is string => typeof m === 'string');
        if (parts.length > 0) return parts.join(', ');
      }
    }
    return error.message;
  }
  return error instanceof Error ? error.message : String(error);
}
