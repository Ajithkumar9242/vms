import { useState, useRef, useEffect } from 'react';
import {
  Card, Form, Input, Button, Typography, Alert,
  Steps, Divider, ConfigProvider,
} from 'antd';
import {
  UserOutlined, SafetyCertificateOutlined,
  CheckCircleOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { authAPI } from '@/services/api';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '@/store/authStore';
import { ERP_COLORS } from '@/theme/colors';

const { Title, Text, Paragraph } = Typography;

const loginTheme = {
  token: {
    colorPrimary: ERP_COLORS.primary,
    colorInfo: ERP_COLORS.primary,
    colorLink: ERP_COLORS.primary,
    colorLinkHover: ERP_COLORS.primaryHover,
    controlOutline: 'rgba(194,65,12,0.20)',
    controlOutlineWidth: 2,
    borderRadius: 10,
  },
  components: {
    Input: {
      activeBorderColor: ERP_COLORS.primary,
      hoverBorderColor: ERP_COLORS.primaryHover,
    },
    Button: {
      colorPrimary: ERP_COLORS.primary,
      colorPrimaryHover: ERP_COLORS.primaryHover,
      colorPrimaryActive: ERP_COLORS.primaryActive,
    },
    Steps: {
      colorPrimary: ERP_COLORS.primary,
    },
  },
};

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
  const isSending = useRef(false);

  // Timer countdown
  useEffect(() => {
    if (resendCd <= 0) return;
    const timer = setTimeout(() => {
      setResendCd(prev => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [resendCd]);

  const handleOtpChange = (index, value) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...otp];
    next[index] = value;
    setOtp(next);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
    if (!value && index > 0) otpRefs.current[index - 1]?.focus();
  };

  const otpValue = otp.join('');

  const startCountdown = () => {
    setResendCd(30);
  };

  const handleSendOtp = async () => {
    if (isSending.current || loading) return;
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 10) { setError('Please enter a valid 10-digit mobile number'); return; }
    setError('');
    isSending.current = true;
    setLoading(true);
    console.log(`[OTP] OTP request start for faculty phone: ${digits}`);
    try {
      const res = await authAPI.sendFacultyOtp(digits);
      const data = res.data || res;
      console.log(`[OTP] OTP request success:`, data);
      setStep(1);
      startCountdown();
    } catch (e) {
      const errMsg = e.response?.data?.message || e.message || 'Failed to send OTP';
      console.error(`[OTP] OTP request failure:`, errMsg);
      setError(errMsg);
    } finally {
      isSending.current = false;
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpValue.length !== 6 || isSending.current || loading) return;
    setError('');
    isSending.current = true;
    setLoading(true);
    console.log(`[OTP] Verification request start`);
    try {
      const res  = await authAPI.verifyFacultyOtp(phone.replace(/\D/g, ''), otpValue);
      const data = res.data || res;
      console.log(`[OTP] Verification request success`);
      const token = data.token || data.accessToken;
      if (!token) throw new Error('Token missing from verify response');

      setAuth(data.user, token);
      if (data.refreshToken) localStorage.setItem('vms_refresh_token', data.refreshToken);

      // Trigger splash on the faculty shell after redirect
      localStorage.setItem('erp_show_splash_faculty', '1');
      sessionStorage.removeItem('erp_faculty_splash_session_seen');

      // Redirect to faculty app
      navigate('/faculty-app/dashboard', { replace: true });
    } catch (e) {
      const verifyError = e.response?.data?.message || e.message || 'Invalid OTP';
      console.error(`[OTP] Verification request failure:`, verifyError);
      setError(verifyError);
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } finally {
      isSending.current = false;
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCd > 0 || isSending.current || loading) return;
    setError('');
    setOtp(['', '', '', '', '', '']);
    isSending.current = true;
    setLoading(true);
    const digits = phone.replace(/\D/g, '');
    console.log(`[OTP] OTP resend request start for faculty phone: ${digits}`);
    try {
      const res = await authAPI.sendFacultyOtp(digits);
      const data = res.data || res;
      console.log(`[OTP] OTP resend request success:`, data);
      startCountdown();
    } catch (e) {
      const errMsg = e.response?.data?.message || e.message || 'Failed to resend';
      console.error(`[OTP] OTP resend request failure:`, errMsg);
      setError(errMsg);
    } finally {
      isSending.current = false;
      setLoading(false);
    }
  };

  return (
    <ConfigProvider theme={loginTheme}>
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: `linear-gradient(135deg, ${ERP_COLORS.sidebar} 0%, ${ERP_COLORS.sidebarActive} 58%, ${ERP_COLORS.primaryActive} 100%)`,
      padding: '20px',
    }}>
      <Card style={{
        width: '100%',
        maxWidth: 420,
        borderRadius: 20,
        boxShadow: '0 24px 72px rgba(0,0,0,0.4)',
        overflow: 'hidden',
        border: `1px solid ${ERP_COLORS.border}`,
      }} bodyStyle={{ padding: '36px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: `linear-gradient(135deg, ${ERP_COLORS.sidebarActive}, ${ERP_COLORS.primary})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 17, fontWeight: 700,
            }}>
              V
            </div>
            <div style={{ color: ERP_COLORS.text, fontSize: 18, fontWeight: 700 }}>VSS ERP</div>
          </div>
          <Title level={3} style={{ margin: 0, color: ERP_COLORS.text }}>Faculty Login</Title>
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
                disabled={loading}
                style={{
                  borderRadius: 10, height: 48, fontSize: 15, fontWeight: 600,
                  background: `linear-gradient(135deg, ${ERP_COLORS.primaryActive}, ${ERP_COLORS.primary})`,
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
                <a href="/login" style={{ color: ERP_COLORS.primary }}>Login with email</a>
              </Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Parent login?{' '}
                <a href="/parent-login" style={{ color: ERP_COLORS.primary }}>Parent OTP Login</a>
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
                    background: digit ? ERP_COLORS.primarySoft : '#fff',
                    color: ERP_COLORS.primaryActive,
                    transition: 'all 0.2s',
                  }}
                  onFocus={e => {
                    e.target.style.borderColor = ERP_COLORS.primary;
                    e.target.style.boxShadow = '0 0 0 2px rgba(194,65,12,0.14)';
                  }}
                  onBlur={e  => {
                    e.target.style.borderColor = '#E2E8F0';
                    e.target.style.boxShadow = 'none';
                  }}
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
              disabled={otpValue.length < 6 || loading}
              style={{
                borderRadius: 10, height: 48, fontSize: 15, fontWeight: 600,
                background: `linear-gradient(135deg, ${ERP_COLORS.primaryActive}, ${ERP_COLORS.primary})`,
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
                disabled={resendCd > 0 || loading}
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
    </ConfigProvider>
  );
};

export default FacultyLogin;
