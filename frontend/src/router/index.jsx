import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute, { RoleRoute } from '@/components/common/ProtectedRoute';
import MainLayout from '@/components/layout/MainLayout';
import Loader from '@/components/common/Loader';

// ─── Lazy-loaded Admin pages ─────────────────────────────────
const LoginPage = React.lazy(() => import('@/pages/auth/Login'));
const DashboardPage = React.lazy(() => import('@/pages/dashboard/Dashboard'));
const StudentsPage = React.lazy(() => import('@/pages/students/Students'));
const AdmissionsPage = React.lazy(() => import('@/pages/admissions/Admissions'));
const FeesPage = React.lazy(() => import('@/pages/fees/Fees'));
const AttendancePage = React.lazy(() => import('@/pages/attendance/Attendance'));
const ExamsPage = React.lazy(() => import('@/pages/exams/Exams'));
const FacultyPage = React.lazy(() => import('@/pages/faculty/Faculty'));
const AdminFaculty = React.lazy(() => import('@/pages/admin/AdminFaculty'));
const ParentsPage = React.lazy(() => import('@/pages/parents/Parents'));
const CommunicationPage = React.lazy(() => import('@/pages/communication/Communication'));
const ActivityLogsPage = React.lazy(() => import('@/pages/activity/ActivityLogs'));

// ─── School Operations Modules ─────────────────────────────
const HostelPage = React.lazy(() => import('@/pages/hostel/Hostel'));
const LeaveRequestsPage = React.lazy(() => import('@/pages/leave/LeaveRequests'));
const HealthRecordsPage = React.lazy(() => import('@/pages/health/HealthRecords'));
const IncidentsPage = React.lazy(() => import('@/pages/incidents/Incidents'));
const DutyAssignmentPage = React.lazy(() => import('@/pages/duty/DutyAssignment'));

// ─── Setup Module ───────────────────────────────────────────
const SetupDashboard = React.lazy(() => import('@/pages/setup/SetupDashboard'));
const SchoolSettingsPage = React.lazy(() => import('@/pages/setup/SchoolSettings'));
const AcademicYearPage = React.lazy(() => import('@/pages/setup/AcademicYear'));
const AcademicTermPage = React.lazy(() => import('@/pages/setup/AcademicTerm'));
const ClassesPage = React.lazy(() => import('@/pages/setup/Classes'));
const SectionsPage = React.lazy(() => import('@/pages/setup/Sections'));
const GradeSetupPage = React.lazy(() => import('@/pages/setup/GradeSetup'));
const AttendanceConfigPage = React.lazy(() => import('@/pages/setup/AttendanceConfig'));
const PaymentSettingsPage = React.lazy(() => import('@/pages/setup/PaymentSettings'));
const ClassGroupsPage = React.lazy(() => import('@/pages/setup/ClassGroups'));
const SubjectsPage = React.lazy(() => import('@/pages/setup/Subjects'));
const ClassConfigPage = React.lazy(() => import('@/pages/setup/ClassConfig'));

// ─── Public Pages ──────────────────────────────────────────
const OnlineAdmissionPage = React.lazy(() => import('@/pages/admissions/OnlineAdmission'));
const ApplicationStatusPage = React.lazy(() => import('@/pages/admissions/ApplicationStatus'));
const ParentLoginPage = React.lazy(() => import('@/pages/auth/ParentLogin'));
const FacultyLoginPage = React.lazy(() => import('@/pages/auth/FacultyLogin'));

// ─── Parent Mobile App ─────────────────────────────────────
const ParentDashboard = React.lazy(() => import('@/pages/parent/ParentDashboard'));
const ParentFees = React.lazy(() => import('@/pages/parent/ParentFees'));
const ParentAttendance = React.lazy(() => import('@/pages/parent/ParentAttendance'));
const ParentExams = React.lazy(() => import('@/pages/parent/ParentExams'));
const ParentNotifications = React.lazy(() => import('@/pages/parent/ParentNotifications'));
const ParentProfile = React.lazy(() => import('@/pages/parent/ParentProfile'));
const ParentVault = React.lazy(() => import('@/pages/parent/ParentVault'));
const ParentDocumentRequests = React.lazy(() => import('@/pages/parent/ParentDocumentRequests'));
const ParentDocuments = React.lazy(() => import('@/pages/parent/ParentDocuments'));
const ParentPrivacyPolicy = React.lazy(() => import('@/pages/parent/ParentPrivacyPolicy')); //

// ─── Vault / POS / Registry ────────────────────────────────
const DocumentCatalogAdmin = React.lazy(() => import('@/pages/vault/DocumentCatalogAdmin'));
const DocumentRequestsQueue = React.lazy(() => import('@/pages/vault/DocumentRequestsQueue'));
const StudentVaultAdmin = React.lazy(() => import('@/pages/vault/StudentVaultAdmin'));
const PosItemCatalogAdmin = React.lazy(() => import('@/pages/pos/PosItemCatalogAdmin'));
const PosBilling = React.lazy(() => import('@/pages/pos/PosBilling'));
const InvoiceRegistry = React.lazy(() => import('@/pages/invoices/InvoiceRegistry'));

// ─── Faculty Mobile App ────────────────────────────────────
const FacultyAttendance = React.lazy(() => import('@/pages/faculty/FacultyAttendance'));
const FacultyStudents = React.lazy(() => import('@/pages/faculty/FacultyStudents'));
const FacultyNotifications = React.lazy(() => import('@/pages/faculty/FacultyNotifications'));
const FacultyProfile = React.lazy(() => import('@/pages/faculty/FacultyProfile'));
const AssignmentManager = React.lazy(() => import('@/pages/faculty/AssignmentManager'));
const StudyMaterialsPage = React.lazy(() => import('@/pages/faculty/StudyMaterials'));

// ─── Role constants ─────────────────────────────────────────
const ADMIN_ROLES = ['super_admin', 'admin', 'principal'];
const STAFF_ROLES = [...ADMIN_ROLES, 'faculty'];
const PARENT_ROLES = ['parent'];
const FACULTY_ROLES = ['faculty'];

/**
 * Smart redirect after login: parent → /parent/dashboard, faculty → /faculty-app/attendance, else → /
 */
const RoleRedirect = () => {
  const user = JSON.parse(localStorage.getItem('vms_user') || 'null');
  if (user?.role === 'parent') return <Navigate to="/parent/dashboard" replace />;
  if (user?.role === 'faculty') return <Navigate to="/faculty-app/attendance" replace />;
  return <Navigate to="/" replace />;
};

const AppRouter = () => {
  return (
    <BrowserRouter>
      <Suspense fallback={<Loader />}>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/parent-login" element={<ParentLoginPage />} />
          <Route path="/faculty-login" element={<FacultyLoginPage />} />
          <Route path="/online-admission" element={<OnlineAdmissionPage />} />
          <Route path="/admission-status" element={<ApplicationStatusPage />} />


          {/* ─── Parent Mobile App ─────────────────────────── */}
          <Route path="/parent/*" element={
            <ProtectedRoute>
              <RoleRoute roles={[...PARENT_ROLES, ...ADMIN_ROLES]}>
                <Routes>
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="dashboard" element={<ParentDashboard />} />
                  <Route path="fees" element={<ParentFees />} />
                  <Route path="attendance" element={<ParentAttendance />} />
                  <Route path="exams" element={<ParentExams />} />
                  <Route path="notifications" element={<ParentNotifications />} />
                  <Route path="profile" element={<ParentProfile />} />
                  <Route path="vault" element={<ParentVault />} />
                  <Route path="requests" element={<ParentDocumentRequests />} />
                  <Route path="documents" element={<ParentDocuments />} />
                  <Route path="privacy-policy" element={<ParentPrivacyPolicy />} />
                </Routes>
              </RoleRoute>
            </ProtectedRoute>
          } />

          {/* ─── Faculty Mobile App ────────────────────────── */}
          <Route path="/faculty-app/*" element={
            <ProtectedRoute>
              <RoleRoute roles={FACULTY_ROLES}>
                <Routes>
                  <Route index element={<Navigate to="attendance" replace />} />
                  <Route path="attendance" element={<FacultyAttendance />} />
                  <Route path="students" element={<FacultyStudents />} />
                  <Route path="notifications" element={<FacultyNotifications />} />
                  <Route path="profile" element={<FacultyProfile />} />
                  <Route path="assignments" element={<AssignmentManager />} />
                  <Route path="materials" element={<StudyMaterialsPage />} />
                </Routes>
              </RoleRoute>
            </ProtectedRoute>
          } />

          {/* ─── Admin Desktop App ─────────────────────────── */}
          <Route element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }>
            {/* Open to all authenticated roles */}
            <Route path="/" element={<DashboardPage />} />
            <Route path="/students" element={<StudentsPage />} />
            <Route path="/exams" element={<ExamsPage />} />

            {/* Admin + Principal only */}
            <Route path="/admissions" element={<RoleRoute roles={ADMIN_ROLES}><AdmissionsPage /></RoleRoute>} />
            <Route path="/parents" element={<RoleRoute roles={ADMIN_ROLES}><ParentsPage /></RoleRoute>} />
            <Route path="/activity" element={<RoleRoute roles={ADMIN_ROLES}><ActivityLogsPage /></RoleRoute>} />

            {/* Admin + Faculty */}
            <Route path="/attendance" element={<RoleRoute roles={STAFF_ROLES}><AttendancePage /></RoleRoute>} />
            <Route path="/communication" element={<RoleRoute roles={STAFF_ROLES}><CommunicationPage /></RoleRoute>} />

            {/* /admin/faculty → admin-managed faculty list */}
            <Route path="/admin/faculty" element={<RoleRoute roles={ADMIN_ROLES}><AdminFaculty /></RoleRoute>} />

            {/* Assignments + Materials (admin + faculty) */}
            <Route path="/assignments" element={<RoleRoute roles={STAFF_ROLES}><AssignmentManager /></RoleRoute>} />
            <Route path="/materials" element={<RoleRoute roles={STAFF_ROLES}><StudyMaterialsPage /></RoleRoute>} />

            {/* Admin + Parent */}
            <Route path="/fees" element={<RoleRoute roles={[...ADMIN_ROLES, 'parent']}><FeesPage /></RoleRoute>} />

            {/* Vault + POS + Invoice Registry (Admin only) */}
            <Route path="/vault/catalog" element={<RoleRoute roles={ADMIN_ROLES}><DocumentCatalogAdmin /></RoleRoute>} />
            <Route path="/vault/requests" element={<RoleRoute roles={ADMIN_ROLES}><DocumentRequestsQueue /></RoleRoute>} />
            <Route path="/vault/students" element={<RoleRoute roles={ADMIN_ROLES}><StudentVaultAdmin /></RoleRoute>} />
            <Route path="/pos/catalog" element={<RoleRoute roles={ADMIN_ROLES}><PosItemCatalogAdmin /></RoleRoute>} />
            <Route path="/pos/billing" element={<RoleRoute roles={ADMIN_ROLES}><PosBilling /></RoleRoute>} />
            <Route path="/invoices" element={<RoleRoute roles={ADMIN_ROLES}><InvoiceRegistry /></RoleRoute>} />

            {/* School Operations */}
            <Route path="/hostel" element={<RoleRoute roles={STAFF_ROLES}><HostelPage /></RoleRoute>} />
            <Route path="/leave" element={<RoleRoute roles={STAFF_ROLES}><LeaveRequestsPage /></RoleRoute>} />
            <Route path="/health" element={<RoleRoute roles={STAFF_ROLES}><HealthRecordsPage /></RoleRoute>} />
            <Route path="/incidents" element={<RoleRoute roles={STAFF_ROLES}><IncidentsPage /></RoleRoute>} />
            <Route path="/duty" element={<RoleRoute roles={ADMIN_ROLES}><DutyAssignmentPage /></RoleRoute>} />

            {/* Setup Module */}
            <Route path="/setup" element={<RoleRoute roles={['super_admin', 'admin']}><SetupDashboard /></RoleRoute>} />
            <Route path="/setup/school-settings" element={<RoleRoute roles={['super_admin', 'admin']}><SchoolSettingsPage /></RoleRoute>} />
            <Route path="/setup/academic-year" element={<RoleRoute roles={['super_admin', 'admin']}><AcademicYearPage /></RoleRoute>} />
            <Route path="/setup/academic-term" element={<RoleRoute roles={['super_admin', 'admin']}><AcademicTermPage /></RoleRoute>} />
            <Route path="/setup/classes" element={<RoleRoute roles={['super_admin', 'admin']}><ClassesPage /></RoleRoute>} />
            <Route path="/setup/sections" element={<RoleRoute roles={['super_admin', 'admin']}><SectionsPage /></RoleRoute>} />
            <Route path="/setup/grade-setup" element={<RoleRoute roles={['super_admin', 'admin']}><GradeSetupPage /></RoleRoute>} />
            <Route path="/setup/attendance-config" element={<RoleRoute roles={['super_admin', 'admin']}><AttendanceConfigPage /></RoleRoute>} />
            <Route path="/setup/payment-settings" element={<RoleRoute roles={['super_admin', 'admin']}><PaymentSettingsPage /></RoleRoute>} />
            <Route path="/setup/class-groups" element={<RoleRoute roles={['super_admin', 'admin']}><ClassGroupsPage /></RoleRoute>} />
            <Route path="/setup/subjects" element={<RoleRoute roles={['super_admin', 'admin']}><SubjectsPage /></RoleRoute>} />
            <Route path="/setup/class-config" element={<RoleRoute roles={['super_admin', 'admin']}><ClassConfigPage /></RoleRoute>} />
          </Route>

          {/* Catch-all — role-aware redirect */}
          <Route path="*" element={<RoleRedirect />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default AppRouter;
