import React, { useState } from 'react';
import { authAPI } from '@/services/api';

/**
 * ChangePassword — shared component for Parent + Faculty mobile apps.
 *
 * Props:
 *  onSuccess?: () => void   — optional callback after success
 *  className?: string       — wrapper class override
 */
const ChangePassword = ({ onSuccess, className }) => {
  const [form, setForm]     = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]       = useState(null);   // { type: 'success'|'error', text: string }
  const [show, setShow]     = useState({ old: false, new: false, confirm: false });

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setMsg(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg(null);

    // Client-side validation
    if (!form.oldPassword)        return setMsg({ type: 'error', text: 'Current password is required.' });
    if (!form.newPassword)        return setMsg({ type: 'error', text: 'New password is required.' });
    if (form.newPassword.length < 6) return setMsg({ type: 'error', text: 'New password must be at least 6 characters.' });
    if (form.newPassword !== form.confirmPassword)
      return setMsg({ type: 'error', text: 'New password and confirm password do not match.' });

    setLoading(true);
    try {
      await authAPI.changePassword({
        oldPassword:     form.oldPassword,
        newPassword:     form.newPassword,
        confirmPassword: form.confirmPassword,
      });
      setMsg({ type: 'success', text: '✅ Password changed successfully!' });
      setForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
      onSuccess?.();
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to change password.' });
    } finally {
      setLoading(false);
    }
  };

  const EyeIcon = ({ visible }) => (
    <span style={{ userSelect: 'none', cursor: 'pointer', fontSize: 16 }}>
      {visible ? '👁️' : '🙈'}
    </span>
  );

  const inputWrap = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: 10,
    padding: '12px 14px',
    marginTop: 4,
  };

  const inputStyle = {
    flex: 1,
    border: 'none',
    background: 'transparent',
    outline: 'none',
    fontSize: 15,
    color: '#1E293B',
  };

  const labelStyle = {
    fontSize: 12,
    fontWeight: 600,
    color: '#64748B',
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
    marginBottom: 2,
    display: 'block',
  };

  return (
    <div className={className} style={{ maxWidth: 420 }}>
      <form onSubmit={handleSubmit} autoComplete="off">
        {/* Old Password */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Current Password</label>
          <div style={inputWrap}>
            <input
              type={show.old ? 'text' : 'password'}
              value={form.oldPassword}
              onChange={handleChange('oldPassword')}
              placeholder="Enter current password"
              style={inputStyle}
              autoComplete="current-password"
              id="cp-old-password"
            />
            <button
              type="button"
              onClick={() => setShow((s) => ({ ...s, old: !s.old }))}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', marginLeft: 8 }}
              aria-label="Toggle old password visibility"
            >
              <EyeIcon visible={show.old} />
            </button>
          </div>
        </div>

        {/* New Password */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>New Password</label>
          <div style={inputWrap}>
            <input
              type={show.new ? 'text' : 'password'}
              value={form.newPassword}
              onChange={handleChange('newPassword')}
              placeholder="Min. 6 characters"
              style={inputStyle}
              autoComplete="new-password"
              id="cp-new-password"
            />
            <button
              type="button"
              onClick={() => setShow((s) => ({ ...s, new: !s.new }))}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', marginLeft: 8 }}
              aria-label="Toggle new password visibility"
            >
              <EyeIcon visible={show.new} />
            </button>
          </div>
        </div>

        {/* Confirm Password */}
        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle}>Confirm New Password</label>
          <div style={inputWrap}>
            <input
              type={show.confirm ? 'text' : 'password'}
              value={form.confirmPassword}
              onChange={handleChange('confirmPassword')}
              placeholder="Repeat new password"
              style={inputStyle}
              autoComplete="new-password"
              id="cp-confirm-password"
            />
            <button
              type="button"
              onClick={() => setShow((s) => ({ ...s, confirm: !s.confirm }))}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', marginLeft: 8 }}
              aria-label="Toggle confirm password visibility"
            >
              <EyeIcon visible={show.confirm} />
            </button>
          </div>
        </div>

        {/* Message */}
        {msg && (
          <div style={{
            padding: '10px 14px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 500,
            marginBottom: 14,
            background: msg.type === 'success' ? '#DCFCE7' : '#FEE2E2',
            color: msg.type === 'success' ? '#16A34A' : '#DC2626',
            border: `1px solid ${msg.type === 'success' ? '#86EFAC' : '#FECACA'}`,
          }}>
            {msg.text}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          id="cp-submit-btn"
          style={{
            width: '100%',
            padding: '13px 0',
            borderRadius: 10,
            border: 'none',
            background: loading ? '#93C5FD' : '#1677FF',
            color: '#fff',
            fontSize: 15,
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s',
          }}
        >
          {loading ? '⏳ Updating...' : '🔐 Change Password'}
        </button>
      </form>
    </div>
  );
};

export default ChangePassword;
