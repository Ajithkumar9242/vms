import React, { useEffect, useState, useCallback } from 'react';
import ParentLayout from '@/components/mobile/ParentLayout';
import { attendanceAPI, studentAPI } from '@/services/api';
import useAuthStore from '@/store/authStore';
import { exportAttendanceCSV } from '@/utils/pdf';
import dayjs from 'dayjs';

const STATUS_COLOR = {
  present: { bg: '#DCFCE7', color: '#16A34A', label: 'Present', icon: '✓' },
  absent:  { bg: '#FEE2E2', color: '#DC2626', label: 'Absent',  icon: '✗' },
  late:    { bg: '#FEF3C7', color: '#D97706', label: 'Late',    icon: '⏰' },
  excused: { bg: '#EDE9FE', color: '#7C3AED', label: 'Excused', icon: '📋' },
};

const ParentAttendance = () => {
  const user = useAuthStore((s) => s.user);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [studentId, setStudentId] = useState(null);
  const [student,   setStudent]   = useState(null);
  const [report,    setReport]    = useState([]);
  const [stats,     setStats]     = useState({ present: 0, absent: 0, late: 0, excused: 0, total: 0 });
  const [dateFrom,  setDateFrom]  = useState(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [dateTo,    setDateTo]    = useState(dayjs().format('YYYY-MM-DD'));
  const [showAll,   setShowAll]   = useState(false);

  useEffect(() => { resolveStudent(); }, []);

  const resolveStudent = useCallback(async () => {
    setLoading(true);
    setError(null);
    const linked = user?.linkedEntity?.linkedStudents?.[0];
    const sid = linked?._id || user?.studentId || user?.metadata?.studentId;
    if (sid) {
      setStudentId(sid);
      if (linked) setStudent(linked);
      else {
        try {
          const res = await studentAPI.getById(sid);
          setStudent(res?.data || res);
        } catch {}
      }
      await loadReport(sid, linked?.classId?._id || linked?.classId);
    } else {
      try {
        const res = await studentAPI.getAll({ limit: 1 });
        const s   = res?.data?.students?.[0] || res?.data?.[0];
        if (s) {
          setStudentId(s._id);
          setStudent(s);
          await loadReport(s._id, s.classId?._id || s.classId);
        } else {
          setLoading(false);
        }
      } catch (e) {
        setError(e.message || 'Failed to load student.');
        setLoading(false);
      }
    }
  }, [user, dateFrom, dateTo]);

  const loadReport = async (sid, classId) => {
    const cid = classId || student?.classId?._id || student?.classId;
    if (!cid) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const res  = await attendanceAPI.getReport({ classId: cid, dateFrom, dateTo });
      const body = res?.data || res || {};

      // Backend returns { report: [...], stats: {...} }
      // report rows: { _id(studentId), studentName, rollNo, totalPresent, totalAbsent, totalLate, totalDays, percentage }
      const report = Array.isArray(body)
        ? body
        : Array.isArray(body?.report)
        ? body.report
        : [];

      // Find this student's row
      const mine = report.find(
        (r) => String(r._id) === String(sid) || String(r.studentId) === String(sid)
      );

      if (mine) {
        // Convert aggregated row into daily-record-style for the UI
        setReport([mine]);
        setStats({
          present: mine.totalPresent || 0,
          absent:  mine.totalAbsent  || 0,
          late:    mine.totalLate    || 0,
          excused: 0,
          total:   mine.totalDays    || 0,
          percentage: mine.percentage || 0,
        });
      } else {
        setReport([]);
        setStats({ present: 0, absent: 0, late: 0, excused: 0, total: 0, percentage: 0 });
      }
    } catch (err) {
      setError(err.message || 'Failed to load attendance.');

    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (studentId) loadReport(studentId, student?.classId?._id || student?.classId);
  };

  const handleExportCSV = () => {
    exportAttendanceCSV(
      report,
      student?.name || 'Student',
      dateFrom,
      dateTo
    );
  };

  const pct = stats.total > 0
    ? Math.round(((stats.present + stats.late * 0.5) / stats.total) * 100)
    : 0;

  const displayedRecords = showAll ? report : report.slice(0, 30);

  return (
    <ParentLayout title="Attendance" subtitle="Session-wise records">

      {/* Date Filter */}
      <div className="m-card" style={{ padding: '12px 14px', marginBottom: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <label className="m-label">From</label>
            <input className="m-input" type="date" value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              max={dateTo}
            />
          </div>
          <div>
            <label className="m-label">To</label>
            <input className="m-input" type="date" value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              max={dayjs().format('YYYY-MM-DD')}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="m-btn m-btn-primary" style={{ flex: 2 }} onClick={handleSearch}>
            🔍 Load Attendance
          </button>
          {report.length > 0 && (
            <button className="m-btn m-btn-outline" style={{ flex: 1 }} onClick={handleExportCSV}>
              📊 CSV
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="m-card" style={{ borderLeft: '3px solid #EF4444', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: '#DC2626', marginBottom: 8 }}>{error}</div>
          <button className="m-btn m-btn-outline" onClick={resolveStudent}>Retry</button>
        </div>
      )}

      {loading ? (
        <div className="m-spinner" />
      ) : (
        <>
          {/* Hero Banner */}
          {stats.total > 0 && (
            <div className="m-hero" style={{ padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 4 }}>
                    {student?.name ? `${student.name}'s` : ''} Overall Attendance
                  </div>
                  <div style={{ fontSize: 40, fontWeight: 900, lineHeight: 1 }}>{pct}%</div>
                  <div style={{ fontSize: 12, opacity: 0.65, marginTop: 6 }}>
                    {stats.present}P · {stats.absent}A · {stats.late}L · {stats.excused}E of {stats.total} sessions
                  </div>
                </div>
                <div style={{
                  width: 64, height: 64, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 28,
                }}>
                  {pct >= 75 ? '🟢' : pct >= 50 ? '🟡' : '🔴'}
                </div>
              </div>
              <div style={{ marginTop: 14, background: 'rgba(255,255,255,0.15)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${pct}%`, borderRadius: 4,
                  background: pct >= 75 ? '#22C55E' : pct >= 50 ? '#F59E0B' : '#EF4444',
                  transition: 'width 0.6s ease',
                }} />
              </div>
              {pct < 75 && (
                <div style={{ fontSize: 11, marginTop: 8, opacity: 0.85, color: '#FEF3C7' }}>
                  ⚠️ Attendance below 75% — contact school.
                </div>
              )}
            </div>
          )}

          {/* Stats Cards */}
          {stats.total > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
              {[
                { label: 'Present', value: stats.present, color: '#16A34A', bg: '#F0FDF4' },
                { label: 'Absent',  value: stats.absent,  color: '#DC2626', bg: '#FEF2F2' },
                { label: 'Late',    value: stats.late,    color: '#D97706', bg: '#FFF7ED' },
                { label: 'Excused', value: stats.excused, color: '#7C3AED', bg: '#F5F3FF' },
              ].map((s) => (
                <div key={s.label} style={{ background: s.bg, borderRadius: 12, padding: '10px 6px', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 9, color: s.color, fontWeight: 600 }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Records */}
          {report.length > 0 ? (
            <div className="m-card">
              <div className="m-card-header">
                <div className="m-card-title">Session Records</div>
                <span className="m-badge m-badge-neutral">{report.length} records</span>
              </div>
              {displayedRecords.map((r, i) => {
                const sc = STATUS_COLOR[r.status] || STATUS_COLOR.present;
                return (
                  <div key={r._id || i} className="m-list-item">
                    <div className="m-list-icon" style={{ background: sc.bg, color: sc.color, fontSize: 16 }}>
                      {sc.icon}
                    </div>
                    <div className="m-list-body">
                      <div className="m-list-title">{dayjs(r.date).format('DD MMM YYYY')}</div>
                      <div className="m-list-desc">{r.session || 'Full Day'}</div>
                    </div>
                    <span className="m-badge" style={{ background: sc.bg, color: sc.color }}>
                      {sc.label}
                    </span>
                  </div>
                );
              })}
              {report.length > 30 && !showAll && (
                <button
                  className="m-btn m-btn-ghost"
                  style={{ marginTop: 10, fontSize: 13 }}
                  onClick={() => setShowAll(true)}
                >
                  Show all {report.length} records
                </button>
              )}
            </div>
          ) : !error && (
            <div className="m-empty">
              <div className="m-empty-icon">📋</div>
              <div className="m-empty-text">No attendance records for this period</div>
            </div>
          )}
        </>
      )}
    </ParentLayout>
  );
};

export default ParentAttendance;
