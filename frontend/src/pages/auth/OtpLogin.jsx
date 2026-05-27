import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Form, Input, Button, Typography, Alert,
  Steps, Divider, ConfigProvider, App
} from 'antd';
import {
  MobileOutlined, SafetyCertificateOutlined,
  CheckCircleOutlined, ReloadOutlined, ArrowLeftOutlined
} from '@ant-design/icons';
import { authAPI } from '@/services/api';
import useAuthStore from '@/store/authStore';
import { getRoleHome } from '@/components/common/ProtectedRoute';
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

const OtpLogin = () => {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { loginWithOtp, loading: storeLoading, isAuthenticated, user } = useAuthStore();

  const [step, setStep] = useState(0); // 0=phone input, 1=OTP verification
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCd, setResendCd] = useState(0);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const otpRefs = useRef([]);

  // Role-aware redirect if already logged in
  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(getRoleHome(user.role), { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

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
    if (loading || storeLoading) return;
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }
    setError('');
    setLoading(true);
    console.log(`[OTP] OTP request start for phone: ${digits}`);

    try {
      // 1. Check if user exists on the backend first
      const checkRes = await authAPI.checkUser(digits);
      const checkData = checkRes.data || checkRes;
      
      if (!checkData.user_found) {
        setError('This phone number is not registered in the system.');
        console.error(`[OTP] OTP request failure: Number not registered`);
        setLoading(false);
        return;
      }

      // 2. Request OTP dispatch
      const res = await authAPI.sendOtpGeneral(digits);
      const resData = res.data || res;
      console.log(`[OTP] OTP request success:`, resData);
      
      if (resData.message && resData.message.toLowerCase().includes('demo')) {
        setIsDemoMode(true);
        message.info('Demo mode: Use test OTP 123456');
      } else {
        setIsDemoMode(false);
        message.success('OTP sent successfully');
      }

      setStep(1);
      startCountdown();
    } catch (e) {
      const errMsg = e.response?.data?.message || e.message || 'Failed to send OTP. Please try again.';
      console.error(`[OTP] OTP request failure:`, errMsg);
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpValue.length !== 6 || loading || storeLoading) return;
    setError('');
    setLoading(true);
    console.log(`[OTP] Verification request start`);

    try {
      const digits = phone.replace(/\D/g, '');
      const result = await loginWithOtp(digits, otpValue);
      
      if (result.success) {
        message.success('Login successful!');
        console.log(`[OTP] Verification request success`);
        const u = useAuthStore.getState().user;
        navigate(getRoleHome(u?.role), { replace: true });
      } else {
        const verifyError = result.message || 'Invalid OTP code.';
        console.error(`[OTP] Verification request failure:`, verifyError);
        setError(verifyError);
        setOtp(['', '', '', '', '', '']);
        otpRefs.current[0]?.focus();
      }
    } catch (e) {
      const verifyError = e.response?.data?.message || e.message || 'OTP verification failed.';
      console.error(`[OTP] Verification request failure:`, verifyError);
      setError(verifyError);
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCd > 0 || loading || storeLoading) return;
    setError('');
    setOtp(['', '', '', '', '', '']);
    setLoading(true);
    const digits = phone.replace(/\D/g, '');
    console.log(`[OTP] OTP resend request start for phone: ${digits}`);
    try {
      const res = await authAPI.sendOtpGeneral(digits);
      const resData = res.data || res;
      console.log(`[OTP] OTP resend request success:`, resData);
      
      if (resData.message && resData.message.toLowerCase().includes('demo')) {
        setIsDemoMode(true);
        message.info('Demo mode: Use test OTP 123456');
      } else {
        setIsDemoMode(false);
        message.success('OTP resent successfully');
      }
      
      startCountdown();
    } catch (e) {
      const errMsg = e.response?.data?.message || e.message || 'Failed to resend OTP';
      console.error(`[OTP] OTP resend request failure:`, errMsg);
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ConfigProvider theme={loginTheme}>
      <div style={styles.container}>
        <Card style={styles.card} bodyStyle={{ padding: '32px' }}>
          
          {/* Back button */}
          <div style={styles.backButtonRow}>
            <Button 
              type="text" 
              icon={<ArrowLeftOutlined />} 
              onClick={() => step === 1 ? setStep(0) : navigate('/login')}
              style={{ padding: 0 }}
            >
              Back to Main Login
            </Button>
          </div>

          {/* Logo / Header */}
          <div style={styles.header}>
            <div style={styles.logoRow}>
              <div style={styles.logoMark}>V</div>
              <div style={styles.brandText}>VSS ERP</div>
            </div>
            <Title level={3} style={{ margin: '8px 0 2px', color: ERP_COLORS.text }}>OTP Login</Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              {step === 0 ? 'Enter your registered mobile number' : 'Enter the verification code'}
            </Text>
          </div>

          {/* Steps Indicator */}
          <Steps current={step} size="small" style={{ marginBottom: 24 }}>
            <Step title="Mobile" icon={<MobileOutlined />} />
            <Step title="OTP" icon={<SafetyCertificateOutlined />} />
            <Step title="Done" icon={<CheckCircleOutlined />} />
          </Steps>

          {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}
          {isDemoMode && (
            <Alert 
              type="info" 
              message="Demo Mode Enabled" 
              description="Use static test OTP: 123456 to login."
              showIcon 
              style={{ marginBottom: 16 }} 
            />
          )}

          {/* Step 0: Input mobile */}
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
                    id="otp-login-phone"
                  />
                </Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  size="large"
                  loading={loading || storeLoading}
                  disabled={loading || storeLoading}
                  style={{ borderRadius: 10, height: 48, fontSize: 15, fontWeight: 600 }}
                  id="otp-login-submit"
                >
                  Send OTP Code
                </Button>
              </Form>
            </div>
          )}

          {/* Step 1: Input OTP boxes */}
          {step === 1 && (
            <div>
              <Paragraph style={{ textAlign: 'center', color: '#64748B', fontSize: 13, marginBottom: 24 }}>
                OTP sent to <strong>+91 {phone}</strong>. Valid for 5 minutes.
              </Paragraph>

              <div style={styles.otpBoxContainer}>
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
                      width: 44, height: 50,
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
                    id={`otp-code-box-${i}`}
                  />
                ))}
              </div>

              <Button
                type="primary"
                block
                size="large"
                loading={loading || storeLoading}
                onClick={handleVerifyOtp}
                disabled={otpValue.length < 6 || loading || storeLoading}
                style={{ borderRadius: 10, height: 48, fontSize: 15, fontWeight: 600 }}
                id="btn-verify-otp-login"
              >
                Verify & Login
              </Button>

              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <Button
                  type="link"
                  icon={<ReloadOutlined />}
                  disabled={resendCd > 0 || loading || storeLoading}
                  onClick={handleResend}
                  loading={loading}
                >
                  {resendCd > 0 ? `Resend OTP in ${resendCd}s` : 'Resend OTP'}
                </Button>
              </div>

              <div style={{ textAlign: 'center', marginTop: 8 }}>
                <Button type="link" size="small" onClick={() => { setStep(0); setOtp(['', '', '', '', '', '']); setError(''); }}>
                  ← Change phone number
                </Button>
              </div>
            </div>
          )}

          <Divider style={{ margin: '24px 0 16px' }} />
          <div style={styles.footer}>
            <Text type="secondary" style={{ fontSize: 11 }}>
              VSS School ERP • Multi-role OTP System
            </Text>
          </div>

        </Card>
      </div>
    </ConfigProvider>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: `linear-gradient(135deg, ${ERP_COLORS.sidebar} 0%, ${ERP_COLORS.sidebarActive} 58%, ${ERP_COLORS.primaryActive} 100%)`,
    padding: '20px',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    overflow: 'hidden',
  },
  backButtonRow: {
    marginBottom: 16,
  },
  header: {
    textAlign: 'center',
    marginBottom: 24,
  },
  logoRow: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 10,
  },
  logoMark: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    background: `linear-gradient(135deg, ${ERP_COLORS.sidebarActive}, ${ERP_COLORS.primary})`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: 16,
    fontWeight: 700,
  },
  brandText: {
    color: ERP_COLORS.text,
    fontSize: 17,
    fontWeight: 700,
  },
  otpBoxContainer: {
    display: 'flex',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 24,
  },
  footer: {
    textAlign: 'center',
  }
};

export default OtpLogin;
