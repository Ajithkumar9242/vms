import React, { useEffect, useState, useCallback } from 'react';
import ParentLayout from '@/components/mobile/ParentLayout';
import useAuthStore from '@/store/authStore';
import { vaultAPI } from '@/services/api';
import dayjs from 'dayjs';

const ParentDocuments = () => {
  const user = useAuthStore((s) => s.user);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [studentId, setStudentId] = useState(null);

  // Extract student ID from user's linked entity
  useEffect(() => {
    const linked = user?.linkedEntity?.linkedStudents?.[0] || user?.linkedStudents?.[0];
    const sid = typeof linked === 'string' ? linked : linked?._id || null;
    if (sid) {
      setStudentId(sid);
    } else {
      setLoading(false); // No student linked
    }
  }, [user]);

  const load = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    setMsg(null);
    try {
      const res = await vaultAPI.getMyFiles({ studentId });
      setFiles(res.data || []);
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Failed to load documents' });
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ParentLayout title="My Documents" subtitle="Download approved school documents">

      {/* Messages */}
      {msg && (
        <div className={`m-alert m-alert-${msg.type === 'error' ? 'error' : 'success'}`}>
          {msg.text}
          <button onClick={() => setMsg(null)}
            style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>✕</button>
        </div>
      )}

      {loading && <div className="m-spinner" />}

      {!loading && files.length === 0 && (
        <div className="m-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📄</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', marginBottom: 4 }}>No documents yet</div>
          <div style={{ fontSize: 12, color: '#64748B' }}>Request documents from the Vault section.</div>
        </div>
      )}

      {!loading && files.map(file => {
        const isPdf = file.mimeType === 'application/pdf';

        // requiresApprovedRequest: check via requestId populated field
        const reqOk = !file.requiresApprovedRequest ||
          (file.requestId?.requestStatus === 'fulfilled' && file.requestId?.paymentStatus === 'paid');

        return (
          <div key={file._id} className="m-card" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>

            {/* Icon */}
            <div style={{
              width: 46, height: 46, borderRadius: 12,
              background: isPdf ? '#FEE2E2' : 'var(--color-primary-light)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22
            }}>
              {isPdf ? <span style={{ color: '#EF4444' }}>📄</span> : <span style={{ color: 'var(--color-secondary)' }}>🖼️</span>}
            </div>

            {/* Info */}
            <div style={{ flex: 1 }}>
              <div style={{ color: '#0F172A', fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                {file.title}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {file.catalogItemId && (
                  <span className="m-badge" style={{ background: '#F1F5F9', color: '#475569', fontSize: 10, padding: '2px 6px' }}>
                    {file.catalogItemId.name}
                  </span>
                )}
                <span style={{ color: '#64748B', fontSize: 11 }}>
                  {file.fileSize ? `${(file.fileSize / 1024).toFixed(0)} KB` : ''}
                </span>
                {file.issueDate && (
                  <span style={{ color: '#64748B', fontSize: 11 }}>
                    • {dayjs(file.issueDate).format('DD MMM YYYY')}
                  </span>
                )}
              </div>
            </div>

            {/* Download Button */}
            <a
              href={reqOk ? vaultAPI.getDownloadUrl(file._id) : undefined}
              target="_blank"
              rel="noreferrer"
              style={{ textDecoration: 'none', pointerEvents: reqOk ? 'auto' : 'none' }}
            >
              <button
                className={`m-btn ${reqOk ? 'm-btn-primary' : 'm-btn-ghost'}`}
                disabled={!reqOk}
                style={{
                  margin: 0,
                  padding: '6px 12px',
                  fontSize: 12,
                  borderRadius: 8,
                  background: reqOk ? '#22C55E' : '#E2E8F0',
                  color: reqOk ? '#FFF' : '#94A3B8',
                  border: 'none'
                }}
              >
                ⬇️ DL
              </button>
            </a>
          </div>
        );
      })}
    </ParentLayout>
  );
};

export default ParentDocuments;