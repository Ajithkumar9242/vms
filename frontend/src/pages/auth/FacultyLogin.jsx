import React, { useState, useRef } from 'react';
import {
  Card, Form, Input, Button, Typography, Alert,
  Steps, Divider,
} from 'antd';
import {
  UserOutlined, SafetyCertificateOutlined,
  CheckCircleOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { authAPI } from '@/services/api';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '@/store/authStore';

const { Title, Text, Paragraph } = Typography;

/**
 * FacultyLogin — OTP-based login for faculty.
 * Uses /api/auth/faculty/otp/send + /verify
 * Redirects to /faculty/dashboard or /dashboard on success.
 */
const FacultyLogin = () => {
  const navigate = useNavigate();
  const setAuth  = useAuthStore((s) => s.setAuth);

  const [step, setStep]     = useState(0);
  const [phone, setPhone]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [resendCd, setResendCd] = useState(0);
  const [otp, setOtp]       = useState(['', '', '', '', '', '']);
  const otpRefs = useRef([]);

  const otpValue = otp.join('');

  const handleOtpChange = (index, value) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...otp];
    next[index] = value;
    setOtp(next);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
    if (!value && index > 0) otpRefs.current[index - 1]?.focus();
  };

  const startCountdown = () => {
    setResendCd(30);
    const interval = setInterval(() => {
      setResendCd(p => { if (p <= 1) { clearInterval(interval); return 0; } return p - 1; });
    }, 1000);
  };

  const handleSendOtp = async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 10) { setError('Please enter a valid 10-digit mobile number'); return; }
    setError('');
    setLoading(true);
    try {
      // Faculty-specific OTP endpoint
      await authAPI.sendFacultyOtp(digits);
      setStep(1);
      startCountdown();
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpValue.length !== 6) { setError('Please enter the complete 6-digit OTP'); return; }
    setError('');
    setLoading(true);
    try {
      const res  = await authAPI.verifyFacultyOtp(phone.replace(/\D/g, ''), otpValue);
      const data = res.data || res;
      const token = data.token || data.accessToken;
      if (!token) throw new Error('Token missing from verify response');

      setAuth(data.user, token);
      if (data.refreshToken) localStorage.setItem('vms_refresh_token', data.refreshToken);

      // Redirect to faculty dashboard
      navigate('/dashboard', { replace: true });
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Invalid OTP');
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCd > 0) return;
    setError('');
    setOtp(['', '', '', '', '', '']);
    setLoading(true);
    try {
      await authAPI.sendFacultyOtp(phone.replace(/\D/g, ''));
      startCountdown();
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Failed to resend');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0F172A 0%, #1B3A5C 50%, #2563EB 100%)',
      padding: '20px',
    }}>
      <Card style={{
        width: '100%',
        maxWidth: 420,
        borderRadius: 20,
        boxShadow: '0 24px 72px rgba(0,0,0,0.4)',
        overflow: 'hidden',
        border: '1px solid rgba(37,99,235,0.2)',
      }} bodyStyle={{ padding: '36px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 68, height: 68, borderRadius: 18,
            background: 'linear-gradient(135deg, #1B3A5C, #2563EB)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 8px 24px rgba(37,99,235,0.35)',
          }}>
            <UserOutlined style={{ color: '#fff', fontSize: 30 }} />
          </div>
          <Title level={3} style={{ margin: 0, color: '#1B3A5C' }}>Faculty Login</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {step === 0 ? 'Enter your registered mobile number' : 'Enter the OTP sent to your phone'}
          </Text>
        </div>

        {/* Steps */}
        <Steps current={step} size="small" style={{ marginBottom: 24 }}>
          <Steps.Step title="Mobile"   icon={<UserOutlined />} />
          <Steps.Step title="OTP"      icon={<SafetyCertificateOutlined />} />
          <Steps.Step title="Done"     icon={<CheckCircleOutlined />} />
        </Steps>

        {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}

        {/* Step 0: Phone */}
        {step === 0 && (
          <div>
            <Form layout="vertical" onFinish={handleSendOtp}>
              <Form.Item label="Mobile Number" style={{ marginBottom: 20 }}>
                <Input
                  size="large"
                  prefix={<UserOutlined style={{ color: '#94A3B8' }} />}
                  addonBefore="+91"
                  placeholder="9876543210"
                  value={phone}
                  onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  maxLength={10}
                  autoFocus
                  id="faculty-phone"
                />
              </Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                block
                size="large"
                loading={loading}
                style={{
                  borderRadius: 10, height: 48, fontSize: 15, fontWeight: 600,
                  background: 'linear-gradient(135deg, #1B3A5C, #2563EB)',
                  border: 'none',
                }}
                id="btn-faculty-send-otp"
              >
                Send OTP
              </Button>
            </Form>

            <Divider style={{ margin: '20px 0 16px' }} />
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Admin login?{' '}
                <a href="/login" style={{ color: '#2563EB' }}>Login with email</a>
              </Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Parent login?{' '}
                <a href="/parent-login" style={{ color: '#2563EB' }}>Parent OTP Login</a>
              </Text>
            </div>
          </div>
        )}

        {/* Step 1: OTP */}
        {step === 1 && (
          <div>
            <Paragraph style={{ textAlign: 'center', color: '#64748B', fontSize: 13, marginBottom: 24 }}>
              OTP sent to <strong>+91 {phone}</strong>. Valid for 5 minutes.
            </Paragraph>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 24 }}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={el => (otpRefs.current[i] = el)}
                  value={digit}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Backspace' && !digit && i > 0) otpRefs.current[i - 1]?.focus();
                    if (e.key === 'Enter') handleVerifyOtp();
                  }}
                  maxLength={1}
                  style={{
                    width: 48, height: 52,
                    textAlign: 'center', fontSize: 22, fontWeight: 700,
                    border: '2px solid #E2E8F0',
                    borderRadius: 10,
                    outline: 'none',
                    background: digit ? '#EFF6FF' : '#fff',
                    color: '#1B3A5C',
                    transition: 'all 0.2s',
                  }}
                  onFocus={e => (e.target.style.borderColor = '#2563EB')}
                  onBlur={e  => (e.target.style.borderColor = '#E2E8F0')}
                  inputMode="numeric"
                  id={`faculty-otp-${i}`}
                />
              ))}
            </div>

            <Button
              type="primary"
              block
              size="large"
              loading={loading}
              onClick={handleVerifyOtp}
              disabled={otpValue.length < 6}
              style={{
                borderRadius: 10, height: 48, fontSize: 15, fontWeight: 600,
                background: 'linear-gradient(135deg, #1B3A5C, #2563EB)',
                border: 'none',
              }}
              id="btn-faculty-verify-otp"
            >
              Verify & Login
            </Button>

            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <Button
                type="link"
                icon={<ReloadOutlined />}
                disabled={resendCd > 0}
                onClick={handleResend}
                loading={loading}
              >
                {resendCd > 0 ? `Resend OTP in ${resendCd}s` : 'Resend OTP'}
              </Button>
            </div>

            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <Button
                type="link"
                size="small"
                onClick={() => { setStep(0); setOtp(['', '', '', '', '', '']); setError(''); }}
              >
                ← Change number
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default FacultyLogin;
