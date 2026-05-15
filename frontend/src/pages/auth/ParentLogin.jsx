import React, { useState, useRef, useEffect } from 'react';
import {
  Card, Form, Input, Button, Typography, Space, Alert,
  Steps, Divider, Modal,
} from 'antd';
import {
  MobileOutlined, SafetyCertificateOutlined,
  CheckCircleOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { authAPI } from '@/services/api';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '@/store/authStore';

const { Title, Text, Paragraph } = Typography;
const { Step } = Steps;

const ParentLogin = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [step, setStep] = useState(0); // 0=phone, 1=otp
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCd, setResendCd] = useState(0); // countdown seconds
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const otpRefs = useRef([]);

  // ─── Demo popup (once per session) ─────────────────────────
  useEffect(() => {
    const key = 'vms_otp_demo_shown_parent';
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, '1');
      Modal.info({
        title: 'Demo mode enabled',
        content: 'Demo mode enabled. Use test OTP: 123456',
        okText: 'Got it',
        centered: true,
      });
    }
  }, []);


  // ─── OTP input handling ─────────────────────────────────
  const handleOtpChange = (index, value) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...otp];
    next[index] = value;
    setOtp(next);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
    if (!value && index > 0) otpRefs.current[index - 1]?.focus();
  };

  const otpValue = otp.join('');

  // ─── Start resend countdown ──────────────────────────────
  const startCountdown = () => {
    setResendCd(30);
    const interval = setInterval(() => {
      setResendCd(p => { if (p <= 1) { clearInterval(interval); return 0; } return p - 1; });
    }, 1000);
  };

  // ─── Send OTP ────────────────────────────────────────────
  const handleSendOtp = async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 10) { setError('Please enter a valid 10-digit mobile number'); return; }
    setError('');
    setLoading(true);
    try {
      Modal.info({
        title: 'Demo mode enabled',
        content: 'Demo mode enabled. Use test OTP: 123456',
        okText: 'Got it',
        centered: true,
      });
      await authAPI.sendOtp(digits);
      setStep(1);
      startCountdown();
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  // ─── Verify OTP ───────────────────────────────────────────
  const handleVerifyOtp = async () => {
    if (otpValue.length !== 6) { setError('Please enter the complete 6-digit OTP'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await authAPI.verifyOtp(phone.replace(/\D/g, ''), otpValue);
      const data = res.data || res;

      const token = data.token || data.accessToken;
      if (!token) throw new Error('Token missing from OTP verify response');

      setAuth(data.user, token); // ✅ this sets localStorage + store state correctly

      if (data.refreshToken) localStorage.setItem('vms_refresh_token', data.refreshToken);

      navigate('/parent/dashboard', { replace: true });
      // // Update auth store
      // if (data.user) setUser(data.user);
      // navigate('/parent/dashboard');
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Invalid OTP');
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  // ─── Resend OTP ───────────────────────────────────────────
  const handleResend = async () => {
    if (resendCd > 0) return;
    setError('');
    setOtp(['', '', '', '', '', '']);
    setLoading(true);
    try {
      Modal.info({
        title: 'Demo mode enabled',
        content: 'Demo mode enabled. Use test OTP: 123456',
        okText: 'Got it',
        centered: true,
      });
      await authAPI.sendOtp(phone.replace(/\D/g, ''));
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
      background: 'linear-gradient(135deg, var(--color-primary-dark) 0%, var(--color-primary) 100%)',
      padding: '20px',
    }}>
      <Card style={{
        width: '100%',
        maxWidth: 420,
        borderRadius: 20,
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        overflow: 'hidden',
      }} bodyStyle={{ padding: '32px' }}>

        {/* Logo / Title */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: 'linear-gradient(135deg, var(--color-primary-dark), var(--color-primary))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <MobileOutlined style={{ color: '#fff', fontSize: 28 }} />
          </div>
          <Title level={3} style={{ margin: 0, color: 'var(--color-primary-dark)' }}>Parent Login</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {step === 0 ? 'Enter your registered mobile number' : 'Enter the OTP sent to your phone'}
          </Text>
        </div>

        {/* Steps indicator */}
        <Steps current={step} size="small" style={{ marginBottom: 24 }}>
          <Step title="Mobile" icon={<MobileOutlined />} />
          <Step title="OTP" icon={<SafetyCertificateOutlined />} />
          <Step title="Done" icon={<CheckCircleOutlined />} />
        </Steps>

        {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}

        {/* ─── Step 0: Enter Phone ─── */}
        {step === 0 && (
          <div>
            <Form layout="vertical" onFinish={handleSendOtp}>
              <Form.Item label="Mobile Number" style={{ marginBottom: 20 }}>
                <Input
                  size="large"
                  prefix={<MobileOutlined style={{ color: '#94A3B8' }} />}
                  addonBefore="+91"
                  placeholder="9876543210"
                  value={phone}
                  onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  maxLength={10}
                  autoFocus
                  id="parent-phone"
                />
              </Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                block
                size="large"
                loading={loading}
                style={{ borderRadius: 10, height: 48, fontSize: 15, fontWeight: 600 }}
                id="btn-send-otp"
              >
                Send OTP
              </Button>
            </Form>

            <Divider style={{ margin: '20px 0 16px' }} />
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Are you an admin or faculty?{' '}
                <a href="/login" style={{ color: 'var(--color-primary)' }}>Login with email</a>
              </Text>
            </div>
          </div>
        )}

        {/* ─── Step 1: Enter OTP ─── */}
        {step === 1 && (
          <div>
            <Paragraph style={{ textAlign: 'center', color: '#64748B', fontSize: 13, marginBottom: 24 }}>
              OTP sent to <strong>+91 {phone}</strong>. Valid for 5 minutes.
            </Paragraph>

            {/* OTP boxes */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 24 }}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={el => (otpRefs.current[i] = el)}
                  value={digit}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Backspace' && !digit && i > 0) {
                      otpRefs.current[i - 1]?.focus();
                    }
                    if (e.key === 'Enter') handleVerifyOtp();
                  }}
                  maxLength={1}
                  style={{
                    width: 48, height: 52,
                    textAlign: 'center', fontSize: 22, fontWeight: 700,
                    border: '2px solid #E2E8F0',
                    borderRadius: 10,
                    outline: 'none',
                    background: digit ? 'var(--color-primary-light)' : '#fff',
                    color: 'var(--color-primary-dark)',
                    transition: 'all 0.2s',
                  }}
                  onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
                  onBlur={e => (e.target.style.borderColor = '#E2E8F0')}
                  inputMode="numeric"
                  id={`otp-box-${i}`}
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
              style={{ borderRadius: 10, height: 48, fontSize: 15, fontWeight: 600 }}
              id="btn-verify-otp"
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
              <Button type="link" size="small" onClick={() => { setStep(0); setOtp(['', '', '', '', '', '']); setError(''); }}>
                ← Change number
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default ParentLogin;
