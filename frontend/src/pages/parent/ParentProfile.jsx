import React, { useState, useEffect } from 'react';
import ParentLayout from '@/components/mobile/ParentLayout';
import { parentAPI } from '@/services/api';
import useAuthStore from '@/store/authStore';
import ChangePassword from '@/components/mobile/ChangePassword';
import { useNavigate } from 'react-router-dom';

const ParentProfile = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [showLogout, setShowLogout] = useState(false);
  const [showCp, setShowCp] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [parentData, setParentData] = useState(null);

  // Form state — editable fields only
  const [form, setForm] = useState({ phone: '', email: '', address: '', occupation: '' });

  const initials = (user?.name || 'P')
    .split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  // Resolve parent profile from linkedEntity (set at login)
  useEffect(() => {
    const linked = user?.linkedEntity;
    if (linked) {
      setParentData(linked);
      setForm({
        phone: linked.phone || '',
        email: linked.email || '',
        address: linked.address || '',
        occupation: linked.occupation || '',
      });
    } else {
      // Fallback: user object has partial info
      setForm({
        phone: user?.phone || '',
        email: user?.email || '',
        address: '',
        occupation: '',
      });
    }
  }, [user]);

  const validate = () => {
    if (form.phone && form.phone.length < 7) {
      setMsg({ type: 'error', text: 'Phone must be at least 7 digits.' }); return false;
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setMsg({ type: 'error', text: 'Invalid email address.' }); return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await parentAPI.updateMyProfile(form);
      const updated = res?.data || res;
      setParentData(updated);
      setMsg({ type: 'success', text: '✅ Profile updated successfully!' });
      setEditing(false);
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Update failed. Try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    const linked = user?.linkedEntity;
    setForm({
      phone: (linked?.phone || user?.phone) || '',
      email: (linked?.email || user?.email) || '',
      address: linked?.address || '',
      occupation: linked?.occupation || '',
    });
    setEditing(false);
    setMsg(null);
  };

  const READONLY_FIELDS = [
    { label: 'Full Name', value: parentData?.name || user?.name, icon: '👤', note: 'Cannot be changed' },
    { label: 'User Role', value: user?.role?.replace('_', ' ').toUpperCase() || 'PARENT', icon: '🏷️', note: 'Set by admin' },
  ];

  const linkedStudents = parentData?.linkedStudents || user?.linkedEntity?.linkedStudents || [];

  return (
    <ParentLayout >

      {/* Alert */}
      {msg && (
        <div className={`m-alert m-alert-${msg.type === 'success' ? 'success' : 'error'}`}>
          {msg.text}
          <button onClick={() => setMsg(null)}
            style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>✕</button>
        </div>
      )}

      {/* Avatar */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 8, paddingBottom: 20 }}>
        <div className="m-avatar" style={{ width: 80, height: 80, fontSize: 30, marginBottom: 12 }}>{initials}</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#0F172A' }}>{user?.name}</div>
        <div style={{ fontSize: 12, color: '#64748B', marginTop: 3 }}>{user?.email}</div>
        <span className="m-badge m-badge-info" style={{ marginTop: 8 }}>
          {user?.role?.replace('_', ' ')?.toUpperCase() || 'PARENT'}
        </span>
      </div>

      {/* Read-only Fields */}
      <div className="m-card">
        <div className="m-card-header">
          <div className="m-card-title">Account Details</div>
          <span className="m-badge m-badge-neutral" style={{ fontSize: 10 }}>🔒 Admin-managed</span>
        </div>
        {READONLY_FIELDS.map((f) => (
          <div key={f.label} className="m-list-item">
            <div className="m-list-icon" style={{ background: '#F8FAFC', fontSize: 18 }}>{f.icon}</div>
            <div className="m-list-body">
              <div className="m-list-desc">{f.label}</div>
              <div className="m-list-title">{f.value || '—'}</div>
            </div>
            <div style={{ fontSize: 10, color: '#94A3B8' }}>{f.note}</div>
          </div>
        ))}
      </div>

      {/* Editable Fields */}
      <div className="m-card">
        <div className="m-card-header" style={{ marginBottom: editing ? 16 : 10 }}>
          <div className="m-card-title">Contact Information</div>
          {!editing && (
            <button
              className="m-badge m-badge-info"
              style={{ cursor: 'pointer', border: 'none', fontSize: 12 }}
              onClick={() => { setEditing(true); setMsg(null); }}
            >
              ✏️ Edit
            </button>
          )}
        </div>

        {editing ? (
          <>
            <div className="m-form-group">
              <label className="m-label">Phone Number</label>
              <input className="m-input" type="tel" placeholder="e.g. 9876543210"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="m-form-group">
              <label className="m-label">Email Address</label>
              <input className="m-input" type="email" placeholder="e.g. parent@email.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="m-form-group">
              <label className="m-label">Home Address</label>
              <textarea className="m-input" placeholder="House no., Street, City..."
                rows={3} style={{ resize: 'vertical', minHeight: 72 }}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="m-form-group" style={{ marginBottom: 16 }}>
              <label className="m-label">Occupation <span style={{ color: '#94A3B8', fontWeight: 400 }}>(optional)</span></label>
              <input className="m-input" placeholder="e.g. Engineer"
                value={form.occupation}
                onChange={(e) => setForm({ ...form, occupation: e.target.value })} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="m-btn m-btn-primary" style={{ flex: 2 }} onClick={handleSave} disabled={saving}>
                {saving ? '⏳ Saving...' : '💾 Save Changes'}
              </button>
              <button className="m-btn m-btn-ghost" style={{ flex: 1 }} onClick={handleCancel} disabled={saving}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            {[
              { label: 'Phone', value: parentData?.phone || user?.phone, icon: '📱' },
              { label: 'Email', value: parentData?.email || user?.email, icon: '✉️' },
              { label: 'Address', value: parentData?.address, icon: '🏠' },
              { label: 'Occupation', value: parentData?.occupation, icon: '💼' },
            ].map((f) => (
              <div key={f.label} className="m-list-item">
                <div className="m-list-icon" style={{ background: '#F8FAFC', fontSize: 18 }}>{f.icon}</div>
                <div className="m-list-body">
                  <div className="m-list-desc">{f.label}</div>
                  <div className="m-list-title" style={{ color: f.value ? '#0F172A' : '#94A3B8' }}>
                    {f.value || '—'}
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Linked Students */}
      {linkedStudents.length > 0 && (
        <div className="m-card">
          <div className="m-card-title" style={{ marginBottom: 10 }}>Linked Students</div>
          {linkedStudents.map((s) => (
            <div key={s._id} className="m-list-item">
              <div className="m-avatar-sm">{(s.name || 'S')[0].toUpperCase()}</div>
              <div className="m-list-body">
                <div className="m-list-title">{s.name}</div>
                <div className="m-list-desc">
                  {s.classId?.name || ''}{s.rollNo ? ` · Roll: ${s.rollNo}` : ''}
                </div>
              </div>
              <span className="m-badge m-badge-success">Active</span>
            </div>
          ))}
        </div>
      )}

      {/* App Info */}
      <div className="m-card">
        <div className="m-card-title" style={{ marginBottom: 10 }}>App Info</div>
        {[
          { icon: '📱', label: 'Version', value: 'VMS ERP Parent App v1.0' },
          { icon: '🔒', label: 'Session', value: 'Active • Secured with JWT' },
          { icon: '📶', label: 'PWA Mode', value: 'Progressive Web App' },
        ].map((f) => (
          <div key={f.label} className="m-list-item">
            <div className="m-list-icon" style={{ background: 'var(--color-primary-light)', fontSize: 18 }}>{f.icon}</div>
            <div className="m-list-body">
              <div className="m-list-desc">{f.label}</div>
              <div className="m-list-title">{f.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Privacy Policy */}
      <div className="m-card" style={{ marginTop: 0 }}>
        <button
          style={{ display: 'flex', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, alignItems: 'center' }}
          onClick={() => navigate('/parent/privacy-policy')}
        >
          <span style={{ fontSize: 14, fontWeight: 700, color: '#1E293B' }}>📄 Privacy Policy</span>
          <span style={{ color: '#94A3B8' }}>➔</span>
        </button>
      </div>

      {/* Change Password */}
      <div className="m-card" style={{ marginTop: 0 }}>
        <button
          style={{ display: 'flex', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, alignItems: 'center' }}
          onClick={() => setShowCp((p) => !p)}
          id="parent-change-password-toggle"
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

      {/* Logout */}
      {!showLogout ? (
        <button
          className="m-btn m-btn-outline"
          style={{ borderColor: '#EF4444', color: '#EF4444', marginTop: 8 }}
          onClick={() => setShowLogout(true)}
        >
          🚪 Sign Out
        </button>
      ) : (
        <div className="m-card" style={{ borderLeft: '3px solid #EF4444' }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
            Are you sure you want to sign out?
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="m-btn m-btn-danger" style={{ flex: 1 }} onClick={logout}>
              Yes, Sign Out
            </button>
            <button className="m-btn m-btn-ghost" style={{ flex: 1 }} onClick={() => setShowLogout(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </ParentLayout>
  );
};

export default ParentProfile;