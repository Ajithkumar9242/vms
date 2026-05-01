import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute, { RoleRoute } from '@/components/common/ProtectedRoute';
import MainLayout from '@/components/layout/MainLayout';
import Loader from '@/components/common/Loader';

// ─── Lazy-loaded pages ──────────────────────────────────────
const LoginPage = React.lazy(() => import('@/pages/auth/Login'));
const DashboardPage = React.lazy(() => import('@/pages/dashboard/Dashboard'));
const StudentsPage = React.lazy(() => import('@/pages/students/Students'));
const AdmissionsPage = React.lazy(() => import('@/pages/admissions/Admissions'));
const FeesPage = React.lazy(() => import('@/pages/fees/Fees'));
const AttendancePage = React.lazy(() => import('@/pages/attendance/Attendance'));
const ExamsPage = React.lazy(() => import('@/pages/exams/Exams'));
const FacultyPage = React.lazy(() => import('@/pages/faculty/Faculty'));
const ParentsPage = React.lazy(() => import('@/pages/parents/Parents'));
const CommunicationPage = React.lazy(() => import('@/pages/communication/Communication'));
const ActivityLogsPage = React.lazy(() => import('@/pages/activity/ActivityLogs'));

// ─── School Operations Modules ─────────────────────────────
const HostelPage = React.lazy(() => import('@/pages/hostel/Hostel'));
const LeaveRequestsPage = React.lazy(() => import('@/pages/leave/LeaveRequests'));
const HealthRecordsPage = React.lazy(() => import('@/pages/health/HealthRecords'));
const IncidentsPage = React.lazy(() => import('@/pages/incidents/Incidents'));
const DutyAssignmentPage = React.lazy(() => import('@/pages/duty/DutyAssignment'));

// ─── Public Pages (no auth) ────────────────────────────────
const OnlineAdmissionPage = React.lazy(() => import('@/pages/admissions/OnlineAdmission'));
const ApplicationStatusPage = React.lazy(() => import('@/pages/admissions/ApplicationStatus'));

// ─── Role constants ─────────────────────────────────────────
const ADMIN_ROLES = ['super_admin', 'admin', 'principal'];
const STAFF_ROLES = [...ADMIN_ROLES, 'faculty'];
const ALL_ROLES = [...STAFF_ROLES, 'parent'];

const AppRouter = () => {
  return (
    <BrowserRouter>
      <Suspense fallback={<Loader />}>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/online-admission" element={<OnlineAdmissionPage />} />
          <Route path="/admission-status" element={<ApplicationStatusPage />} />

          {/* Protected Routes — wrapped in MainLayout */}
          <Route
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            {/* Open to all authenticated roles */}
            <Route path="/" element={<DashboardPage />} />
            <Route path="/students" element={<StudentsPage />} />
            <Route path="/exams" element={<ExamsPage />} />

            {/* Admin + Principal only */}
            <Route path="/admissions" element={<RoleRoute roles={ADMIN_ROLES}><AdmissionsPage /></RoleRoute>} />
            <Route path="/faculty" element={<RoleRoute roles={ADMIN_ROLES}><FacultyPage /></RoleRoute>} />
            <Route path="/parents" element={<RoleRoute roles={ADMIN_ROLES}><ParentsPage /></RoleRoute>} />
            <Route path="/activity" element={<RoleRoute roles={ADMIN_ROLES}><ActivityLogsPage /></RoleRoute>} />

            {/* Admin + Faculty */}
            <Route path="/attendance" element={<RoleRoute roles={STAFF_ROLES}><AttendancePage /></RoleRoute>} />
            <Route path="/communication" element={<RoleRoute roles={STAFF_ROLES}><CommunicationPage /></RoleRoute>} />

            {/* Admin + Parent */}
            <Route path="/fees" element={<RoleRoute roles={[...ADMIN_ROLES, 'parent']}><FeesPage /></RoleRoute>} />

            {/* ─── School Operations Modules ───────────────── */}
            <Route path="/hostel" element={<RoleRoute roles={STAFF_ROLES}><HostelPage /></RoleRoute>} />
            <Route path="/leave" element={<RoleRoute roles={STAFF_ROLES}><LeaveRequestsPage /></RoleRoute>} />
            <Route path="/health" element={<RoleRoute roles={STAFF_ROLES}><HealthRecordsPage /></RoleRoute>} />
            <Route path="/incidents" element={<RoleRoute roles={STAFF_ROLES}><IncidentsPage /></RoleRoute>} />
            <Route path="/duty" element={<RoleRoute roles={ADMIN_ROLES}><DutyAssignmentPage /></RoleRoute>} />
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default AppRouter;
