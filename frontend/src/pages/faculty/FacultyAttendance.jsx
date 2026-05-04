import React, { useEffect, useState, useCallback, useRef } from 'react';
import FacultyLayout from '@/components/mobile/FacultyLayout';
import { attendanceAPI, schoolAPI, studentAPI } from '@/services/api';
import useAuthStore from '@/store/authStore';
import dayjs from 'dayjs';

const STATUS_OPTIONS = ['present', 'absent', 'late', 'excused'];

const STATUS_STYLE = {
  present: { bg: '#DCFCE7', color: '#16A34A', label: 'P', full: 'Present' },
  absent:  { bg: '#FEE2E2', color: '#DC2626', label: 'A', full: 'Absent'  },
  late:    { bg: '#FEF3C7', color: '#D97706', label: 'L', full: 'Late'    },
  excused: { bg: '#EDE9FE', color: '#7C3AED', label: 'E', full: 'Excused' },
};

// ─── Lock Confirmation Modal ─────────────────────────────────
const LockConfirmModal = ({ classLabel, date, session, onConfirm, onCancel, loading }) => (
  <div style={{
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    zIndex: 1000, padding: '0 0 var(--safe-bottom, 0)',
  }}>
    <div style={{
      background: '#fff', borderRadius: '20px 20px 0 0', padding: '24px 20px 32px',
      width: '100%', maxWidth: 480,
      animation: 'mFadeIn 0.25s ease-out',
    }}>
      <div style={{ width: 40, height: 4, background: '#E2E8F0', borderRadius: 2, margin: '0 auto 20px' }} />
      <div style={{ fontSize: 20, fontWeight: 800, textAlign: 'center', marginBottom: 8 }}>🔒 Lock Attendance?</div>
      <div style={{ fontSize: 13, color: '#64748B', textAlign: 'center', marginBottom: 20, lineHeight: 1.6 }}>
        This will <strong>permanently lock</strong> attendance for:<br />
        <strong>{classLabel}</strong> · {dayjs(date).format('DD MMM YYYY')} · {session || 'All sessions'}
        <br /><br />
        <span style={{ color: '#DC2626', fontSize: 12 }}>
          ⚠️ Locked records can only be changed by an administrator.
        </span>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          className="m-btn m-btn-ghost"
          style={{ flex: 1 }}
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </button>
        <button
          className="m-btn m-btn-danger"
          style={{ flex: 2 }}
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? 'Locking...' : '🔒 Yes, Lock It'}
        </button>
      </div>
    </div>
  </div>
);

const FacultyAttendance = () => {
  const user = useAuthStore((s) => s.user);
  const isAdmin = ['super_admin', 'admin', 'principal'].includes(user?.role);

  const [classes,         setClasses]         = useState([]);
  const [sessions,        setSessions]        = useState([]);
  const [selectedClass,   setSelectedClass]   = useState('');
  const [selectedSession, setSelectedSession] = useState('');
  const [date,            setDate]            = useState(dayjs().format('YYYY-MM-DD'));
  const [students,        setStudents]        = useState([]);
  const [attendance,      setAttendance]      = useState({});
  const [loading,         setLoading]         = useState(false);
  const [loadError,       setLoadError]       = useState(null);
  const [submitting,      setSubmitting]      = useState(false);
  const [locking,         setLocking]         = useState(false);
  const [msg,             setMsg]             = useState(null);
  const [saved,           setSaved]           = useState(false);
  const [alreadyLocked,   setAlreadyLocked]   = useState(false);
  const [showLockModal,   setShowLockModal]   = useState(false);

  // track search
  const [search, setSearch] = useState('');

  useEffect(() => { loadClasses(); loadSessions(); }, []);

  useEffect(() => {
    if (selectedClass) {
      setSaved(false);
      setAlreadyLocked(false);
      loadStudents(selectedClass);
    }
  }, [selectedClass]);

  // Reload existing attendance when class/date/session changes
  useEffect(() => {
    if (selectedClass && date) loadExisting();
  }, [selectedClass, selectedSession, date]);

  const loadClasses = async () => {
    try {
      const res = await schoolAPI.getClasses();
      setClasses(res?.data || []);
    } catch {}
  };

  const loadSessions = async () => {
    try {
      const res = await attendanceAPI.getSessions();
      const s   = res?.data?.sessions || res?.data || [];
      setSessions(s);
      if (s.length > 0) setSelectedSession(s[0].name || s[0]);
    } catch {}
  };

  const loadStudents = async (classId) => {
    setLoading(true);
    setLoadError(null);
    try {
      const res  = await studentAPI.getAll({ classId, isActive: true, limit: 200 });
      const list = res?.data?.students || res?.data || [];
      setStudents(list);
      // Default everyone to Present
      const defaults = {};
      list.forEach((s) => { defaults[s._id] = 'present'; });
      setAttendance(defaults);
    } catch (e) {
      setLoadError(e.message || 'Failed to load students.');
    } finally {
      setLoading(false);
    }
  };

  const loadExisting = async () => {
    if (!selectedClass) return;
    try {
      const res     = await attendanceAPI.getByDate({ classId: selectedClass, date, session: selectedSession || undefined });
      const records = res?.data || [];
      if (records.length > 0) {
        const map = {};
        records.forEach((r) => {
          const sid = r.studentId?._id || r.studentId;
          map[sid] = r.status;
        });
        setAttendance((prev) => ({ ...prev, ...map }));
        const isLocked = records.some((r) => r.locked === true);
        setAlreadyLocked(isLocked);
        if (isLocked) setSaved(true);
      } else {
        setAlreadyLocked(false);
      }
    } catch {}
  };

  const markAll = (status) => {
    if (alreadyLocked) return;
    const updated = {};
    students.forEach((s) => { updated[s._id] = status; });
    setAttendance(updated);
  };

  const toggleStatus = (studentId) => {
    if (alreadyLocked) return;
    const current = attendance[studentId] || 'present';
    const next    = STATUS_OPTIONS[(STATUS_OPTIONS.indexOf(current) + 1) % STATUS_OPTIONS.length];
    setAttendance((prev) => ({ ...prev, [studentId]: next }));
  };

  const handleSave = async () => {
    if (!selectedClass || students.length === 0) {
      setMsg({ type: 'error', text: 'Select a class with students.' }); return;
    }
    setSubmitting(true);
    setMsg(null);
    try {
      const records = students.map((s) => ({
        studentId: s._id,
        classId:   selectedClass,
        date,
        status:  attendance[s._id] || 'present',
        session: selectedSession || 'morning',
      }));
      await attendanceAPI.mark({ records });
      setSaved(true);
      setMsg({ type: 'success', text: `✅ Saved attendance for ${records.length} students.` });
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Failed to save. Try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleLockConfirmed = async () => {
    setLocking(true);
    try {
      await attendanceAPI.lock({ classId: selectedClass, date, session: selectedSession || undefined });
      setAlreadyLocked(true);
      setShowLockModal(false);
      setMsg({ type: 'success', text: '🔒 Attendance locked successfully.' });
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Lock failed. You may not have permission.' });
      setShowLockModal(false);
    } finally {
      setLocking(false);
    }
  };

  const selectedClassLabel = classes.find((c) => c._id === selectedClass)?.name || '';

  const presentCount = Object.values(attendance).filter((v) => v === 'present').length;
  const absentCount  = Object.values(attendance).filter((v) => v === 'absent').length;
  const lateCount    = Object.values(attendance).filter((v) => v === 'late').length;
  const excusedCount = Object.values(attendance).filter((v) => v === 'excused').length;

  const filteredStudents = search
    ? students.filter((s) => s.name?.toLowerCase().includes(search.toLowerCase()) || String(s.rollNo).includes(search))
    : students;

  return (
    <FacultyLayout title="Mark Attendance" subtitle={dayjs(date).format('dddd, DD MMM')}>

      {/* ─── Lock Confirmation Modal ─── */}
      {showLockModal && (
        <LockConfirmModal
          classLabel={selectedClassLabel}
          date={date}
          session={selectedSession}
          onConfirm={handleLockConfirmed}
          onCancel={() => setShowLockModal(false)}
          loading={locking}
        />
      )}

      {/* ─── Filters ─── */}
      <div className="m-card">
        <div className="m-form-group">
          <label className="m-label">Class</label>
          <select
            className="m-select"
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
          >
            <option value="">— Select Class —</option>
            {classes.map((c) => (
              <option key={c._id} value={c._id}>{c.name}{c.code ? ` (${c.code})` : ''}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="m-form-group" style={{ marginBottom: 0 }}>
            <label className="m-label">Date</label>
            <input
              className="m-input" type="date" value={date}
              onChange={(e) => { setDate(e.target.value); setSaved(false); }}
              max={dayjs().format('YYYY-MM-DD')}
            />
          </div>
          <div className="m-form-group" style={{ marginBottom: 0 }}>
            <label className="m-label">Session</label>
            <select
              className="m-select"
              value={selectedSession}
              onChange={(e) => { setSelectedSession(e.target.value); setSaved(false); }}
            >
              {sessions.length > 0
                ? sessions.map((s, i) => <option key={i} value={s.name || s}>{s.name || s}</option>)
                : <option value="morning">Morning</option>
              }
            </select>
          </div>
        </div>
      </div>

      {/* ─── Messages ─── */}
      {msg && (
        <div className={`m-alert m-alert-${msg.type === 'success' ? 'success' : 'error'}`}>
          {msg.text}
          <button onClick={() => setMsg(null)}
            style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>✕</button>
        </div>
      )}

      {/* ─── Locked State Banner ─── */}
      {alreadyLocked && (
        <div style={{
          background: '#0F172A', color: '#fff', borderRadius: 12, padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12,
        }}>
          <span style={{ fontSize: 24 }}>🔒</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Attendance Locked</div>
            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>
              {isAdmin ? 'You can still edit — admin override active.' : 'Contact an admin to make changes.'}
            </div>
          </div>
          {isAdmin && (
            <span className="m-badge" style={{ background: '#2563EB', color: '#fff', fontSize: 10 }}>ADMIN</span>
          )}
        </div>
      )}

      {/* ─── Load Error ─── */}
      {!loading && loadError && (
        <div className="m-card" style={{ borderLeft: '3px solid #EF4444', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: '#DC2626', marginBottom: 10 }}>{loadError}</div>
          <button className="m-btn m-btn-outline" onClick={() => loadStudents(selectedClass)}>Retry</button>
        </div>
      )}

      {/* ─── Student List ─── */}
      {selectedClass && !loadError && (
        <>
          {/* Stats + Bulk */}
          {students.length > 0 && (
            <div className="m-card" style={{ padding: '12px 14px' }}>
              {/* Stats row */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 10, justifyContent: 'space-around' }}>
                {[
                  { label: 'P', count: presentCount, color: '#16A34A', bg: '#DCFCE7' },
                  { label: 'A', count: absentCount,  color: '#DC2626', bg: '#FEE2E2' },
                  { label: 'L', count: lateCount,    color: '#D97706', bg: '#FEF3C7' },
                  { label: 'E', count: excusedCount, color: '#7C3AED', bg: '#EDE9FE' },
                ].map((s) => (
                  <div key={s.label} style={{ textAlign: 'center', flex: 1, background: s.bg, borderRadius: 10, padding: '8px 4px' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.count}</div>
                    <div style={{ fontSize: 10, color: s.color, fontWeight: 600 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Bulk Buttons */}
              <div style={{ display: 'flex', gap: 6 }}>
                {STATUS_OPTIONS.map((st) => {
                  const ss = STATUS_STYLE[st];
                  return (
                    <button
                      key={st}
                      style={{ flex: 1, padding: '6px 2px', fontSize: 11, fontWeight: 700, borderRadius: 8, background: ss.bg, color: ss.color, border: 'none', cursor: alreadyLocked && !isAdmin ? 'default' : 'pointer', opacity: alreadyLocked && !isAdmin ? 0.5 : 1 }}
                      onClick={() => markAll(st)}
                      disabled={alreadyLocked && !isAdmin}
                    >
                      All {ss.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Search */}
          {students.length > 5 && (
            <div className="m-form-group">
              <input className="m-input" placeholder="🔍 Search student..." value={search}
                onChange={(e) => setSearch(e.target.value)} />
            </div>
          )}

          {/* Student Cards */}
          {loading ? (
            <div className="m-spinner" />
          ) : filteredStudents.length > 0 ? (
            <div className="m-card" style={{ padding: '0 14px' }}>
              {filteredStudents.map((s) => {
                const status = attendance[s._id] || 'present';
                const sc     = STATUS_STYLE[status];
                const canEdit = !alreadyLocked || isAdmin;
                return (
                  <div key={s._id} className="m-list-item" style={{ alignItems: 'center' }}>
                    <div className="m-avatar-sm">{(s.name || 'S')[0].toUpperCase()}</div>
                    <div className="m-list-body">
                      <div className="m-list-title">{s.name}</div>
                      <div className="m-list-desc">Roll: {s.rollNo || '—'}</div>
                    </div>
                    <button
                      title={`Click to cycle: ${STATUS_OPTIONS.join(' → ')}`}
                      onClick={() => canEdit && toggleStatus(s._id)}
                      style={{
                        width: 44, height: 44, borderRadius: 10,
                        background: sc.bg, color: sc.color, border: 'none',
                        fontWeight: 800, fontSize: 15,
                        cursor: canEdit ? 'pointer' : 'not-allowed',
                        flexShrink: 0,
                        opacity: canEdit ? 1 : 0.6,
                        transition: 'transform 0.1s',
                      }}
                      onMouseDown={(e) => canEdit && (e.currentTarget.style.transform = 'scale(0.9)')}
                      onMouseUp={(e)   => (e.currentTarget.style.transform = 'scale(1)')}
                    >
                      {sc.label}
                    </button>
                  </div>
                );
              })}
              {search && filteredStudents.length === 0 && (
                <div className="m-empty" style={{ padding: '20px' }}>
                  <div className="m-empty-text">No match for "{search}"</div>
                </div>
              )}
            </div>
          ) : students.length === 0 && !loading ? (
            <div className="m-empty">
              <div className="m-empty-icon">👨‍🎓</div>
              <div className="m-empty-text">No active students in this class</div>
            </div>
          ) : null}

          {/* Action Buttons */}
          {students.length > 0 && (
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              {/* Save button: always visible, disabled if locked and not admin */}
              <button
                className="m-btn m-btn-primary"
                style={{ flex: 2 }}
                onClick={handleSave}
                disabled={submitting || (alreadyLocked && !isAdmin)}
              >
                {submitting ? '⏳ Saving...' : alreadyLocked && !isAdmin ? '🔒 Locked' : '💾 Save Attendance'}
              </button>

              {/* Lock button: show after save OR for admin override */}
              {(saved || isAdmin) && !alreadyLocked && (
                <button
                  className="m-btn m-btn-outline"
                  style={{ flex: 1, borderColor: '#EF4444', color: '#EF4444' }}
                  onClick={() => setShowLockModal(true)}
                  disabled={locking}
                >
                  🔒 Lock
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* ─── No Class Selected ─── */}
      {!selectedClass && (
        <div className="m-empty">
          <div className="m-empty-icon">📋</div>
          <div className="m-empty-text">Select a class to start marking</div>
        </div>
      )}
    </FacultyLayout>
  );
};

export default FacultyAttendance;
