import React, { useEffect, useState, useCallback } from 'react';
import ParentLayout from '@/components/mobile/ParentLayout';
import { feesAPI, notificationAPI, studentAPI } from '@/services/api';
import useAuthStore from '@/store/authStore';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
dayjs.extend(relativeTime);

const ParentDashboard = () => {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [studentId, setStudentId] = useState(null);
  const [feeData, setFeeData]     = useState(null);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    resolveStudent();
  }, [user]);

  const resolveStudent = useCallback(async () => {
    setLoading(true);
    setError(null);
    // Use linkedEntity populated at login
    const linkedStudent = user?.linkedEntity?.linkedStudents?.[0];
    if (linkedStudent?._id) {
      setStudentId(linkedStudent._id);
      await loadDashboard(linkedStudent._id);
      return;
    }
    // Fallback: check metadata
    const sid = user?.studentId || user?.metadata?.studentId;
    if (sid) { setStudentId(sid); await loadDashboard(sid); return; }
    // Last resort: API call
    try {
      const res = await studentAPI.getAll({ limit: 1 });
      const s   = res?.data?.students?.[0] || res?.data?.[0];
      if (s) { setStudentId(s._id); await loadDashboard(s._id); }
      else { setError(null); setLoading(false); } // no student, show empty gracefully
    } catch (e) {
      setError(e.message || 'Failed to load data.');
      setLoading(false);
    }
  }, [user]);

  const loadDashboard = async (sid) => {
    setLoading(true);
    try {
      const [fees, notifs] = await Promise.allSettled([
        feesAPI.getStudentFees(sid),
        notificationAPI.getAll({ limit: 3 }),
      ]);
      if (fees.status   === 'fulfilled') setFeeData(fees.value?.data || fees.value);
      if (notifs.status === 'fulfilled') {
        const d = notifs.value?.data;
        setNotifications(Array.isArray(d) ? d.slice(0, 3) : (d?.notifications?.slice(0, 3) || []));
      }
    } catch (e) {
      setError(e.message || 'Failed to load dashboard.');
    } finally {
      setLoading(false);
    }
  };

  const summary      = feeData?.summary;
  const feeConfigured = summary && summary.totalFee > 0;

  const quickLinks = [
    { label: 'Pay Fees',    icon: '💳', to: '/parent/fees',         color: '#EFF6FF' },
    { label: 'Attendance',  icon: '📋', to: '/parent/attendance',    color: '#F0FDF4' },
    { label: 'Exam Results',icon: '📝', to: '/parent/exams',         color: '#FFF7ED' },
    { label: 'Notifications',icon:'🔔', to: '/parent/notifications',  color: '#FDF4FF' },
  ];

  return (
    <ParentLayout title="Parent Portal" subtitle={`Welcome back, ${user?.name?.split(' ')[0] || 'Parent'}`}>
      {loading && <div className="m-spinner" />}

      {!loading && error && (
        <div className="m-card" style={{ borderLeft: '3px solid #EF4444', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: '#DC2626', marginBottom: 10 }}>{error}</div>
          <button className="m-btn m-btn-outline" onClick={resolveStudent}>Retry</button>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Hero */}
          <div className="m-hero">
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div className="m-avatar">
                {(user?.name || 'P')[0].toUpperCase()}
              </div>
              <div>
                <div className="m-hero-name">{user?.name || 'Parent'}</div>
                <div className="m-hero-sub">{user?.email}</div>
                <div className="m-hero-sub" style={{ marginTop: 2 }}>
                  {dayjs().format('dddd, DD MMM YYYY')}
                </div>
              </div>
            </div>
          </div>

          {/* Fee Summary — only when configured */}
          {feeConfigured && summary && (
            <div className="m-card">
              <div className="m-card-header">
                <div>
                  <div className="m-card-title">Fee Summary</div>
                  <div className="m-card-sub">Current Academic Year</div>
                </div>
                <span className={`m-badge ${summary.status === 'Paid' ? 'm-badge-success' : summary.status === 'Partial' ? 'm-badge-warning' : 'm-badge-danger'}`}>
                  {summary.status}
                </span>
              </div>
              <div className="m-fee-summary">
                <div className="m-fee-box" style={{ background: '#F0FDF4' }}>
                  <div className="m-fee-box-amount" style={{ color: '#16A34A' }}>
                    ₹{(summary.totalPaid || 0).toLocaleString('en-IN')}
                  </div>
                  <div className="m-fee-box-label" style={{ color: '#16A34A' }}>Paid</div>
                </div>
                <div className="m-fee-box" style={{ background: '#FEF2F2' }}>
                  <div className="m-fee-box-amount" style={{ color: '#DC2626' }}>
                    ₹{(summary.totalDue || 0).toLocaleString('en-IN')}
                  </div>
                  <div className="m-fee-box-label" style={{ color: '#DC2626' }}>Due</div>
                </div>
              </div>
              <div className="m-progress-bar">
                <div
                  className="m-progress-fill"
                  style={{
                    width: summary.totalFee > 0 ? `${Math.round((summary.totalPaid / summary.totalFee) * 100)}%` : '0%',
                    background: 'linear-gradient(90deg, #22C55E, #16A34A)',
                  }}
                />
              </div>
              <div style={{ fontSize: 11, color: '#64748B', textAlign: 'right' }}>
                {summary.totalFee > 0 ? Math.round((summary.totalPaid / summary.totalFee) * 100) : 0}% paid of ₹{(summary.totalFee || 0).toLocaleString('en-IN')}
              </div>
            </div>
          )}

          {/* Quick Links */}
          <div className="m-section-header">
            <span className="m-section-title">Quick Access</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            {quickLinks.map((q) => (
              <button
                key={q.to}
                className="m-card"
                onClick={() => navigate(q.to)}
                style={{ background: q.color, cursor: 'pointer', border: 'none', textAlign: 'center', marginBottom: 0 }}
              >
                <div style={{ fontSize: 28, marginBottom: 6 }}>{q.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{q.label}</div>
              </button>
            ))}
          </div>

          {/* Recent Notifications */}
          {notifications.length > 0 && (
            <>
              <div className="m-section-header">
                <span className="m-section-title">Recent Alerts</span>
                <button className="m-section-link" onClick={() => navigate('/parent/notifications')}>View all</button>
              </div>
              {notifications.map((n, i) => (
                <div key={n._id || i} className={`m-notif-item${!n.isRead ? ' unread' : ''}`}
                  onClick={() => navigate('/parent/notifications')}>
                  <div className="m-notif-dot" style={{ background: !n.isRead ? '#2563EB' : '#CBD5E1' }} />
                  <div>
                    <div className="m-notif-title">{n.title}</div>
                    <div className="m-notif-body">{n.message}</div>
                    <div className="m-notif-time">{dayjs(n.createdAt).fromNow()}</div>
                  </div>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </ParentLayout>
  );
};

export default ParentDashboard;
