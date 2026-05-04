import React, { useState } from 'react';
import FacultyLayout from '@/components/mobile/FacultyLayout';
import useAuthStore from '@/store/authStore';
import ChangePassword from '@/components/mobile/ChangePassword';

const FacultyProfile = () => {
  const { user, logout } = useAuthStore();
  const [showLogout, setShowLogout] = useState(false);
  const [showCp, setShowCp] = useState(false);

  const initials = (user?.name || 'F')
    .split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  const fields = [
    { label: 'Full Name',    value: user?.name,   icon: '👤' },
    { label: 'Email',        value: user?.email,  icon: '✉️' },
    { label: 'Phone',        value: user?.phone || '—', icon: '📱' },
    { label: 'Role',         value: user?.role?.replace('_', ' ')?.toUpperCase() || 'FACULTY', icon: '🏷️' },
    { label: 'Employee ID',  value: user?.employeeId || user?.metadata?.employeeId || '—', icon: '🪪' },
    { label: 'Department',   value: user?.department || user?.metadata?.department || '—', icon: '🏫' },
  ];

  return (
    <FacultyLayout title="My Profile" subtitle="Faculty account">
      {/* Avatar */}
      <div style={{ textAlign: 'center', padding: '8px 0 20px' }}>
        <div className="m-avatar" style={{ width: 80, height: 80, fontSize: 28, margin: '0 auto 12px' }}>
          {initials}
        </div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{user?.name}</div>
        <div style={{ fontSize: 12, color: '#64748B', marginTop: 3 }}>{user?.email}</div>
        <span className="m-badge m-badge-info" style={{ marginTop: 8 }}>
          {user?.role?.replace('_', ' ')?.toUpperCase() || 'FACULTY'}
        </span>
      </div>

      {/* Details */}
      <div className="m-card">
        <div className="m-card-title" style={{ marginBottom: 10 }}>Account Details</div>
        {fields.map((f) => (
          <div key={f.label} className="m-list-item">
            <div className="m-list-icon" style={{ background: '#F8FAFC', fontSize: 18 }}>{f.icon}</div>
            <div className="m-list-body">
              <div className="m-list-desc">{f.label}</div>
              <div className="m-list-title">{f.value || '—'}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="m-alert m-alert-info" style={{ fontSize: 12 }}>
        ℹ️ Profile changes must be made by the admin.
      </div>

      {/* Change Password */}
      <div className="m-card" style={{ marginTop: 0 }}>
        <button
          style={{ display: 'flex', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, alignItems: 'center' }}
          onClick={() => setShowCp((p) => !p)}
          id="faculty-change-password-toggle"
        >
          <span style={{ fontSize: 14, fontWeight: 700, color: '#1E293B' }}>🔐 Change Password</span>
          <span style={{ color: '#94A3B8' }}>{showCp ? '▲' : '▼'}</span>
        </button>
        {showCp && (
          <div style={{ marginTop: 14 }}>
            <ChangePassword onSuccess={() => setShowCp(false)} />
          </div>
        )}
      </div>

      {!showLogout ? (
        <button className="m-btn m-btn-outline" style={{ borderColor: '#EF4444', color: '#EF4444', marginTop: 4 }}
          onClick={() => setShowLogout(true)}>
          🚪 Sign Out
        </button>
      ) : (
        <div className="m-card" style={{ borderLeft: '3px solid #EF4444' }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Sign out of Faculty Portal?</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="m-btn m-btn-danger" style={{ flex: 1 }} onClick={logout}>Yes, Sign Out</button>
            <button className="m-btn m-btn-ghost" style={{ flex: 1 }} onClick={() => setShowLogout(false)}>Cancel</button>
          </div>
        </div>
      )}
    </FacultyLayout>
  );
};

export default FacultyProfile;
