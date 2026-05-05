import React, { useState, useEffect } from 'react';
import FacultyLayout from '@/components/mobile/FacultyLayout';
import useAuthStore from '@/store/authStore';
import ChangePassword from '@/components/mobile/ChangePassword';
import { facultyAPI } from '@/services/api';

const FacultyProfile = () => {
  const { user, logout, setUser } = useAuthStore();
  const [showLogout, setShowLogout] = useState(false);
  const [showCp, setShowCp] = useState(false);
  const [uploading, setUploading] = useState(false);
  // const [avatarUrl, setAvatarUrl] = useState(user?.avatar || user?.metadata?.avatar || null);

  const avatarUrl = user?.avatar || user?.metadata?.avatar;

  // useEffect(() => {
  //   const url = user?.avatar || user?.metadata?.avatar || null;
  //   setAvatarUrl(url);
  // }, [user]);


  const initials = (user?.name || 'F')
    .split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  const fields = [
    { label: 'Full Name', value: user?.name, icon: '👤' },
    { label: 'Email', value: user?.email, icon: '✉️' },
    { label: 'Phone', value: user?.phone || '—', icon: '📱' },
    { label: 'Role', value: user?.role?.replace('_', ' ')?.toUpperCase() || 'FACULTY', icon: '🏷️' },
    { label: 'Employee ID', value: user?.employeeId || user?.metadata?.employeeId || '—', icon: '🪪' },
    { label: 'Department', value: user?.department || user?.metadata?.department || '—', icon: '🏫' },
  ];

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const token = localStorage.getItem('vms_token');
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload?folder=faculty', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Upload failed');
      const url = json.data?.url || json.url;
      setAvatarUrl(url);
      // Persist to DB if we know the faculty ID
      const facultyId = user?._id || user?.metadata?._id;
      if (facultyId) {
        await facultyAPI.update(facultyId, { avatar: url });

        // 🔥 UPDATE LOCAL USER STATE
        const updatedUser = {
          ...user,
          avatar: url,
          metadata: {
            ...user?.metadata,
            avatar: url,
          },
        };

        setUser(updatedUser);
        localStorage.setItem('vms_user', JSON.stringify(updatedUser));
      }
    } catch (err) {
      console.error('Photo upload failed:', err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <FacultyLayout title="My Profile" subtitle="Faculty account">
      {/* Avatar with upload */}
      <div style={{ textAlign: 'center', padding: '8px 0 20px' }}>
        <div style={{ position: 'relative', display: 'inline-block', marginBottom: 12 }}>
          {avatarUrl ? (
            <img
              src={`${avatarUrl}?t=${Date.now()}`}
              alt={user?.name}
              style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                objectFit: 'cover',
                border: '3px solid #E2E8F0'
              }}
            />
          ) : (
            <div className="m-avatar" style={{ width: 80, height: 80, fontSize: 28, margin: '0 auto' }}>
              {initials}
            </div>
          )}
          {/* Upload overlay */}
          <label
            htmlFor="faculty-photo-upload"
            style={{
              position: 'absolute', bottom: 0, right: 0,
              background: uploading ? '#94A3B8' : '#2563EB',
              borderRadius: '50%', width: 24, height: 24,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: uploading ? 'wait' : 'pointer',
              border: '2px solid #fff', fontSize: 12,
            }}
            title="Change photo"
          >
            {uploading ? '⏳' : '📷'}
          </label>
          <input
            id="faculty-photo-upload"
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handlePhotoUpload}
            disabled={uploading}
          />
        </div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{user?.name}</div>
        <div style={{ fontSize: 12, color: '#64748B', marginTop: 3 }}>{user?.email}</div>
        <span className="m-badge m-badge-info" style={{ marginTop: 8 }}>
          {user?.role?.replace('_', ' ')?.toUpperCase() || 'FACULTY'}
        </span>
        {avatarUrl && (
          <div style={{ fontSize: 11, color: '#22C55E', marginTop: 4 }}>✓ Photo uploaded</div>
        )}
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
        ℹ️ Profile changes must be made by the admin. You can update your photo above.
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

