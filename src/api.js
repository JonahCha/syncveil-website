/**
 * API Service - Frontend API communication
 * PRODUCTION: All authentication and dashboard data comes from real backend
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

class APIError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.status = status;
    this.details = details;
    this.name = 'APIError';
  }
}

// Auth API calls
export const authAPI = {
  /**
   * Sign up with real email and password
   * CRITICAL: Must verify email before first login
   */
  signup: async (email, password, fullName) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/signup`, {
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
        throw new APIError(
          response.status,
          data.detail || 'Signup failed',
          data
        );
      }

      // Store tokens securely (httpOnly cookies preferred, but using localStorage for demo)
      if (data.access_token) {
        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('refresh_token', data.refresh_token || '');
        localStorage.setItem('user_id', data.user?.id || '');
        localStorage.setItem('user_email', data.user?.email || '');
      }

      return {
        success: true,
        user: data.user,
        requiresVerification: !data.user?.email_verified,
        verificationToken: data.verification_token,
      };
    } catch (error) {
      if (error instanceof APIError) throw error;
      throw new APIError(500, 'Network error during signup', { original: error.message });
    }
  },

  /**
   * Login with real email and password
   * CRITICAL: User email must be verified first
   */
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
        // Specific error handling
        if (response.status === 401) {
          throw new APIError(401, 'Invalid email or password', data);
        }
        if (response.status === 403) {
          throw new APIError(403, 'Email not verified. Check your inbox for verification link.', data);
        }
        throw new APIError(response.status, data.detail || 'Login failed', data);
      }

      // Store tokens
      if (data.access_token) {
        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('refresh_token', data.refresh_token || '');
        localStorage.setItem('user_id', data.user?.id || '');
        localStorage.setItem('user_email', data.user?.email || '');
      }

      return {
        success: true,
        user: data.user,
        accessToken: data.access_token,
      };
    } catch (error) {
      if (error instanceof APIError) throw error;
      throw new APIError(500, 'Network error during login', { original: error.message });
    }
  },

  /**
   * Verify email with token sent to user
   */
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
          throw new APIError(400, 'Verification token expired. Request a new one.', data);
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

  /**
   * Logout - revoke session on backend
   */
  logout: async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        return { success: true };
      }

      // Optional: Call backend to revoke session
      // For now, just clear local storage
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user_id');
      localStorage.removeItem('user_email');

      return { success: true };
    } catch (error) {
      // Clear local storage even if backend call fails
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user_id');
      localStorage.removeItem('user_email');
      return { success: true };
    }
  },
};

// Dashboard API calls
export const dashboardAPI = {
  /**
   * Get user dashboard data
   */
  getDashboardData: async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        throw new APIError(401, 'Not authenticated');
      }

      const response = await fetch(`${API_BASE_URL}/api/dashboard`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
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

  /**
   * Upload file to vault
   */
  uploadFile: async (file, onProgress) => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        throw new APIError(401, 'Not authenticated');
      }

      const formData = new FormData();
      formData.append('file', file);

      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        // Track upload progress
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percentComplete = (e.loaded / e.total) * 100;
            onProgress?.(percentComplete);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const response = JSON.parse(xhr.responseText);
            resolve({
              success: true,
              file: response,
            });
          } else {
            const error = JSON.parse(xhr.responseText);
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

  /**
   * Get list of vault files
   */
  getVaultFiles: async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        throw new APIError(401, 'Not authenticated');
      }

      const response = await fetch(`${API_BASE_URL}/api/vault/files`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
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

  /**
   * Get breach monitor data
   */
  getBreachData: async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        throw new APIError(401, 'Not authenticated');
      }

      const response = await fetch(`${API_BASE_URL}/api/monitor/breaches`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
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
};

// Utility: Check if user is authenticated
export const isAuthenticated = () => {
  return !!localStorage.getItem('access_token');
};

// Utility: Get current user
export const getCurrentUser = () => {
  return {
    id: localStorage.getItem('user_id'),
    email: localStorage.getItem('user_email'),
  };
};

export { APIError };
