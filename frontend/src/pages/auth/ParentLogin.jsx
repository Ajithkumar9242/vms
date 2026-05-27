import { useState, useRef, useEffect } from 'react';
import {
  Card, Form, Input, Button, Typography, Alert,
  Steps, Divider, Modal, ConfigProvider,
} from 'antd';
import {
  MobileOutlined, SafetyCertificateOutlined,
  CheckCircleOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { authAPI } from '@/services/api';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '@/store/authStore';
import { ERP_COLORS } from '@/theme/colors';

const { Title, Text, Paragraph } = Typography;
const { Step } = Steps;

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


  // Timer countdown
  useEffect(() => {
    if (resendCd <= 0) return;
    const timer = setTimeout(() => {
      setResendCd(prev => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [resendCd]);

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
  };

  // ─── Send OTP ────────────────────────────────────────────
  const handleSendOtp = async () => {
    if (loading) return;
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 10) { setError('Please enter a valid 10-digit mobile number'); return; }
    setError('');
    setLoading(true);
    console.log(`[OTP] OTP request start for parent phone: ${digits}`);
    try {
      const res = await authAPI.sendOtp(digits);
      const data = res.data || res;
      console.log(`[OTP] OTP request success:`, data);
      if (data.message && data.message.toLowerCase().includes('demo')) {
        Modal.info({
          title: 'Demo Mode Enabled',
          content: data.message,
          okText: 'Got it',
          centered: true,
        });
      }
      setStep(1);
      startCountdown();
    } catch (e) {
      const errMsg = e.response?.data?.message || e.message || 'Failed to send OTP';
      console.error(`[OTP] OTP request failure:`, errMsg);
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  // ─── Verify OTP ───────────────────────────────────────────
  const handleVerifyOtp = async () => {
    if (otpValue.length !== 6 || loading) return;
    setError('');
    setLoading(true);
    console.log(`[OTP] Verification request start`);
    try {
      const res = await authAPI.verifyOtp(phone.replace(/\D/g, ''), otpValue);
      const data = res.data || res;
      console.log(`[OTP] Verification request success`);

      const token = data.token || data.accessToken;
      if (!token) throw new Error('Token missing from OTP verify response');

      setAuth(data.user, token); // ✅ this sets localStorage + store state correctly

      if (data.refreshToken) localStorage.setItem('vms_refresh_token', data.refreshToken);

      // Trigger splash on the parent shell after redirect
      localStorage.setItem('erp_show_splash_parent', '1');
      sessionStorage.removeItem('erp_parent_splash_session_seen');

      navigate('/parent/dashboard', { replace: true });
    } catch (e) {
      const verifyError = e.response?.data?.message || e.message || 'Invalid OTP';
      console.error(`[OTP] Verification request failure:`, verifyError);
      setError(verifyError);
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  // ─── Resend OTP ───────────────────────────────────────────
  const handleResend = async () => {
    if (resendCd > 0 || loading) return;
    setError('');
    setOtp(['', '', '', '', '', '']);
    setLoading(true);
    const digits = phone.replace(/\D/g, '');
    console.log(`[OTP] OTP resend request start for parent phone: ${digits}`);
    try {
      const res = await authAPI.sendOtp(digits);
      const data = res.data || res;
      console.log(`[OTP] OTP resend request success:`, data);
      if (data.message && data.message.toLowerCase().includes('demo')) {
        Modal.info({
          title: 'Demo Mode Enabled',
          content: data.message,
          okText: 'Got it',
          centered: true,
        });
      }
      startCountdown();
    } catch (e) {
      const errMsg = e.response?.data?.message || e.message || 'Failed to resend';
      console.error(`[OTP] OTP resend request failure:`, errMsg);
      setError(errMsg);
    } finally {
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
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        overflow: 'hidden',
      }} bodyStyle={{ padding: '32px' }}>

        {/* Logo / Title */}
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
          <Title level={3} style={{ margin: 0, color: ERP_COLORS.text }}>Parent Login</Title>
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
                disabled={loading}
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
                <a href="/login" style={{ color: ERP_COLORS.primary }}>Login with email</a>
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
                    background: digit ? ERP_COLORS.primarySoft : '#fff',
                    color: ERP_COLORS.primaryActive,
                    transition: 'all 0.2s',
                  }}
                  onFocus={e => {
                    e.target.style.borderColor = ERP_COLORS.primary;
                    e.target.style.boxShadow = '0 0 0 2px rgba(194,65,12,0.14)';
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = '#E2E8F0';
                    e.target.style.boxShadow = 'none';
                  }}
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
              disabled={otpValue.length < 6 || loading}
              style={{ borderRadius: 10, height: 48, fontSize: 15, fontWeight: 600 }}
              id="btn-verify-otp"
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
              <Button type="link" size="small" onClick={() => { setStep(0); setOtp(['', '', '', '', '', '']); setError(''); }}>
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

export default ParentLogin;
