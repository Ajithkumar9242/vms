import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute, { RoleRoute, getRoleHome } from '@/components/common/ProtectedRoute';
import MainLayout from '@/components/layout/MainLayout';
import Loader from '@/components/common/Loader';

// ─── Lazy-loaded Admin pages ─────────────────────────────────
const LoginPage = React.lazy(() => import('@/pages/auth/Login'));
const DashboardPage = React.lazy(() => import('@/pages/dashboard/Dashboard'));
const StudentsPage = React.lazy(() => import('@/pages/students/Students'));
const AdmissionsPage = React.lazy(() => import('@/pages/admissions/Admissions'));
const FeesPage = React.lazy(() => import('@/pages/fees/Fees'));
const DiscountReport = React.lazy(() => import('@/pages/fees/DiscountReport'));
const AttendancePage = React.lazy(() => import('@/pages/attendance/Attendance'));
const ExamsPage = React.lazy(() => import('@/pages/exams/Exams'));
const AdminFaculty = React.lazy(() => import('@/pages/admin/AdminFaculty'));
const ParentsPage = React.lazy(() => import('@/pages/parents/Parents'));
const CommunicationPage = React.lazy(() => import('@/pages/communication/Communication'));
const ActivityLogsPage = React.lazy(() => import('@/pages/activity/ActivityLogs'));
const TimetablePage = React.lazy(() => import('@/pages/timetable/Timetable'));

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
const MessageTemplatesPage = React.lazy(() => import('@/pages/setup/MessageTemplates'));
const ClassGroupsPage = React.lazy(() => import('@/pages/setup/ClassGroups'));
const SubjectsPage = React.lazy(() => import('@/pages/setup/Subjects'));
const ClassConfigPage = React.lazy(() => import('@/pages/setup/ClassConfig'));

// ─── Public Pages ──────────────────────────────────────────
const OnlineAdmissionPage = React.lazy(() => import('@/pages/admissions/OnlineAdmission'));
const ApplicationStatusPage = React.lazy(() => import('@/pages/admissions/ApplicationStatus'));
const ParentLoginPage = React.lazy(() => import('@/pages/auth/ParentLogin'));
const FacultyLoginPage = React.lazy(() => import('@/pages/auth/FacultyLogin'));
const OtpLoginPage = React.lazy(() => import('@/pages/auth/OtpLogin'));

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
const ParentPrivacyPolicy = React.lazy(() => import('@/pages/parent/ParentPrivacyPolicy'));

// ─── Vault / POS / Registry ────────────────────────────────
const DocumentCatalogAdmin = React.lazy(() => import('@/pages/vault/DocumentCatalogAdmin'));
const DocumentRequestsQueue = React.lazy(() => import('@/pages/vault/DocumentRequestsQueue'));
const StudentVaultAdmin = React.lazy(() => import('@/pages/vault/StudentVaultAdmin'));
const PosItemCatalogAdmin = React.lazy(() => import('@/pages/pos/PosItemCatalogAdmin'));
const PosBilling = React.lazy(() => import('@/pages/pos/PosBilling'));
const InvoiceRegistry = React.lazy(() => import('@/pages/invoices/InvoiceRegistry'));

// ─── Certificate Module ────────────────────────────────────────
const CertificateTemplates = React.lazy(() => import('@/pages/certificates/CertificateTemplates'));
const CertificateTemplateEditor = React.lazy(() => import('@/pages/certificates/CertificateTemplateEditor'));
const PrintCertificate = React.lazy(() => import('@/pages/certificates/PrintCertificate'));

// ─── Faculty Mobile App ────────────────────────────────────
const FacultyAttendance = React.lazy(() => import('@/pages/faculty/FacultyAttendance'));
const FacultyStudents = React.lazy(() => import('@/pages/faculty/FacultyStudents'));
const FacultyNotifications = React.lazy(() => import('@/pages/faculty/FacultyNotifications'));
const FacultyProfile = React.lazy(() => import('@/pages/faculty/FacultyProfile'));
const AssignmentManager = React.lazy(() => import('@/pages/faculty/AssignmentManager'));
const MarksEntryPage = React.lazy(() => import('@/pages/exams/MarksEntry'));
const FacultyMarksEntry = React.lazy(() => import('@/pages/faculty/FacultyMarksEntry'));
// ─── Placeholder pages (temporarily disabled features) ────
const ComingSoonPage = (title) => React.lazy(() =>
  Promise.resolve({
    default: () => (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '60vh', gap: 16,
        fontFamily: "'Inter', sans-serif",
      }}>
        <div style={{ fontSize: 56 }}>🚧</div>
        <h2 style={{ margin: 0, color: 'var(--color-primary-dark)' }}>{title}</h2>
        <p style={{ color: '#64748B', margin: 0 }}>This module is under development and will be available soon.</p>
      </div>
    ),
  })
);
const StudyMaterialsPage = ComingSoonPage('Study Materials — Temporarily Disabled');

// ─── Role constants ─────────────────────────────────────────
/** Setup pages: super_admin + admin + visitor — visitor has read-only access */
const SETUP_ROLES = ['super_admin', 'admin', 'visitor'];
/** Full management + visitor (read-only for visitor) */
const HIGH_PRIV = ['super_admin', 'admin', 'principal', 'visitor'];
/** Finance + visitor (read-only for visitor) */
const FINANCE_ROLES = ['super_admin', 'admin', 'principal', 'accountant', 'visitor'];
/** Operations + visitor (read-only for visitor) */
const STAFF_ROLES = ['super_admin', 'admin', 'principal', 'faculty', 'visitor'];
/** Faculty mobile app */
const FACULTY_ROLES = ['faculty'];
/** Parent mobile app */
const PARENT_ROLES = ['parent'];

/**
 * Smart post-login redirect:
 *   parent     → /parent/dashboard
 *   faculty    → /faculty-app/attendance
 *   everyone else → /  (dashboard)
 */
const RoleRedirect = () => {
  const user = JSON.parse(localStorage.getItem('vms_user') || 'null');
  return <Navigate to={getRoleHome(user?.role)} replace />;
};

const AppRouter = () => (
  <BrowserRouter>
    <Suspense fallback={<Loader />}>
      <Routes>

        {/* ── Public ─────────────────────────────────────── */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/parent-login" element={<ParentLoginPage />} />
        <Route path="/parent/login" element={<ParentLoginPage />} />
        <Route path="/faculty-login" element={<FacultyLoginPage />} />
        <Route path="/faculty/login" element={<FacultyLoginPage />} />
        <Route path="/online-admission" element={<OnlineAdmissionPage />} />
        <Route path="/admission-status" element={<ApplicationStatusPage />} />
        <Route path="/otp-login" element={<OtpLoginPage />} />
        <Route path="/login/otp" element={<OtpLoginPage />} />

        {/* ── Parent Mobile App ──────────────────────────── */}
        {/* Safety: non-parent users hitting /parent/* get redirected to login */}
        <Route path="/parent/*" element={
          <ProtectedRoute>
            <RoleRoute roles={[...PARENT_ROLES, ...HIGH_PRIV]}>
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

        {/* ── Faculty Mobile App ─────────────────────────── */}
        <Route path="/faculty-app/*" element={
          <ProtectedRoute>
            <RoleRoute roles={FACULTY_ROLES}>
              <Routes>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<FacultyAttendance />} />
                <Route path="attendance" element={<FacultyAttendance />} />
                <Route path="students" element={<FacultyStudents />} />
                <Route path="notifications" element={<FacultyNotifications />} />
                <Route path="profile" element={<FacultyProfile />} />
                <Route path="assignments" element={<AssignmentManager />} />
                <Route path="marks" element={<FacultyMarksEntry />} />
                <Route path="materials" element={<StudyMaterialsPage />} />
              </Routes>
            </RoleRoute>
          </ProtectedRoute>
        } />

        {/* ── Admin / Staff Desktop App ──────────────────── */}
        <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>

          {/* Dashboard — all desktop roles */}
          <Route path="/" element={<RoleRedirect />} />
          <Route path="/dashboard" element={<DashboardPage />} />

          {/* Students — viewable by all desktop roles incl. accountant */}
          <Route path="/students"
            element={<RoleRoute roles={[...FINANCE_ROLES, 'faculty']}><StudentsPage /></RoleRoute>} />

          {/* Exams — staff (admin + principal + faculty) */}
          <Route path="/exams"
            element={<RoleRoute roles={STAFF_ROLES}><ExamsPage /></RoleRoute>} />

          {/* Timetable — staff + accountant + visitor */}
          <Route path="/timetable"
            element={<RoleRoute roles={[...STAFF_ROLES, 'accountant']}><TimetablePage /></RoleRoute>} />

          {/* ── HIGH_PRIV only (admin + principal) ──── */}
          <Route path="/admissions"
            element={<RoleRoute roles={HIGH_PRIV}><AdmissionsPage /></RoleRoute>} />
          <Route path="/parents"
            element={<RoleRoute roles={HIGH_PRIV}><ParentsPage /></RoleRoute>} />
          <Route path="/activity"
            element={<RoleRoute roles={HIGH_PRIV}><ActivityLogsPage /></RoleRoute>} />
          <Route path="/admin/faculty"
            element={<RoleRoute roles={HIGH_PRIV}><AdminFaculty /></RoleRoute>} />
          <Route path="/duty"
            element={<RoleRoute roles={HIGH_PRIV}><DutyAssignmentPage /></RoleRoute>} />

          {/* ── STAFF_ROLES (admin + principal + faculty) ── */}
          <Route path="/attendance"
            element={<RoleRoute roles={STAFF_ROLES}><AttendancePage /></RoleRoute>} />
          <Route path="/communication"
            element={<RoleRoute roles={STAFF_ROLES}><CommunicationPage /></RoleRoute>} />
          <Route path="/assignments"
            element={<RoleRoute roles={STAFF_ROLES}><AssignmentManager /></RoleRoute>} />
          <Route path="/marks-entry"
            element={<RoleRoute roles={STAFF_ROLES}><MarksEntryPage /></RoleRoute>} />
          {/* Study Materials: temporarily disabled — shows Coming Soon */}
          <Route path="/materials"
            element={<RoleRoute roles={STAFF_ROLES}><StudyMaterialsPage /></RoleRoute>} />
          <Route path="/hostel"
            element={<RoleRoute roles={STAFF_ROLES}><HostelPage /></RoleRoute>} />
          <Route path="/leave"
            element={<RoleRoute roles={STAFF_ROLES}><LeaveRequestsPage /></RoleRoute>} />
          <Route path="/health"
            element={<RoleRoute roles={STAFF_ROLES}><HealthRecordsPage /></RoleRoute>} />
          <Route path="/incidents"
            element={<RoleRoute roles={STAFF_ROLES}><IncidentsPage /></RoleRoute>} />

          {/* ── FINANCE_ROLES (admin + principal + accountant) ── */}
          <Route path="/fees"
            element={<RoleRoute roles={[...FINANCE_ROLES, 'parent']}><FeesPage /></RoleRoute>} />
          <Route path="/fees/discounts"
            element={<RoleRoute roles={FINANCE_ROLES}><DiscountReport /></RoleRoute>} />
          <Route path="/pos/catalog"
            element={<RoleRoute roles={FINANCE_ROLES}><PosItemCatalogAdmin /></RoleRoute>} />
          <Route path="/pos/billing"
            element={<RoleRoute roles={FINANCE_ROLES}><PosBilling /></RoleRoute>} />
          <Route path="/invoices"
            element={<RoleRoute roles={FINANCE_ROLES}><InvoiceRegistry /></RoleRoute>} />
          {/* Vault requests — accountant can view (backend also allows); catalog/students = HIGH_PRIV */}
          <Route path="/vault/requests"
            element={<RoleRoute roles={FINANCE_ROLES}><DocumentRequestsQueue /></RoleRoute>} />
          <Route path="/vault/catalog"
            element={<RoleRoute roles={HIGH_PRIV}><DocumentCatalogAdmin /></RoleRoute>} />
          <Route path="/vault/students"
            element={<RoleRoute roles={HIGH_PRIV}><StudentVaultAdmin /></RoleRoute>} />

          {/* ── Certificate Module ───────────────────────────── */}
          <Route path="/certificates/templates"
            element={<RoleRoute roles={HIGH_PRIV}><CertificateTemplates /></RoleRoute>} />
          <Route path="/certificates/templates/new"
            element={<RoleRoute roles={['super_admin','admin','principal']}><CertificateTemplateEditor /></RoleRoute>} />
          <Route path="/certificates/templates/:id/edit"
            element={<RoleRoute roles={['super_admin','admin','principal']}><CertificateTemplateEditor /></RoleRoute>} />
          <Route path="/certificates/print"
            element={<RoleRoute roles={HIGH_PRIV}><PrintCertificate /></RoleRoute>} />

          {/* ── Setup — SETUP_ROLES only (super_admin + admin) ── */}
          <Route path="/setup"
            element={<RoleRoute roles={SETUP_ROLES}><SetupDashboard /></RoleRoute>} />
          <Route path="/setup/school-settings"
            element={<RoleRoute roles={SETUP_ROLES}><SchoolSettingsPage /></RoleRoute>} />
          <Route path="/setup/academic-year"
            element={<RoleRoute roles={SETUP_ROLES}><AcademicYearPage /></RoleRoute>} />
          <Route path="/setup/academic-term"
            element={<RoleRoute roles={SETUP_ROLES}><AcademicTermPage /></RoleRoute>} />
          <Route path="/setup/classes"
            element={<RoleRoute roles={SETUP_ROLES}><ClassesPage /></RoleRoute>} />
          <Route path="/setup/sections"
            element={<RoleRoute roles={SETUP_ROLES}><SectionsPage /></RoleRoute>} />
          <Route path="/setup/grade-setup"
            element={<RoleRoute roles={SETUP_ROLES}><GradeSetupPage /></RoleRoute>} />
          <Route path="/setup/attendance-config"
            element={<RoleRoute roles={SETUP_ROLES}><AttendanceConfigPage /></RoleRoute>} />
          <Route path="/setup/payment-settings"
            element={<RoleRoute roles={SETUP_ROLES}><PaymentSettingsPage /></RoleRoute>} />
          <Route path="/setup/message-templates"
            element={<RoleRoute roles={SETUP_ROLES}><MessageTemplatesPage /></RoleRoute>} />
          <Route path="/setup/class-groups"
            element={<RoleRoute roles={SETUP_ROLES}><ClassGroupsPage /></RoleRoute>} />
          <Route path="/setup/subjects"
            element={<RoleRoute roles={SETUP_ROLES}><SubjectsPage /></RoleRoute>} />
          <Route path="/setup/class-config"
            element={<RoleRoute roles={SETUP_ROLES}><ClassConfigPage /></RoleRoute>} />

        </Route>{/* end Admin Desktop App */}

        {/* Catch-all */}
        <Route path="*" element={<RoleRedirect />} />

      </Routes>
    </Suspense>
  </BrowserRouter>
);

export default AppRouter;
