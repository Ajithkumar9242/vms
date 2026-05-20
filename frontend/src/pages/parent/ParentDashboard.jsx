import React, { useEffect, useState } from 'react';
import ParentLayout from '@/components/mobile/ParentLayout';
import { feesAPI, notificationAPI, studentAPI, materialAPI, hostelAPI } from '@/services/api';
import useAuthStore from '@/store/authStore';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
dayjs.extend(relativeTime);

const ParentDashboard = () => {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [studentId, setStudentId] = useState(null);
  const [classId, setClassId] = useState(null);
  const [feeData, setFeeData] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [hostelInfo, setHostelInfo] = useState(undefined); // undefined=loading, null=not allocated
  const [retryCount, setRetryCount] = useState(0);
  // Multi-child support
  const [linkedStudents, setLinkedStudents] = useState([]);
  const [selectedChildIdx, setSelectedChildIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);

      try {
        // ── Step 1: resolve student + classId ──────────────
        let sid = null;
        let cid = null;

        const allLinked = user?.linkedEntity?.linkedStudents || [];
        if (allLinked.length > 0) {
          setLinkedStudents(allLinked);
          const safeIdx = Math.min(selectedChildIdx, allLinked.length - 1);
          const linked = allLinked[safeIdx];
          sid = linked?._id;
          cid = linked?.classId?._id || linked?.classId || null;
        } else {
          sid = user?.studentId || user?.metadata?.studentId || null;
          cid = user?.classId || user?.metadata?.classId || null;
        }

        if (!sid) {
          const r = await studentAPI.getAll({ limit: 1 });
          const s = r?.data?.data?.students?.[0] || r?.data?.students?.[0] || r?.data?.[0];
          if (s) {
            sid = s._id;
            cid = s.classId?._id || s.classId || null;
          }
        }

        if (cancelled) return;

        if (sid) setStudentId(sid);
        if (cid) setClassId(cid);

        // ── Step 2: parallel fetch ─────────────────────────
        const [fees, notifs, mats, hostel] = await Promise.allSettled([
          sid ? feesAPI.getStudentFees(sid) : Promise.resolve(null),
          notificationAPI.getAll({ limit: 3 }),
          cid ? materialAPI.getByClass(cid) : Promise.resolve(null),
          sid ? hostelAPI.getMyHostelInfo(sid) : Promise.resolve(null),
        ]);

        if (cancelled) return;

        if (fees.status === 'fulfilled' && fees.value)
          setFeeData(fees.value?.data || fees.value);

        if (notifs.status === 'fulfilled' && notifs.value) {
          const d = notifs.value?.data;
          setNotifications(Array.isArray(d) ? d.slice(0, 3) : (d?.notifications?.slice(0, 3) || []));
        }

        if (mats.status === 'fulfilled' && mats.value) {
          const envelope = mats.value?.data;
          const payload = envelope?.data ?? envelope;
          const list = payload?.materials ?? (Array.isArray(payload) ? payload : []);
          setMaterials(list.filter(Boolean).slice(0, 8));
        }

        if (hostel.status === 'fulfilled') {
          // hostel.value may be null (not allocated) or an object with allocation info
          const h = hostel.value?.data ?? hostel.value;
          setHostelInfo(h ?? null);
        } else {
          setHostelInfo(null); // error - treat as not allocated
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load dashboard.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [user, retryCount, selectedChildIdx]);

  const handleRetry = () => setRetryCount((c) => c + 1);

  const summary = feeData?.summary;
  const feeConfigured = summary && summary.totalFee > 0;

  const quickLinks = [
    { label: 'Pay Fees', icon: '₹', to: '/parent/fees', color: 'var(--color-primary-light)' },
    { label: 'Attendance', icon: '📅', to: '/parent/attendance', color: '#F0FDF4' },
    { label: 'Exam Results', icon: '📊', to: '/parent/exams', color: '#FFF7ED' },
    { label: 'Notifications', icon: '🔔', to: '/parent/notifications', color: '#FDF4FF' },
    { label: 'Vault', icon: '📂', to: '/parent/vault', color: 'var(--color-primary-light)' },
    { label: 'My Requests', icon: '🧾', to: '/parent/requests', color: '#FEF3C7' },
    { label: 'My Docs', icon: '⬇️', to: '/parent/documents', color: '#FCE7F3' },
  ];

  return (
    <ParentLayout title="Parent Portal" subtitle={`Welcome back, ${user?.name?.split(' ')[0] || 'Parent'}`}>

      {loading && <div className="m-spinner" />}

      {!loading && error && (
        <div className="m-card" style={{ borderLeft: '3px solid #EF4444', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: '#DC2626', marginBottom: 10 }}>{error}</div>
          <button className="m-btn m-btn-outline" onClick={handleRetry}>Retry</button>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Multi-child switcher */}
          {linkedStudents.length > 1 && (
            <div style={{ padding: '0 4px 10px', overflowX: 'auto' }}>
              <div style={{ display: 'flex', gap: 8, minWidth: 'max-content' }}>
                {linkedStudents.map((child, idx) => (
                  <button
                    key={child._id || idx}
                    onClick={() => setSelectedChildIdx(idx)}
                    style={{
                      padding: '6px 14px', borderRadius: 20, border: 'none',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      background: selectedChildIdx === idx ? 'var(--color-primary)' : '#E2E8F0',
                      color: selectedChildIdx === idx ? '#fff' : '#374151',
                      transition: 'all 0.2s',
                    }}
                  >
                    {child.name || `Child ${idx + 1}`}
                    {child.classId?.name && (
                      <span style={{ fontWeight: 400, marginLeft: 4 }}>({child.classId.name})</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Hero */}
          <div className="m-hero" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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

          {/* Fee Summary */}
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

          {/* Hostel Info */}
          {hostelInfo !== undefined && studentId && (
            <>
              <div className="m-section-header">
                <span className="m-section-title">🏠 Hostel Info</span>
              </div>
              {hostelInfo && hostelInfo.allocated ? (
                <div className="m-card" style={{ borderLeft: '3px solid var(--color-primary)', marginBottom: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>Hostel / Block</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{hostelInfo.hostelName}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>Room Number</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{hostelInfo.roomNumber}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>Bed Number</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>Bed {hostelInfo.bedNumber}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>Status</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#16A34A' }}>{hostelInfo.status || 'Active'}</div>
                    </div>
                    {hostelInfo.floor && (
                      <div>
                        <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>Floor</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{hostelInfo.floor}</div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="m-card" style={{ textAlign: 'center', color: '#94A3B8', fontSize: 13, padding: '14px 0' }}>
                  Student is not assigned to hostel
                </div>
              )}
            </>
          )}

          {/* Study Materials */}
          {classId && (
            <>
              <div className="m-section-header">
                <span className="m-section-title">Study Materials</span>
              </div>

              {materials.length === 0 ? (
                <div className="m-card" style={{ textAlign: 'center', color: '#94A3B8', fontSize: 13, padding: '18px 0' }}>
                  No study materials posted for your class yet.
                </div>
              ) : (
                materials.map((m, i) => {
                  const fileList =
                    Array.isArray(m.files) && m.files.length > 0
                      ? m.files.filter((f) => f?.url)
                      : m.fileUrl
                        ? [{ url: m.fileUrl, name: m.fileName || 'File', type: m.mimeType || '' }]
                        : [];

                  return (
                    <div key={m._id || i} className="m-card" style={{ marginBottom: 8, padding: '10px 14px' }}>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{m.title}</div>
                      {m.description ? (
                        <div style={{ fontSize: 12, color: '#64748B', marginBottom: 6 }}>{m.description}</div>
                      ) : null}
                      {fileList.length === 0 ? (
                        <div style={{ fontSize: 12, color: '#94A3B8' }}>No files attached</div>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                          {fileList.map((f, fi) => {
                            const mime = (f.type || '').toLowerCase();
                            const ext = (f.url || '').split('?')[0];
                            const isImage = mime.includes('image') || /\.(jpe?g|png|gif|webp|svg)$/i.test(ext);
                            return isImage ? (
                              <a key={fi} href={f.url} target="_blank" rel="noreferrer">
                                <img
                                  src={f.url}
                                  alt={f.name || 'image'}
                                  style={{
                                    width: 60, height: 60, objectFit: 'cover',
                                    borderRadius: 6, border: '1px solid #E2E8F0', display: 'block',
                                  }}
                                />
                              </a>
                            ) : (
                              <a
                                key={fi} href={f.url} target="_blank" rel="noreferrer"
                                style={{
                                  fontSize: 12, color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: 4,
                                  background: 'var(--color-primary-light)', padding: '5px 10px', borderRadius: 4, textDecoration: 'none',
                                }}
                              >
                                &#128196; {f.name || `View File ${fi + 1}`}
                              </a>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </>
          )}

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
                  <div className="m-notif-dot" style={{ background: !n.isRead ? 'var(--color-primary)' : '#CBD5E1' }} />
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
