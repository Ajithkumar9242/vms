import { create } from 'zustand';
import { authAPI } from '@/services/api';

const useAuthStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem('vms_user')) || null,
  token: localStorage.getItem('vms_token') || null,
  isAuthenticated: !!localStorage.getItem('vms_token'),
  loading: false,

  setAuth: (user, token) => {
    localStorage.setItem('vms_user', JSON.stringify(user));
    localStorage.setItem('vms_token', token);
    set({ user, token, isAuthenticated: true });
  },

  login: async (email, password) => {
    set({ loading: true });
    try {
      const res = await authAPI.login({ email, password });
      const { user, token } = res.data;
      get().setAuth(user, token);
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    } finally {
      set({ loading: false });
    }
  },

  loginWithOtp: async (phone, otp) => {
    set({ loading: true });
    try {
      const res = await authAPI.verifyOtpGeneral(phone, otp);
      const data = res.data || res;
      const { user, token, refreshToken } = data;
      get().setAuth(user, token);
      if (refreshToken) {
        localStorage.setItem('vms_refresh_token', refreshToken);
      }
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    } finally {
      set({ loading: false });
    }
  },

  fetchMe: async () => {
    try {
      const res = await authAPI.getMe();
      const user = res.data.user;
      localStorage.setItem('vms_user', JSON.stringify(user));
      set({ user });
      return user;
    } catch {
      get().logout();
      return null;
    }
  },

  logout: () => {
    localStorage.removeItem('vms_user');
    localStorage.removeItem('vms_token');
    set({ user: null, token: null, isAuthenticated: false });
  },

  updateUser: (user) => {
    localStorage.setItem('vms_user', JSON.stringify(user));
    set({ user });
  },
}));

export default useAuthStore;
