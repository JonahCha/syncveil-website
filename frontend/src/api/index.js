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
  if (!data?.access_token) return;
  localStorage.setItem('access_token', data.access_token);
  localStorage.setItem('refresh_token', data.refresh_token || '');
  localStorage.setItem('user_id', data.user?.id || '');
  localStorage.setItem('user_email', data.user?.email || '');
};

const getErrorMessage = (data, fallback = 'Request failed') => {
  if (!data) return fallback;
  if (typeof data.detail === 'string') return data.detail;
  if (typeof data.detail === 'object' && data.detail !== null)
    return data.detail.message || data.detail.error || JSON.stringify(data.detail);
  if (typeof data.message === 'string') return data.message;
  return fallback;
};

const authHeaders = () => {
  const token = localStorage.getItem('access_token');
  if (!token) throw new APIError(401, 'Not authenticated');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
};

const req = async (method, path, body, headers) => {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: headers || authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new APIError(res.status, getErrorMessage(data, `${method} ${path} failed`), data);
  return data;
};

// ─── Auth helpers ─────────────────────────────────────────────────────────────

export const isAuthenticated = () => !!localStorage.getItem('access_token');

export const getCurrentUser = () => {
  const id = localStorage.getItem('user_id');
  const email = localStorage.getItem('user_email');
  if (!id && !email) return null;
  return { id, email };
};

// ─── Auth API ─────────────────────────────────────────────────────────────────

export const authAPI = {
  signup: async (email, password, full_name, phone, country, date_of_birth) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ email: email.toLowerCase().trim(), password, full_name, phone, country, date_of_birth }),
      });
      const data = await res.json();
      if (!res.ok) throw new APIError(res.status, getErrorMessage(data, 'Signup failed'), data);
      storeAuthData(data);
      return { success: true, user: data.user, requiresVerification: !data.user?.email_verified, verificationToken: data.verification_token };
    } catch (err) {
      if (err.name === 'AbortError') throw new APIError(504, 'Request timed out (backend cold start — try again)');
      if (err instanceof APIError) throw err;
      throw new APIError(500, err.message || 'Network error during signup', err);
    } finally {
      clearTimeout(timeout);
    }
  },

  login: async (email, password) => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) throw new APIError(401, 'Invalid email or password', data);
        if (res.status === 403) throw new APIError(403, 'Email not verified. Check your inbox.', data);
        if (res.status === 429) throw new APIError(429, getErrorMessage(data, 'Too many attempts. Try again shortly.'), data);
        throw new APIError(res.status, getErrorMessage(data, 'Login failed'), data);
      }
      if (data.challenge_required) return { success: false, challengeRequired: true, email: data.email, challengeToken: data.challenge_token, risk: data.risk, message: data.message };
      storeAuthData(data);
      return { success: true, challengeRequired: false, user: data.user, accessToken: data.access_token };
    } catch (err) {
      if (err instanceof APIError) throw err;
      throw new APIError(500, err.message || 'Network error during login', err);
    }
  },

  verifyLoginChallenge: async (email, code) => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login/challenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim(), code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new APIError(res.status, getErrorMessage(data, 'Challenge verification failed'), data);
      storeAuthData(data);
      return { success: true, user: data.user };
    } catch (err) {
      if (err instanceof APIError) throw err;
      throw new APIError(500, err.message || 'Network error', err);
    }
  },

  verifyEmail: async (token) => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/verify?token=${encodeURIComponent(token)}`, { method: 'GET' });
      const data = await res.json();
      if (!res.ok) throw new APIError(res.status, getErrorMessage(data, 'Verification failed'), data);
      return { success: true, user: data };
    } catch (err) {
      if (err instanceof APIError) throw err;
      throw new APIError(500, err.message || 'Network error', err);
    }
  },

  resendVerification: async (email) => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new APIError(res.status, getErrorMessage(data, 'Failed to resend'), data);
      return data;
    } catch (err) {
      if (err instanceof APIError) throw err;
      throw new APIError(500, err.message || 'Network error', err);
    }
  },

  refresh: async () => {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) throw new APIError(401, 'No refresh token');
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      const data = await res.json();
      if (!res.ok) { clearAuthStorage(); throw new APIError(res.status, getErrorMessage(data, 'Session refresh failed'), data); }
      storeAuthData(data);
      return { success: true, user: data.user };
    } catch (err) {
      if (err instanceof APIError) throw err;
      throw new APIError(500, err.message || 'Network error', err);
    }
  },

  logout: async (allDevices = false) => {
    const refreshToken = localStorage.getItem('refresh_token');
    try {
      if (refreshToken) {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken, all_devices: allDevices }),
        });
      }
    } catch { /* ignore */ } finally {
      clearAuthStorage();
    }
    return { success: true };
  },
};

// ─── Dashboard API ────────────────────────────────────────────────────────────

export const dashboardAPI = {
  getDashboardData: () => req('GET', '/api/dashboard'),
  getVaultFiles: () => req('GET', '/api/vault/files'),
  getSecurityOverview: () => req('GET', '/api/security/overview'),
  getSecurityEvents: (limit = 20) => req('GET', `/api/security/events?limit=${limit}`),
  getBreachData: () => req('GET', '/api/monitor/breaches'),
  getEmailSecurity: () => req('GET', '/api/email-security'),
  getConnectedAccounts: () => req('GET', '/api/connected-accounts'),
  getProfile: () => req('GET', '/api/profile'),

  updateProfile: (payload) => req('PATCH', '/api/profile', payload),

  disconnectAccount: (provider) => req('DELETE', `/api/connected-accounts/${provider}`, undefined),

  getGoogleOAuthUrl: () => req('GET', '/api/auth/google'),

  uploadFile: async (file, onProgress) => {
    const token = localStorage.getItem('access_token');
    if (!token) throw new APIError(401, 'Not authenticated');
    const formData = new FormData();
    formData.append('file', file);
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && typeof onProgress === 'function')
          onProgress(Math.round((e.loaded / e.total) * 100));
      });
      xhr.addEventListener('load', () => {
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) resolve(data);
          else reject(new APIError(xhr.status, getErrorMessage(data, 'Upload failed'), data));
        } catch { reject(new APIError(500, 'Failed to parse upload response')); }
      });
      xhr.addEventListener('error', () => reject(new APIError(500, 'Network error during upload')));
      xhr.open('POST', `${API_BASE_URL}/api/vault/upload`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.send(formData);
    });
  },
};

// ─── Public API ───────────────────────────────────────────────────────────────

export const publicAPI = {
  getSecuritySnapshot: async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/public/security-snapshot`, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
      const data = await res.json();
      if (!res.ok) throw new APIError(res.status, getErrorMessage(data, 'Failed to load snapshot'), data);
      return { data };
    } catch (err) {
      if (err instanceof APIError) throw err;
      throw new APIError(500, err.message || 'Network error', err);
    }
  },
};

export { APIError };
