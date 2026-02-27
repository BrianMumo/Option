import { create } from 'zustand';
import { api, setTokens, clearTokens, loadTokens, getAccessToken } from '@/lib/api';
import type { UserPublic } from '@stakeoption/shared';

type AccountMode = 'demo' | 'real';

interface AuthState {
  user: UserPublic | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  accountMode: AccountMode;

  register: (phone: string, password: string, firstName?: string, lastName?: string, email?: string) => Promise<{ user_id: string }>;
  verifyOtp: (phone: string, code: string, purpose: string) => Promise<void>;
  sendOtp: (phone: string, purpose: string) => Promise<void>;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  setAccountMode: (mode: AccountMode) => void;
  updateDemoBalance: (balance: number) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  accountMode: 'demo',

  register: async (phone, password, firstName, lastName, email) => {
    const res = await api<{ user_id: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        phone,
        password,
        first_name: firstName,
        last_name: lastName,
        email: email || undefined,
      }),
    });
    if (!res.success) throw new Error(res.error?.message || 'Registration failed');
    return res.data!;
  },

  verifyOtp: async (phone, code, purpose) => {
    const res = await api<{ access_token: string; refresh_token: string; user: UserPublic }>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, code, purpose }),
    });
    if (!res.success) throw new Error(res.error?.message || 'OTP verification failed');
    if (res.data?.access_token) {
      setTokens(res.data.access_token, res.data.refresh_token);
      set({ user: res.data.user, isAuthenticated: true });
    }
  },

  sendOtp: async (phone, purpose) => {
    const res = await api('/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, purpose }),
    });
    if (!res.success) throw new Error(res.error?.message || 'Failed to send OTP');
  },

  login: async (phone, password) => {
    const res = await api<{ access_token: string; refresh_token: string; user: UserPublic }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone, password }),
    });
    if (!res.success) throw new Error(res.error?.message || 'Login failed');
    setTokens(res.data!.access_token, res.data!.refresh_token);
    set({ user: res.data!.user, isAuthenticated: true });
  },

  logout: async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    clearTokens();
    set({ user: null, isAuthenticated: false, accountMode: 'demo' });
  },

  setAccountMode: (mode) => {
    set({ accountMode: mode });
  },

  updateDemoBalance: (balance) => {
    const user = get().user;
    if (user) {
      set({ user: { ...user, demo_balance: balance } });
    }
  },

  loadUser: async () => {
    loadTokens();
    if (!getAccessToken()) {
      set({ isLoading: false });
      return;
    }
    try {
      const res = await api<UserPublic>('/auth/me');
      if (res.success && res.data) {
        set({ user: res.data, isAuthenticated: true, isLoading: false });
      } else {
        clearTokens();
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },
}));
