import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';
import Cookies from 'js-cookie';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApiResponse<T = unknown> {
  data: T;
  message?: string;
  success: boolean;
}

export interface ApiError {
  message: string;
  statusCode: number;
  errors?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// In the browser, use a relative URL so requests go through the Next.js rewrite
// proxy (same origin → no CORS). On the server (SSR), use the full backend URL.
const IS_BROWSER = typeof window !== 'undefined';
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const BASE_URL = IS_BROWSER ? '' : BACKEND_URL;
const TOKEN_COOKIE = 'cryptobet_token';
const REFRESH_COOKIE = 'cryptobet_refresh_token';

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------

const api: AxiosInstance = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ---------------------------------------------------------------------------
// Request interceptor – attach JWT
// ---------------------------------------------------------------------------

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Try cookie first, fall back to localStorage (SSR-safe)
    let token = Cookies.get(TOKEN_COOKIE);

    if (!token && typeof window !== 'undefined') {
      token = localStorage.getItem(TOKEN_COOKIE) ?? undefined;
    }

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error: AxiosError) => Promise.reject(error),
);

// ---------------------------------------------------------------------------
// Response interceptor – handle 401 & format errors
// ---------------------------------------------------------------------------

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError<ApiError>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // ------ 401 handling with token refresh ------
    if (error.response?.status === 401 && !originalRequest._retry) {
      // If we are already refreshing, queue the request
      if (isRefreshing) {
        return new Promise<AxiosResponse>((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${token}`;
              }
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = Cookies.get(REFRESH_COOKIE);

      if (refreshToken) {
        try {
          const { data } = await axios.post<ApiResponse<{ accessToken: string }>>(
            `${BASE_URL}/api/v1/auth/refresh`,
            { refreshToken },
          );

          const newToken = data.data.accessToken;

          Cookies.set(TOKEN_COOKIE, newToken, {
            secure: window.location.protocol === 'https:',
            sameSite: 'strict',
          });
          if (typeof window !== 'undefined') {
            localStorage.setItem(TOKEN_COOKIE, newToken);
          }

          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
          }

          processQueue(null, newToken);
          return api(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError, null);

          // Clear tokens and redirect to login
          Cookies.remove(TOKEN_COOKIE);
          Cookies.remove(REFRESH_COOKIE);
          if (typeof window !== 'undefined') {
            localStorage.removeItem(TOKEN_COOKIE);
            localStorage.removeItem(REFRESH_COOKIE);
            window.location.href = '/login';
          }

          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      } else {
        // No refresh token – clear everything and redirect
        Cookies.remove(TOKEN_COOKIE);
        if (typeof window !== 'undefined') {
          localStorage.removeItem(TOKEN_COOKIE);
          window.location.href = '/login';
        }
      }
    }

    // ------ Format the error ------
    const respData = error.response?.data as any;
    const apiError: ApiError = {
      message:
        respData?.error?.message ||
        respData?.message ||
        error.message ||
        'An unexpected error occurred',
      statusCode: error.response?.status || 500,
      errors: respData?.error?.details || respData?.errors,
    };

    return Promise.reject(apiError);
  },
);

// ---------------------------------------------------------------------------
// Typed helper functions
// ---------------------------------------------------------------------------

export async function get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const response = await api.get<ApiResponse<T>>(url, config);
  return response.data.data;
}

export async function post<T>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  const response = await api.post<ApiResponse<T>>(url, data, config);
  return response.data.data;
}

export async function put<T>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  const response = await api.put<ApiResponse<T>>(url, data, config);
  return response.data.data;
}

export async function del<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const response = await api.delete<ApiResponse<T>>(url, config);
  return response.data.data;
}

// ---------------------------------------------------------------------------
// Token helpers (used by auth store)
// ---------------------------------------------------------------------------

export function setTokens(accessToken: string, refreshToken?: string) {
  Cookies.set(TOKEN_COOKIE, accessToken, {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    expires: 1, // 1 day
  });
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_COOKIE, accessToken);
  }

  if (refreshToken) {
    Cookies.set(REFRESH_COOKIE, refreshToken, {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      expires: 30, // 30 days
    });
    if (typeof window !== 'undefined') {
      localStorage.setItem(REFRESH_COOKIE, refreshToken);
    }
  }
}

export function clearTokens() {
  Cookies.remove(TOKEN_COOKIE);
  Cookies.remove(REFRESH_COOKIE);
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_COOKIE);
    localStorage.removeItem(REFRESH_COOKIE);
  }
}

export function getAccessToken(): string | undefined {
  return Cookies.get(TOKEN_COOKIE);
}

export default api;
