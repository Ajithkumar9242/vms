import React, { useEffect, useState, useCallback } from 'react';
import ParentLayout from '@/components/mobile/ParentLayout';
import { attendanceAPI, studentAPI } from '@/services/api';
import useAuthStore from '@/store/authStore';
import dayjs from 'dayjs';

const ParentAttendance = () => {
  const user = useAuthStore(s => s.user);

  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [studentId, setStudentId] = useState(null);
  const [report,    setReport]    = useState(null); // { student, totalConducted, totalAttended, percentage, monthWise }

  useEffect(() => { resolveStudent(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const resolveStudent = useCallback(async () => {
    setLoading(true);
    setError(null);
    const allLinked = user?.linkedEntity?.linkedStudents || [];
    const storedIdx = parseInt(localStorage.getItem('vms_selected_child_idx') || '0', 10);
    const safeIdx = allLinked.length > 0 ? Math.min(Math.max(0, storedIdx), allLinked.length - 1) : 0;
    const linked = allLinked[safeIdx];
    const sid = linked?._id || user?.studentId || user?.metadata?.studentId;
    if (sid) {
      setStudentId(sid);
      await loadReport(sid);
    } else {
      try {
        const res = await studentAPI.getAll({ limit: 1 });
        const s = res?.data?.students?.[0] || res?.data?.[0];
        if (s) {
          setStudentId(s._id);
          await loadReport(s._id);
        } else {
          setError('No student linked to your account. Contact admin.');
          setLoading(false);
        }
      } catch (e) {
        setError(e.message || 'Failed to load student data.');
        setLoading(false);
      }
    }
  }, [user]);

  const loadReport = async (sid) => {
    setLoading(true);
    setError(null);
    try {
      const res = await attendanceAPI.getMonthlyStudentReport(sid);
      // res = { success, data: { student, totalConducted, totalAttended, percentage, monthWise } }
      const data = res?.data || res;
      setReport(data);
    } catch (e) {
      setError(e.message || 'Failed to load attendance.');
    } finally {
      setLoading(false);
    }
  };

  const pct = report?.percentage ?? 0;
  const monthWise = report?.monthWise || [];

  const pctColor = pct >= 75 ? '#16A34A' : pct >= 50 ? '#D97706' : '#DC2626';
  const pctEmoji = pct >= 75 ? '🟢' : pct >= 50 ? '🟡' : '🔴';

  return (
    <ParentLayout title="Attendance" subtitle="Monthly class attendance">

      {loading && <div className="m-spinner" />}

      {!loading && error && (
        <div className="m-card" style={{ borderLeft: '3px solid #EF4444', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: '#DC2626', marginBottom: 8 }}>{error}</div>
          <button className="m-btn m-btn-outline" onClick={resolveStudent}>Retry</button>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Hero Banner */}
          {report && report.totalConducted > 0 ? (
            <div className="m-hero" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 4 }}>
                    {report.student?.name ? `${report.student.name}'s` : ''} Overall Attendance
                  </div>
                  <div style={{ fontSize: 44, fontWeight: 900, lineHeight: 1 }}>{pct}%</div>
                  <div style={{ fontSize: 12, opacity: 0.65, marginTop: 6 }}>
                    {report.totalAttended} attended · {report.totalConducted - report.totalAttended} absent · {report.totalConducted} total classes
                  </div>
                </div>
                <div style={{
                  width: 64, height: 64, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 30,
                }}>
                  {pctEmoji}
                </div>
              </div>
              {/* Progress bar */}
              <div style={{ marginTop: 14, background: 'rgba(255,255,255,0.2)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${pct}%`, borderRadius: 4,
                  background: pct >= 75 ? '#22C55E' : pct >= 50 ? '#F59E0B' : '#EF4444',
                  transition: 'width 0.6s ease',
                }} />
              </div>
              {pct < 75 && (
                <div style={{ fontSize: 11, marginTop: 8, opacity: 0.9, color: '#FEF3C7' }}>
                  ⚠️ Attendance below 75% — contact school.
                </div>
              )}
            </div>
          ) : report ? (
            <div className="m-card" style={{ textAlign: 'center', padding: '20px 16px' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>
                No Attendance Data Yet
              </div>
              <div style={{ fontSize: 12, color: '#64748B' }}>
                Monthly attendance has not been entered for your child's class yet.
              </div>
            </div>
          ) : null}

          {/* Summary stat boxes */}
          {report && report.totalConducted > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
              {[
                { label: 'Conducted', value: report.totalConducted, color: 'var(--color-primary-dark)', bg: '#F8FAFC' },
                { label: 'Attended', value: report.totalAttended, color: '#16A34A', bg: '#F0FDF4' },
                { label: 'Absent', value: report.totalConducted - report.totalAttended, color: '#DC2626', bg: '#FEF2F2' },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, borderRadius: 12, padding: '10px 6px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: s.color, fontWeight: 600, marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Month-wise list */}
          {monthWise.length > 0 && (
            <div className="m-card">
              <div className="m-card-header" style={{ marginBottom: 10 }}>
                <div className="m-card-title">Month-wise Breakdown</div>
                <span className="m-badge m-badge-neutral">{monthWise.length} months</span>
              </div>
              {monthWise.map((m, i) => {
                const mpct = m.conducted > 0 ? Math.round((m.attended / m.conducted) * 100) : 0;
                const mColor = mpct >= 75 ? '#16A34A' : mpct >= 50 ? '#D97706' : '#DC2626';
                const mBg = mpct >= 75 ? '#F0FDF4' : mpct >= 50 ? '#FFF7ED' : '#FEF2F2';
                return (
                  <div key={m.monthKey} className="m-list-item">
                    <div className="m-list-icon" style={{ background: mBg, color: mColor, fontSize: 16, fontWeight: 700 }}>
                      {mpct >= 75 ? '✓' : mpct >= 50 ? '~' : '✗'}
                    </div>
                    <div className="m-list-body">
                      <div className="m-list-title">
                        {dayjs(m.monthKey, 'YYYY-MM').format('MMMM YYYY')}
                      </div>
                      <div className="m-list-desc">
                        {m.attended} attended · {m.conducted - m.attended} absent · {m.conducted} total
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: mColor, minWidth: 44, textAlign: 'right' }}>
                      {mpct}%
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty state */}
          {!report && !error && (
            <div className="m-empty">
              <div className="m-empty-icon">📋</div>
              <div className="m-empty-text">No attendance records found</div>
              <button className="m-btn m-btn-ghost" style={{ marginTop: 12, width: 'auto', padding: '8px 20px' }}
                onClick={resolveStudent}>
                Refresh
              </button>
            </div>
          )}
        </>
      )}
    </ParentLayout>
  );
};

export default ParentAttendance;
