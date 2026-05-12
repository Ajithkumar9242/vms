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

// ─── Auth ─────────────────────────────────────────────
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  getMe: () => api.get('/auth/me'),
  changePassword: (data) => api.patch('/auth/change-password', data),
  // Parent OTP login
  sendOtp: (phone) => api.post('/auth/otp/send', { phone }),
  verifyOtp: (phone, otp) => api.post('/auth/otp/verify', { phone, otp }),
  // Faculty OTP login
  sendFacultyOtp: (phone) => api.post('/auth/faculty/otp/send', { phone }),
  verifyFacultyOtp: (phone, otp) => api.post('/auth/faculty/otp/verify', { phone, otp }),
  // Token management
  refresh: (refreshToken) => api.post('/auth/refresh', { refreshToken }),
  logout: () => api.post('/auth/logout'),
};

// ─── School ─────────────────────────────────────────────────
export const schoolAPI = {
  getClasses: (params) => api.get('/school/classes', { params }),
  getSections: (params) => api.get('/school/sections', { params }),
  getSubjects: (params) => api.get('/school/subjects', { params }),
};

// ─── Admissions ─────────────────────────────────────────
export const admissionAPI = {
  // Public
  getSettings: () => api.get('/admissions/settings'),
  getClasses: () => api.get('/admissions/classes'),
  getStatus: (appNo) => api.get(`/admissions/status/${appNo}`),
  searchByPhone: (phone) => api.get('/admissions/search', { params: { phone } }),
  submitPublic: (data) => api.post('/admissions/public', data),
  // Admin
  create: (data) => api.post('/admissions', data),
  getAll: (params) => api.get('/admissions', { params }),
  getById: (id) => api.get(`/admissions/${id}`),
  update: (id, data) => api.patch(`/admissions/${id}`, data),
  approve: (id, data) => api.patch(`/admissions/${id}/approve`, data),
  reject: (id, data) => api.patch(`/admissions/${id}/reject`, data),
  hold: (id, data) => api.patch(`/admissions/${id}/hold`, data),
  updateSettings: (data) => api.patch('/admissions/settings', data),
};

// ─── Students ───────────────────────────────────────────────
export const studentAPI = {
  getAll: (params) => api.get('/students', { params }),
  getById: (id) => api.get(`/students/${id}`),
  create: (data) => api.post('/students', data),
  update: (id, data) => api.patch(`/students/${id}`, data),
};

// ─── Fees ───────────────────────────────────────────────────
export const feesAPI = {
  // ── Overview ─────────────────────────────────────────────
  getOverview: (params) => api.get('/fees/overview', { params }),
  getInvoice: (studentId) => api.get(`/fees/invoice/${studentId}`),
  generateInvoice: (studentId) => api.post('/fees/invoice/generate', { studentId }),

  // ── Fee Components ──────────────────────────────────────
  getComponents: (params) => api.get('/fees/components', { params }),
  getComponent: (id) => api.get(`/fees/components/${id}`),
  createComponent: (data) => api.post('/fees/components', data),
  updateComponent: (id, data) => api.put(`/fees/components/${id}`, data),
  toggleComponent: (id) => api.patch(`/fees/components/${id}/toggle`),
  deleteComponent: (id) => api.delete(`/fees/components/${id}`),

  // ── Student Fee Profiles ────────────────────────────────
  getClassMatrix: (classId, params) => api.get(`/fees/profiles/class/${classId}`, { params }),
  bulkSaveProfiles: (data) => api.post('/fees/profiles/bulk-save', data),
  getStudentProfile: (studentId, params) => api.get(`/fees/profiles/student/${studentId}`, { params }),
  addDiscount: (studentId, data, params) => api.post(`/fees/profiles/student/${studentId}/discount`, data, { params }),
  lockProfile: (studentId, data) => api.post(`/fees/profiles/student/${studentId}/lock`, data),
  unlockProfile: (studentId, data) => api.post(`/fees/profiles/student/${studentId}/unlock`, data),
  getStudentFees: (studentId, params) => api.get(`/fees/invoice/${studentId}`, { params }),

  // ── Invoice (by ID) ─────────────────────────────────────
  getInvoiceById: (invoiceId) => api.get(`/fees/invoices/${invoiceId}`),
  payInstallment: (invoiceId, data) => api.post(`/fees/invoices/${invoiceId}/pay`, data),
  applyPenalty: (invoiceId, data) => api.post(`/fees/invoices/${invoiceId}/penalty`, data),
  waivePenalty: (invoiceId, data) => api.put(`/fees/invoices/${invoiceId}/penalty/waive`, data),
  lockInvoice: (invoiceId) => api.post(`/fees/invoices/${invoiceId}/lock`),
  unlockInvoice: (invoiceId) => api.post(`/fees/invoices/${invoiceId}/unlock`),
  regenerateSchedule: (invoiceId) => api.post(`/fees/invoices/${invoiceId}/regenerate-schedule`),
  getInvoicePdfUrl: (invoiceId) => `${API_BASE_URL}/fees/invoices/${invoiceId}/pdf`,
  getInvoicePdfUrlWithToken: (invoiceId) => {
    const token = localStorage.getItem('vms_token');
    return `${API_BASE_URL}/fees/invoices/${invoiceId}/pdf${token ? '?token=' + token : ''}`;
  },

  // ── Analytics ────────────────────────────────────────────
  getDashboardStats: (params) => api.get('/fees/analytics/dashboard', { params }),
  getMonthlyCollection: (year) => api.get('/fees/analytics/monthly', { params: { year } }),
  getClasswiseDues: (params) => api.get('/fees/analytics/classwise', { params }),
  getComponentSummary: (params) => api.get('/fees/analytics/components', { params }),
  getOverdueStudents: (params) => api.get('/fees/analytics/overdue', { params }),

  // ── PDF receipt ───────────────────────────────────────────
  getReceiptUrl: (paymentId) => `${API_BASE_URL}/fees/${paymentId}/receipt`,
};


// ─── Attendance ─────────────────────────────────────────────
export const attendanceAPI = {
  getSessions: () => api.get('/attendance/sessions'),
  mark: (data) => api.post('/attendance', data),
  lock: (data) => api.post('/attendance/lock', data),
  getByDate: (params) => api.get('/attendance', { params }),
  getReport: (params) => api.get('/attendance/report', { params }),
  getStudentReport: (studentId, params) => api.get(`/attendance/student/${studentId}`, { params }),
  // ─── Monthly ────────────────────────────────────────────
  upsertMonthly: (data) => api.post('/attendance/monthly/upsert', data),
  getMonthlyClassEntry: (classId, params) => api.get(`/attendance/monthly/class/${classId}`, { params }),
  getMonthlyClassReport: (classId) => api.get(`/attendance/monthly/report/class/${classId}`),
  getMonthlyStudentReport: (studentId) => api.get(`/attendance/monthly/report/student/${studentId}`),
};


// ─── Exams & Results ────────────────────────────────────────
export const examAPI = {
  // Exam CRUD
  create: (data) => api.post('/exams', data),
  getAll: (params) => api.get('/exams', { params }),
  getById: (id) => api.get(`/exams/${id}`),
  update: (id, data) => api.put(`/exams/${id}`, data),
  remove: (id) => api.delete(`/exams/${id}`),

  // Lifecycle
  publish: (id) => api.patch(`/exams/${id}/publish`),
  lock: (id) => api.patch(`/exams/${id}/lock`),

  // Marks
  saveMarks: (examId, data) => api.post(`/exams/${examId}/marks`, data),
  getMarks: (examId) => api.get(`/exams/${examId}/marks`),

  // Results
  getExamResults: (examId) => api.get(`/exams/${examId}/results`),
  getStudentResults: (studentId) => api.get(`/exams/results/${studentId}`),

  // Subjects helper
  getSubjectsForClass: (classId) => api.get('/exams/subjects-for-class', { params: { classId } }),
};

// ─── Faculty ────────────────────────────────────────────────
export const facultyAPI = {
  create: (data) => api.post('/faculty', data),
  getAll: (params) => api.get('/faculty', { params }),
  getById: (id) => api.get(`/faculty/${id}`),
  update: (id, data) => api.patch(`/faculty/${id}`, data),
  assignClasses: (id, classIds) => api.patch(`/faculty/${id}/assign-classes`, { classIds }),
  assignSubjects: (id, subjectIds) => api.patch(`/faculty/${id}/assign-subjects`, { subjectIds }),
};

// ─── Parents ────────────────────────────────────────────────
export const parentAPI = {
  create: (data) => api.post('/parents', data),
  getAll: (params) => api.get('/parents', { params }),
  getById: (id) => api.get(`/parents/${id}`),
  update: (id, data) => api.patch(`/parents/${id}`, data),
  linkStudent: (parentId, studentId) => api.patch(`/parents/${parentId}/link`, { studentId }),
  /** Self-service: parent updates their own profile (phone, email, address, occupation) */
  updateMyProfile: (data) => api.patch('/parents/profile/me', data),
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
  /** Upload a single file. folder: 'students'|'faculty'|'parents'|'materials'|'logo' */
  upload: (file, folder = '') => {
    const formData = new FormData();
    formData.append('file', file);
    const url = folder ? `/upload?folder=${folder}` : '/upload';
    return api.post(url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  /** Upload multiple files. Returns [{ url, publicId, name, type, size }] */
  uploadMultiple: (files, folder = '') => {
    const formData = new FormData();
    files.forEach((f) => formData.append('files', f));
    const url = folder ? `/upload/multiple?folder=${folder}` : '/upload/multiple';
    return api.post(url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
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

// ─── Subjects ────────────────────────────────────────────────
export const subjectAPI = {
  /** List subjects. params: { classId?, type?, isActive?, search?, page?, limit? } */
  getAll: (params) => api.get('/subjects', { params }),
  /** Create a subject. */
  create: (data) => api.post('/subjects', data),
  /** Update a subject by id. */
  update: (id, data) => api.put(`/subjects/${id}`, data),
  /** Soft-delete a subject (sets isActive = false). */
  remove: (id) => api.delete(`/subjects/${id}`),
  /** Toggle isActive for a subject. */
  toggle: (id) => api.patch(`/subjects/${id}/toggle`),
  /** Assign or remove subject from a ClassConfig. */
  assignToClassConfig: (id, data) => api.post(`/subjects/${id}/assign`, data),
};

// ─── Assignments ─────────────────────────────────────────────
export const assignmentAPI = {
  create: (data) => api.post('/assignments', data),
  getAll: (params) => api.get('/assignments', { params }),
  getById: (id) => api.get(`/assignments/${id}`),
  update: (id, data) => api.put(`/assignments/${id}`, data),
  remove: (id) => api.delete(`/assignments/${id}`),
  // Submissions
  submit: (id, data) => api.post(`/assignments/${id}/submit`, data),
  getSubmissions: (id, params) => api.get(`/assignments/${id}/submissions`, { params }),
  grade: (id, data) => api.put(`/assignments/${id}/grade`, data),
};

// ─── Study Materials ─────────────────────────────────────────
export const materialAPI = {
  create: (data) => api.post('/materials', data),
  getAll: (params) => api.get('/materials', { params }),
  getById: (id) => api.get(`/materials/${id}`),
  remove: (id) => api.delete(`/materials/${id}`),
  getByClass: (classId) => api.get(`/materials/class/${classId}`),
};

// ─── Faculty Dashboard ───────────────────────────────────────
export const facultyDashboardAPI = {
  getDashboard: () => api.get('/faculty/me/dashboard'),
  getClassStudents: (classId) => api.get(`/faculty/me/class/${classId}/students`),
  getClassAnalytics: (classId, examId) => api.get(`/faculty/me/class/${classId}/analytics/${examId}`),
  getMonthlyAttendance: (classId, params) => api.get(`/faculty/me/class/${classId}/monthly-attendance`, { params }),
  getStudentAttendance: (studentId, params) => api.get(`/attendance/student/${studentId}`, { params }),
};


// ─── Vault (Student Document Vault) ─────────────────────────
export const vaultAPI = {
  // Catalog
  getCatalog:        (params) => api.get('/vault/catalog', { params }),
  createCatalogItem: (data)   => api.post('/vault/catalog', data),
  updateCatalogItem: (id, data) => api.put(`/vault/catalog/${id}`, data),
  toggleCatalogItem: (id)     => api.patch(`/vault/catalog/${id}/toggle`),
  // Requests — Admin
  getRequests:       (params) => api.get('/vault/requests', { params }),
  approveRequest:    (id, data) => api.post(`/vault/requests/${id}/approve`, data),
  rejectRequest:     (id, data) => api.post(`/vault/requests/${id}/reject`, data),
  fulfillRequest:    (id, data) => api.patch(`/vault/requests/${id}/fulfill`, data),
  adminMarkPaid:     (id, data) => api.post(`/vault/requests/${id}/pay/admin-mark-paid`, data),
  // Files — Admin
  uploadFile:        (studentId, formData) => api.post(`/vault/students/${studentId}/files/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 }),
  getStudentFiles:   (studentId) => api.get(`/vault/students/${studentId}/files`),
  deleteFile:        (fileId)   => api.delete(`/vault/files/${fileId}`),
  // Requests — Parent
  createRequest:     (data)    => api.post('/vault/requests', data),
  getMyRequests:     (params)  => api.get('/vault/requests/my', { params }),
  createPaymentOrder:(id)      => api.post(`/vault/requests/${id}/pay/razorpay`),
  confirmPayment:    (id, data)=> api.post(`/vault/requests/${id}/pay/confirm`, data),
  // Files — Parent
  getMyFiles:        (params)  => api.get('/vault/files/my', { params }),
  // Download URL (with token for auth)
  getDownloadUrl:    (fileId)  => {
    const token = localStorage.getItem('vms_token');
    return `${API_BASE_URL}/vault/files/${fileId}/download${token ? '?token=' + token : ''}`;
  },
  // Receipt PDF
  getReceiptUrl:     (id)      => {
    const token = localStorage.getItem('vms_token');
    return `${API_BASE_URL}/vault/requests/${id}/receipt${token ? '?token=' + token : ''}`;
  },
};

// ─── POS (Counter Billing) ───────────────────────────────────
export const posAPI = {
  getCatalog:    (params) => api.get('/pos/catalog', { params }),
  createItem:    (data)   => api.post('/pos/catalog', data),
  updateItem:    (id, data) => api.put(`/pos/catalog/${id}`, data),
  toggleItem:    (id)     => api.patch(`/pos/catalog/${id}/toggle`),
  createInvoice: (data)   => api.post('/pos/invoices', data),
  getInvoices:   (params) => api.get('/pos/invoices', { params }),
  getInvoice:    (id)     => api.get(`/pos/invoices/${id}`),
  cancelInvoice: (id, data) => api.post(`/pos/invoices/${id}/cancel`, data),
  getPdfUrl:     (id)     => {
    const token = localStorage.getItem('vms_token');
    return `${API_BASE_URL}/pos/invoices/${id}/pdf${token ? '?token=' + token : ''}`;
  },
};

// ─── Invoice Registry ────────────────────────────────────────
export const invoiceRegistryAPI = {
  list:       (params) => api.get('/invoice-registry', { params }),
  getDetail:  (id, type) => api.get(`/invoice-registry/${id}`, { params: { type } }),
  cancel:     (id, type, data) => api.post(`/invoice-registry/${id}/cancel?type=${type}`, data),
  getAudit:   (id, type) => api.get(`/invoice-registry/${id}/audit`, { params: { type } }),
  getPdfUrl:  (id, type) => {
    const token = localStorage.getItem('vms_token');
    if (type === 'pos') return `${API_BASE_URL}/pos/invoices/${id}/pdf${token ? '?token=' + token : ''}`;
    if (type === 'fees') return `${API_BASE_URL}/fees/invoices/${id}/pdf${token ? '?token=' + token : ''}`;
    return `${API_BASE_URL}/vault/requests/${id}/receipt${token ? '?token=' + token : ''}`;
  },
};

export default api;
