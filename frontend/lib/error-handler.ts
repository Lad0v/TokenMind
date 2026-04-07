import axios, { AxiosError } from 'axios';
import * as types from '@/types/api';

export interface ApiErrorInfo {
  message: string;
  code?: string;
  statusCode?: number;
  details?: Record<string, any>;
}

export function parseApiError(error: unknown): ApiErrorInfo {
  // Axios error
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<types.ApiError>;

    if (axiosError.response?.data?.detail) {
      return {
        message: axiosError.response.data.detail,
        statusCode: axiosError.response.status,
      };
    }

    if (axiosError.response?.status === 422) {
      // Validation error
      const data = axiosError.response.data as any;
      return {
        message: 'Validation error',
        statusCode: 422,
        details: data.detail,
      };
    }

    const statusMessages: Record<number, string> = {
      400: 'Invalid request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not found',
      500: 'Server error',
    };

    return {
      message:
        statusMessages[axiosError.response?.status || 0] ||
        axiosError.message ||
        'An error occurred',
      statusCode: axiosError.response?.status,
    };
  }

  // Regular Error
  if (error instanceof Error) {
    return {
      message: error.message,
    };
  }

  // Unknown error
  return {
    message: 'An unexpected error occurred',
  };
}

export function isApiError(error: unknown): error is AxiosError<types.ApiError> {
  return axios.isAxiosError(error);
}

export function isValidationError(error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    return error.response?.status === 422;
  }
  return false;
}

export function isUnauthorizedError(error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    return error.response?.status === 401;
  }
  return false;
}

export function isForbiddenError(error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    return error.response?.status === 403;
  }
  return false;
}

export function isNotFoundError(error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    return error.response?.status === 404;
  }
  return false;
}

// User-friendly error messages
export function getUserFriendlyErrorMessage(error: unknown): string {
  const errorInfo = parseApiError(error);

  // Map common API error messages to user-friendly versions
  const errorMap: Record<string, string> = {
    'Wallet not found': 'Wallet not found. Please register first.',
    'OTP expired': 'OTP code has expired. Please request a new one.',
    'OTP blocked': 'Too many failed attempts. Please try again later.',
    'Invalid OTP': 'Invalid OTP code.',
    'Unauthorized': 'Your session has expired. Please login again.',
    'Forbidden': 'You do not have permission to perform this action.',
    'Not found': 'The requested resource was not found.',
    'Validation error': 'Please check your input and try again.',
  };

  for (const [key, value] of Object.entries(errorMap)) {
    if (errorInfo.message.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }

  return errorInfo.message || 'An unexpected error occurred. Please try again.';
}

export function logError(
  context: string,
  error: unknown,
  additionalInfo?: Record<string, any>
): void {
  const errorInfo = parseApiError(error);

  console.error(`[${context}]`, {
    message: errorInfo.message,
    statusCode: errorInfo.statusCode,
    details: errorInfo.details,
    ...additionalInfo,
  });

  // Could send to error tracking service here (e.g., Sentry)
}
