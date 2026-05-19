import React, { useState } from 'react';
import FacultyLayout from '@/components/mobile/FacultyLayout';
import MonthlyAttendanceEntry from '@/pages/attendance/MonthlyAttendanceEntry';
import MonthlyAttendanceReport from '@/pages/attendance/MonthlyAttendanceReport';

/**
 * FacultyAttendance
 * -----------------
 * Mobile attendance page for faculty — two tabs:
 *   1) "✏️ Mark" — MonthlyAttendanceEntry (mark by month)
 *   2) "📊 Report" — MonthlyAttendanceReport (cumulative view)
 *
 * Tab bar uses CSS classes (.faculty-tab-bar / .faculty-tab-btn).
 * Both inner components use .faculty-module for consistent spacing.
 */

const TABS = [
  { key: 'mark',   label: '✏️  Mark Attendance' },
  { key: 'report', label: '📊  View Report' },
];

const FacultyAttendance = () => {
  const [activeTab, setActiveTab] = useState('mark');

  return (
    <FacultyLayout title="Attendance" subtitle="Mark and view attendance">

      {/* ── Tab Bar (CSS-controlled) ── */}
      <div className="faculty-tab-bar">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`faculty-tab-btn${activeTab === tab.key ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      {activeTab === 'mark'   && <MonthlyAttendanceEntry />}
      {activeTab === 'report' && <MonthlyAttendanceReport />}

    </FacultyLayout>
  );
};

export default FacultyAttendance;

/*
 * ═══════════════════════════════════════════════════════════════════════
 * OLD PERIODIC ATTENDANCE (disabled — replaced by monthly view)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * The original day-wise periodic marking UI (class selector, date picker,
 * student toggle cards, lock button) has been replaced by the admin-style
 * monthly entry and report components above.
 *
 * Key parts of the original implementation:
 *  - STATUS_OPTIONS = ['present', 'absent', 'late', 'excused']
 *  - toggleStatus(studentId) — cycled through status options on tap
 *  - handleSave() — posted to attendanceAPI.mark({ records })
 *  - handleLockConfirmed() — posted to attendanceAPI.lock(...)
 *  - LockConfirmModal — bottom-sheet confirmation UI
 *
 * To restore: see git history for src/pages/faculty/FacultyAttendance.jsx
 * ═══════════════════════════════════════════════════════════════════════
 */
