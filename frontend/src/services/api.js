import axios from 'axios';
import { notification } from 'antd';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// ═══════════════════════════════════════════════════════════
//  REQUEST INTERCEPTOR — JWT + param sanitization
// ═══════════════════════════════════════════════════════════
api.interceptors.request.use(
  (config) => {
    // Attach JWT token
    const token = localStorage.getItem('vms_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Strip undefined, null, and empty-string query params
    if (config.params) {
      const cleaned = {};
      Object.entries(config.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          cleaned[key] = value;
        }
      });
      config.params = cleaned;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ═══════════════════════════════════════════════════════════
//  RESPONSE INTERCEPTOR — global error handling + retry
// ═══════════════════════════════════════════════════════════
api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const config = error.config;
    const status = error.response?.status;
    const message = error.response?.data?.message || 'Something went wrong';

    // ─── Retry once on 5xx (server errors) ──────────────────
    if (status >= 500 && !config._retried) {
      config._retried = true;
      try {
        const retryResponse = await api.request(config);
        return retryResponse; // Already unwrapped by this interceptor
      } catch {
        // Fall through to error handling below
      }
    }

    // ─── 401 — Auto logout ──────────────────────────────────
    if (status === 401) {
      if (!window.location.pathname.includes('/login')) {
        localStorage.removeItem('vms_token');
        localStorage.removeItem('vms_user');
        notification.error({
          message: 'Session Expired',
          description: 'Your session has expired. Redirecting to login...',
          duration: 3,
        });
        setTimeout(() => {
          window.location.href = '/login';
        }, 1500);
      }
      return Promise.reject(new Error(message));
    }

    // ─── 403 — Forbidden ────────────────────────────────────
    if (status === 403) {
      notification.warning({
        message: 'Access Denied',
        description: message,
        duration: 4,
      });
      return Promise.reject(new Error(message));
    }

    // ─── 429 — Rate limited ─────────────────────────────────
    if (status === 429) {
      notification.warning({
        message: 'Too Many Requests',
        description: 'Please wait a moment before trying again.',
        duration: 5,
      });
      return Promise.reject(new Error(message));
    }

    // ─── 500+ — Server error ────────────────────────────────
    if (status >= 500) {
      notification.error({
        message: 'Server Error',
        description: 'Something went wrong on the server. Please try again later.',
        duration: 5,
      });
      return Promise.reject(new Error('Server error. Please try again later.'));
    }

    // ─── Network / timeout error ────────────────────────────
    if (!error.response) {
      notification.error({
        message: 'Network Error',
        description: 'Unable to connect to the server. Check your internet connection.',
        duration: 5,
      });
      return Promise.reject(new Error('Network error. Please check your connection.'));
    }

    // ─── 400 / other client errors — no notification ────────
    // (let the calling component handle these with message.error)
    return Promise.reject(new Error(message));
  }
);

// ═══════════════════════════════════════════════════════════
//  API METHODS
// ═══════════════════════════════════════════════════════════

// ─── Auth ───────────────────────────────────────────────────
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  getMe: () => api.get('/auth/me'),
};

// ─── School ─────────────────────────────────────────────────
export const schoolAPI = {
  getClasses: (params) => api.get('/school/classes', { params }),
  getSections: (params) => api.get('/school/sections', { params }),
  getSubjects: (params) => api.get('/school/subjects', { params }),
};

// ─── Admissions ─────────────────────────────────────────────
export const admissionAPI = {
  create: (data) => api.post('/admissions', data),
  getAll: (params) => api.get('/admissions', { params }),
  getById: (id) => api.get(`/admissions/${id}`),
  approve: (id) => api.patch(`/admissions/${id}/approve`),
  reject: (id, data) => api.patch(`/admissions/${id}/reject`, data),
};

// ─── Students ───────────────────────────────────────────────
export const studentAPI = {
  getAll: (params) => api.get('/students', { params }),
  getById: (id) => api.get(`/students/${id}`),
  create: (data) => api.post('/students', data),
};

// ─── Fees ───────────────────────────────────────────────────
export const feesAPI = {
  createStructure: (data) => api.post('/fees/structure', data),
  getStructures: (params) => api.get('/fees/structure', { params }),
  pay: (data) => api.post('/fees/pay', data),
  getStudentFees: (studentId) => api.get(`/fees/student/${studentId}`),
  getOverview: (params) => api.get('/fees/overview', { params }),
  getInvoice: (studentId) => api.get(`/fees/invoice/${studentId}`),
  generateInvoice: (studentId) => api.post('/fees/invoice/generate', { studentId }),
  getDueList: (params) => api.get('/fees/due', { params }),
  applyStructure: (data) => api.post('/fees/apply-structure', data),
  manualPayment: (data) => api.post('/fees/manual-payment', data),
  approvePayment: (id) => api.put(`/fees/payment/${id}/approve`),
  rejectPayment: (id, reason) => api.put(`/fees/payment/${id}/reject`, { reason }),
  getPendingPayments: (params) => api.get('/fees/payments/pending', { params }),
};

// ─── Attendance ─────────────────────────────────────────────
export const attendanceAPI = {
  getSessions: () => api.get('/attendance/sessions'),
  mark: (data) => api.post('/attendance', data),
  lock: (data) => api.post('/attendance/lock', data),
  getByDate: (params) => api.get('/attendance', { params }),
  getReport: (params) => api.get('/attendance/report', { params }),
};

// ─── Exams & Results ────────────────────────────────────────
export const examAPI = {
  create: (data) => api.post('/exams', data),
  getAll: (params) => api.get('/exams', { params }),
  getById: (id) => api.get(`/exams/${id}`),
  saveMarks: (examId, data) => api.post(`/exams/${examId}/marks`, data),
  getMarks: (examId) => api.get(`/exams/${examId}/marks`),
  getStudentResults: (studentId) => api.get(`/exams/results/${studentId}`),
  getSubjectsForClass: (classId) => api.get('/exams/subjects-for-class', { params: { classId } }),
};

// ─── Faculty ────────────────────────────────────────────────
export const facultyAPI = {
  create: (data) => api.post('/faculty', data),
  getAll: (params) => api.get('/faculty', { params }),
  getById: (id) => api.get(`/faculty/${id}`),
  assignClasses: (id, classIds) => api.patch(`/faculty/${id}/assign-classes`, { classIds }),
  assignSubjects: (id, subjectIds) => api.patch(`/faculty/${id}/assign-subjects`, { subjectIds }),
};

// ─── Parents ────────────────────────────────────────────────
export const parentAPI = {
  create: (data) => api.post('/parents', data),
  getAll: (params) => api.get('/parents', { params }),
  getById: (id) => api.get(`/parents/${id}`),
  linkStudent: (parentId, studentId) => api.patch(`/parents/${parentId}/link`, { studentId }),
};

// ─── Notifications ──────────────────────────────────────────
export const notificationAPI = {
  getAll: (params) => api.get('/notifications', { params }),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
  broadcast: (data) => api.post('/notifications/broadcast', data),
};

// ─── Activity / Timeline ────────────────────────────────────
export const activityAPI = {
  getByStudent: (studentId, params) => api.get(`/activity/student/${studentId}`, { params }),
  getRecent: (params) => api.get('/activity/recent', { params }),
};

// ─── Communication ──────────────────────────────────────────
export const communicationAPI = {
  send: (data) => api.post('/communication', data),
  getAll: (params) => api.get('/communication', { params }),
  getById: (id) => api.get(`/communication/${id}`),
};

// ─── Search ─────────────────────────────────────────────────
export const searchAPI = {
  search: (q) => api.get('/search', { params: { q } }),
};

// ─── Upload ─────────────────────────────────────────────────
export const uploadAPI = {
  upload: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
// ─── Hostel ─────────────────────────────────────────────────
export const hostelAPI = {
  createRoom: (data) => api.post('/hostel/rooms', data),
  getRooms: (params) => api.get('/hostel/rooms', { params }),
  getRoomById: (id) => api.get(`/hostel/rooms/${id}`),
  assignStudent: (data) => api.post('/hostel/assign', data),
  removeStudent: (studentId) => api.delete(`/hostel/remove/${studentId}`),
  getOccupancy: () => api.get('/hostel/occupancy'),
};

// ─── Leave / Gate Pass ──────────────────────────────────────
export const leaveAPI = {
  create: (data) => api.post('/leave', data),
  getAll: (params) => api.get('/leave', { params }),
  approve: (id) => api.patch(`/leave/${id}/approve`),
  reject: (id, remarks) => api.patch(`/leave/${id}/reject`, { remarks }),
  markOut: (id) => api.patch(`/leave/${id}/mark-out`),
  markIn: (id) => api.patch(`/leave/${id}/mark-in`),
};

// ─── Health / Medical ───────────────────────────────────────
export const healthAPI = {
  create: (data) => api.post('/health', data),
  getAll: (params) => api.get('/health', { params }),
  getByStudent: (studentId) => api.get(`/health/student/${studentId}`),
};

// ─── Incidents / Discipline ─────────────────────────────────
export const incidentAPI = {
  create: (data) => api.post('/incidents', data),
  getAll: (params) => api.get('/incidents', { params }),
  updateAction: (id, actionTaken) => api.patch(`/incidents/${id}/action`, { actionTaken }),
  getByStudent: (studentId) => api.get(`/incidents/student/${studentId}`),
};

// ─── Staff Duty ─────────────────────────────────────────────
export const dutyAPI = {
  assign: (data) => api.post('/duty', data),
  getAll: (params) => api.get('/duty', { params }),
  getByDate: (date) => api.get('/duty/by-date', { params: { date } }),
};

// ─── Payment (Razorpay) ─────────────────────────────────────
export const paymentAPI = {
  createOrder: (data) => api.post('/payment/create-order', data),
  verify: (data) => api.post('/payment/verify', data),
};

// ─── Online Admission (public endpoints) ────────────────────
export const onlineAdmissionAPI = {
  getClasses: () => api.get('/admissions/classes'),
  checkStatus: (applicationNo) => api.get(`/admissions/status/${applicationNo}`),
  searchByPhone: (phone) => api.get('/admissions/search', { params: { phone } }),
};

// ─── Public Upload (no auth) ────────────────────────────────
export const publicUploadAPI = {
  upload: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/upload/public', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000,
    });
  },
};

// ─── Setup / Admin Foundation ────────────────────────────────
export const setupAPI = {
  // School Setting
  getSchoolSetting: () => api.get('/setup/school-setting'),
  saveSchoolSetting: (data) => api.put('/setup/school-setting', data),
  uploadLogo: (file) => {
    const fd = new FormData();
    fd.append('logo', file);
    return api.post('/setup/school-setting/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },

  // Academic Year
  getAcademicYears: () => api.get('/setup/academic-years'),
  getActiveYear: () => api.get('/setup/academic-years/active'),
  createAcademicYear: (data) => api.post('/setup/academic-years', data),
  updateAcademicYear: (id, data) => api.put(`/setup/academic-years/${id}`, data),

  // Academic Terms
  getTerms: (params) => api.get('/setup/terms', { params }),
  createTerm: (data) => api.post('/setup/terms', data),
  updateTerm: (id, data) => api.put(`/setup/terms/${id}`, data),
  deleteTerm: (id) => api.delete(`/setup/terms/${id}`),

  // Class Config
  getClassConfigs: (params) => api.get('/setup/class-configs', { params }),
  saveClassConfig: (data) => api.post('/setup/class-configs', data),

  // Class Groups
  getClassGroups: (params) => api.get('/setup/class-groups', { params }),
  createClassGroup: (data) => api.post('/setup/class-groups', data),
  updateClassGroup: (id, data) => api.put(`/setup/class-groups/${id}`, data),
  deleteClassGroup: (id) => api.delete(`/setup/class-groups/${id}`),

  // Fee Groups
  getFeeGroups: () => api.get('/setup/fee-groups'),
  createFeeGroup: (data) => api.post('/setup/fee-groups', data),
  updateFeeGroup: (id, data) => api.put(`/setup/fee-groups/${id}`, data),

  // Fee Structures (admin config)
  getFeeStructures: (params) => api.get('/setup/fee-structures', { params }),
  saveFeeStructure: (data) => api.post('/setup/fee-structures', data),

  // Grade Config
  getGradeConfigs: () => api.get('/setup/grades'),
  createGradeConfig: (data) => api.post('/setup/grades', data),
  updateGradeConfig: (id, data) => api.put(`/setup/grades/${id}`, data),
  deleteGradeConfig: (id) => api.delete(`/setup/grades/${id}`),

  // Attendance Config
  getAttendanceConfig: (params) => api.get('/setup/attendance-config', { params }),
  saveAttendanceConfig: (data) => api.put('/setup/attendance-config', data),

  // Payment Settings
  getPaymentSettings: () => api.get('/setup/payment-settings'),
  savePaymentSettings: (data) => api.put('/setup/payment-settings', data),
};

export default api;
