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
        throw new APIError(response.status, data.detail || 'Signup failed', data);
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
      throw new APIError(500, 'Network error during signup');
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
          throw new APIError(403, 'Email not verified. Check your inbox for verification code.', data);
        }
        if (response.status === 429) {
          const detailMessage = typeof data.detail === 'object' ? data.detail.message : data.detail;
          throw new APIError(429, detailMessage || 'Too many login attempts. Try again shortly.', data);
        }
        throw new APIError(response.status, data.detail || 'Login failed', data);
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
      throw new APIError(500, 'Network error during login', { original: error.message });
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
        throw new APIError(response.status, data.detail || 'Challenge verification failed', data);
      }

      storeAuthData(data);
      return {
        success: true,
        user: data.user,
      };
    } catch (error) {
      if (error instanceof APIError) throw error;
      throw new APIError(500, 'Network error during challenge verification', { original: error.message });
    }
  },

  verifyEmail: async (token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify?token=${encodeURIComponent(token)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      if (!response.ok) {
        if (response.status === 400) {
          throw new APIError(400, 'Verification token expired or invalid. Request a new one.', data);
        }
        throw new APIError(response.status, data.detail || 'Verification failed', data);
      }

      return {
        success: true,
        user: data,
      };
    } catch (error) {
      if (error instanceof APIError) throw error;
      throw new APIError(500, 'Network error during verification', { original: error.message });
    }
  },

  resendVerification: async (email) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/resend-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new APIError(response.status, data.detail || 'Failed to resend verification code', data);
      }

      return data;
    } catch (error) {
      if (error instanceof APIError) throw error;
      throw new APIError(500, 'Network error during verification resend', { original: error.message });
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
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      const data = await response.json();
      if (!response.ok) {
        clearAuthStorage();
        throw new APIError(response.status, data.detail || 'Session refresh failed', data);
      }

      storeAuthData(data);
      return { success: true, user: data.user };
    } catch (error) {
      if (error instanceof APIError) throw error;
      throw new APIError(500, 'Network error during token refresh', { original: error.message });
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
      // Ignore backend logout failures; local cleanup still runs.
    } finally {
      clearAuthStorage();
    }

    return { success: true };
  },
};

// Dashboard API calls
export const dashboardAPI = {
  getDashboardData: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/dashboard`, {
        method: 'GET',
        headers: authHeaders(),
      });

      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401) {
          clearAuthStorage();
          throw new APIError(401, 'Session expired. Please log in again.');
        }
        throw new APIError(response.status, data.detail || 'Failed to load dashboard', data);
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      if (error instanceof APIError) throw error;
      throw new APIError(500, 'Network error loading dashboard', { original: error.message });
    }
  },

  uploadFile: async (file, onProgress) => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        throw new APIError(401, 'Not authenticated');
      }

      const formData = new FormData();
      formData.append('file', file);

      return await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percentComplete = (e.loaded / e.total) * 100;
            onProgress?.(percentComplete);
          }
        });

        xhr.addEventListener('load', () => {
          const parseBody = () => {
            if (!xhr.responseText) return {};
            try {
              return JSON.parse(xhr.responseText);
            } catch {
              return {};
            }
          };

          if (xhr.status >= 200 && xhr.status < 300) {
            const response = parseBody();
            resolve({
              success: true,
              file: response.file || response,
            });
          } else {
            const error = parseBody();
            reject(new APIError(xhr.status, error.detail || 'Upload failed', error));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new APIError(500, 'Network error during upload'));
        });

        xhr.open('POST', `${API_BASE_URL}/api/vault/upload`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(formData);
      });
    } catch (error) {
      if (error instanceof APIError) throw error;
      throw new APIError(500, 'Failed to upload file', { original: error.message });
    }
  },

  getVaultFiles: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/vault/files`, {
        method: 'GET',
        headers: authHeaders(),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new APIError(response.status, data.detail || 'Failed to load files', data);
      }

      return {
        success: true,
        files: data,
      };
    } catch (error) {
      if (error instanceof APIError) throw error;
      throw new APIError(500, 'Network error loading files', { original: error.message });
    }
  },

  getBreachData: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/monitor/breaches`, {
        method: 'GET',
        headers: authHeaders(),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new APIError(response.status, data.detail || 'Failed to load breach data', data);
      }

      return {
        success: true,
        breaches: data,
      };
    } catch (error) {
      if (error instanceof APIError) throw error;
      throw new APIError(500, 'Network error loading breach data', { original: error.message });
    }
  },

  getSecurityOverview: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/security/overview`, {
        method: 'GET',
        headers: authHeaders(),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new APIError(response.status, data.detail || 'Failed to load security overview', data);
      }

      return { success: true, data };
    } catch (error) {
      if (error instanceof APIError) throw error;
      throw new APIError(500, 'Network error loading security overview', { original: error.message });
    }
  },

  getSecurityEvents: async (limit = 20) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/security/events?limit=${encodeURIComponent(limit)}`, {
        method: 'GET',
        headers: authHeaders(),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new APIError(response.status, data.detail || 'Failed to load security events', data);
      }

      return { success: true, data };
    } catch (error) {
      if (error instanceof APIError) throw error;
      throw new APIError(500, 'Network error loading security events', { original: error.message });
    }
  },
};

export const publicAPI = {
  getSecuritySnapshot: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/public/security-snapshot`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new APIError(response.status, data.detail || 'Failed to load public security snapshot', data);
      }

      return { success: true, data };
    } catch (error) {
      if (error instanceof APIError) throw error;
      throw new APIError(500, 'Network error loading public security snapshot', { original: error.message });
    }
  },
};

export const isAuthenticated = () => Boolean(localStorage.getItem('access_token'));

export const getCurrentUser = () => ({
  id: localStorage.getItem('user_id'),
  email: localStorage.getItem('user_email'),
});

export { APIError };
