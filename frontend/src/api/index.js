/**
 * API Service - Frontend API communication
 * Production auth and dashboard flows are fully backend-driven.
 */

import { API_BASE_URL } from './config';

class APIError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.status = status;
    this.details = details;
    this.name = 'APIError';
  }
}

const clearAuthStorage = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user_id');
  localStorage.removeItem('user_email');
};

const storeAuthData = (data) => {
  if (!data?.access_token) {
    return;
  }

  localStorage.setItem('access_token', data.access_token);
  localStorage.setItem('refresh_token', data.refresh_token || '');
  localStorage.setItem('user_id', data.user?.id || '');
  localStorage.setItem('user_email', data.user?.email || '');
};

const authHeaders = () => {
  const token = localStorage.getItem('access_token');

  if (!token) {
    throw new APIError(401, 'Not authenticated');
  }

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
};

/**
 * FIXED ERROR HANDLER
 * Prevents [object Object] errors
 */
const getErrorMessage = (data, fallback = 'Request failed') => {
  if (!data) return fallback;

  if (typeof data.detail === 'string') {
    return data.detail;
  }

  if (typeof data.detail === 'object' && data.detail !== null) {
    return (
      data.detail.message ||
      data.detail.error ||
      JSON.stringify(data.detail)
    );
  }

  if (typeof data.message === 'string') {
    return data.message;
  }

  return fallback;
};

// Auth API calls
export const authAPI = {
  signup: async (email, password) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new APIError(
          response.status,
          getErrorMessage(data, 'Signup failed'),
          data
        );
      }

      storeAuthData(data);

      return {
        success: true,
        user: data.user,
        requiresVerification: !data.user?.email_verified,
        verificationToken: data.verification_token,
      };
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new APIError(504, 'Backend timeout (cold start on Render)');
      }

      if (error instanceof APIError) throw error;

      throw new APIError(
        500,
        error.message || 'Network error during signup',
        error
      );
    } finally {
      clearTimeout(timeout);
    }
  },

  login: async (email, password) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          throw new APIError(401, 'Invalid email or password', data);
        }

        if (response.status === 403) {
          throw new APIError(
            403,
            'Email not verified. Check your inbox for verification code.',
            data
          );
        }

        if (response.status === 429) {
          throw new APIError(
            429,
            getErrorMessage(
              data,
              'Too many login attempts. Try again shortly.'
            ),
            data
          );
        }

        throw new APIError(
          response.status,
          getErrorMessage(data, 'Login failed'),
          data
        );
      }

      if (data.challenge_required) {
        return {
          success: false,
          challengeRequired: true,
          email: data.email,
          challengeToken: data.challenge_token || null,
          risk: data.risk || null,
          message: data.message || 'Additional verification required.',
        };
      }

      storeAuthData(data);

      return {
        success: true,
        challengeRequired: false,
        user: data.user,
        accessToken: data.access_token,
      };
    } catch (error) {
      if (error instanceof APIError) throw error;

      throw new APIError(
        500,
        error.message || 'Network error during login',
        error
      );
    }
  },

  verifyLoginChallenge: async (email, code) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login/challenge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          code: code.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new APIError(
          response.status,
          getErrorMessage(data, 'Challenge verification failed'),
          data
        );
      }

      storeAuthData(data);

      return {
        success: true,
        user: data.user,
      };
    } catch (error) {
      if (error instanceof APIError) throw error;

      throw new APIError(
        500,
        error.message || 'Network error during challenge verification',
        error
      );
    }
  },

  verifyEmail: async (token) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/auth/verify?token=${encodeURIComponent(token)}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 400) {
          throw new APIError(
            400,
            'Verification token expired or invalid. Request a new one.',
            data
          );
        }

        throw new APIError(
          response.status,
          getErrorMessage(data, 'Verification failed'),
          data
        );
      }

      return {
        success: true,
        user: data,
      };
    } catch (error) {
      if (error instanceof APIError) throw error;

      throw new APIError(
        500,
        error.message || 'Network error during verification',
        error
      );
    }
  },

  resendVerification: async (email) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/auth/resend-verification`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: email.toLowerCase().trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new APIError(
          response.status,
          getErrorMessage(data, 'Failed to resend verification code'),
          data
        );
      }

      return data;
    } catch (error) {
      if (error instanceof APIError) throw error;

      throw new APIError(
        500,
        error.message || 'Network error during verification resend',
        error
      );
    }
  },

  refresh: async () => {
    try {
      const refreshToken = localStorage.getItem('refresh_token');

      if (!refreshToken) {
        throw new APIError(401, 'No refresh token available');
      }

      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: refreshToken,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        clearAuthStorage();

        throw new APIError(
          response.status,
          getErrorMessage(data, 'Session refresh failed'),
          data
        );
      }

      storeAuthData(data);

      return {
        success: true,
        user: data.user,
      };
    } catch (error) {
      if (error instanceof APIError) throw error;

      throw new APIError(
        500,
        error.message || 'Network error during token refresh',
        error
      );
    }
  },

  logout: async (allDevices = false) => {
    const refreshToken = localStorage.getItem('refresh_token');

    try {
      if (refreshToken) {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            refresh_token: refreshToken,
            all_devices: allDevices,
          }),
        });
      }
    } catch {
      // ignore backend logout failures
    } finally {
      clearAuthStorage();
    }

    return {
      success: true,
    };
  },
};

export { APIError };