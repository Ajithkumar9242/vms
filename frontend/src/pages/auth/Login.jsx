import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Typography, App, Divider, ConfigProvider } from 'antd';
import {
  LockOutlined, MailOutlined,
  MobileOutlined, UserOutlined, RightOutlined,
} from '@ant-design/icons';
import useAuthStore from '@/store/authStore';
import { getRoleHome } from '@/components/common/ProtectedRoute';
import { ERP_COLORS } from '@/theme/colors';

const { Title, Text } = Typography;

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
    Select: {
      optionSelectedBg: ERP_COLORS.primarySoft,
    },
    Button: {
      colorPrimary: ERP_COLORS.primary,
      colorPrimaryHover: ERP_COLORS.primaryHover,
      colorPrimaryActive: ERP_COLORS.primaryActive,
    },
  },
};

const Login = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { login, loading, isAuthenticated, user } = useAuthStore();

  // Role-aware redirect if already logged in
  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(getRoleHome(user.role), { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const onFinish = async (values) => {
    const result = await login(values.email, values.password);
    if (result.success) {
      message.success('Login successful');
      const u = useAuthStore.getState().user;
      navigate(getRoleHome(u?.role), { replace: true });
    } else {
      message.error(result.message || 'Login failed');
    }
  };

  return (
    <ConfigProvider theme={loginTheme}>
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Logo / Brand */}
        <div style={styles.header}>
          <div style={styles.brandRow}>
            <div style={styles.logoMark}>V</div>
            <div style={styles.brandText}>VSS ERP</div>
          </div>
          <Title level={3} style={styles.title}>Admin Portal</Title>
          <Text type="secondary">Choose a portal to continue</Text>
        </div>

        <div style={styles.portalGridTop}>
          <button type="button" style={{ ...styles.portalCard, ...styles.portalCardActive }}>
            <div style={{ ...styles.portalIcon, background: `linear-gradient(135deg, ${ERP_COLORS.primaryActive}, ${ERP_COLORS.primary})` }}>
              <LockOutlined style={{ color: '#fff', fontSize: 20 }} />
            </div>
            <div style={styles.portalInfo}>
              <div style={styles.portalTitle}>Admin Portal</div>
              <div style={styles.portalSub}>Email and password login</div>
            </div>
          </button>
        </div>

        {/* Admin Login Form */}
        <Form
          form={form}
          name="login"
          layout="vertical"
          onFinish={onFinish}
          autoComplete="off"
          requiredMark={false}
          size="large"
          style={{ marginTop: 28 }}
        >
          <Form.Item
            name="email"
            label="Email Address"
            rules={[
              { required: true, message: 'Please enter your email' },
              { type: 'email', message: 'Please enter a valid email' },
            ]}
          >
            <Input
              prefix={<MailOutlined style={{ color: '#94A3B8' }} />}
              placeholder="admin@vms.com"
              id="login-email"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="Password"
            rules={[
              { required: true, message: 'Please enter your password' },
              { min: 6, message: 'Password must be at least 6 characters' },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#94A3B8' }} />}
              placeholder="Enter your password"
              id="login-password"
            />
          </Form.Item>

          <Form.Item style={{ marginTop: 8 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              id="login-submit"
              style={{ height: 44, fontWeight: 600 }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </Form.Item>
        </Form>

        {/* Other Portals Divider */}
        <Divider style={{ margin: '8px 0 20px', color: '#94A3B8', fontSize: 11, fontWeight: 600, letterSpacing: 1 }}>
          PORTALS
        </Divider>

        {/* Portal Cards */}
        <div style={styles.portalGrid}>
          {/* Parent Portal Card */}
          <button
            id="btn-parent-portal"
            style={styles.portalCard}
            onClick={() => navigate('/parent/login')}
            onMouseEnter={e => Object.assign(e.currentTarget.style, styles.portalCardHover)}
            onMouseLeave={e => Object.assign(e.currentTarget.style, styles.portalCard)}
          >
            <div style={{ ...styles.portalIcon, background: `linear-gradient(135deg, ${ERP_COLORS.primary}, ${ERP_COLORS.primaryHover})` }}>
              <MobileOutlined style={{ color: '#fff', fontSize: 20 }} />
            </div>
            <div style={styles.portalInfo}>
              <div style={styles.portalTitle}>Parent Portal</div>
              <div style={styles.portalSub}>OTP-based login for parents</div>
            </div>
            <RightOutlined style={{ color: '#94A3B8', fontSize: 12 }} />
          </button>

          {/* Faculty Portal Card */}
          <button
            id="btn-faculty-portal"
            style={styles.portalCard}
            onClick={() => navigate('/faculty/login')}
            onMouseEnter={e => Object.assign(e.currentTarget.style, styles.portalCardHover)}
            onMouseLeave={e => Object.assign(e.currentTarget.style, styles.portalCard)}
          >
            <div style={{ ...styles.portalIcon, background: `linear-gradient(135deg, ${ERP_COLORS.primaryActive}, ${ERP_COLORS.primary})` }}>
              <UserOutlined style={{ color: '#fff', fontSize: 20 }} />
            </div>
            <div style={styles.portalInfo}>
              <div style={styles.portalTitle}>Faculty Portal</div>
              <div style={styles.portalSub}>OTP-based login for faculty</div>
            </div>
            <RightOutlined style={{ color: '#94A3B8', fontSize: 12 }} />
          </button>
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            VMS School ERP • Admin Panel
          </Text>
        </div>
      </div>
    </div>
    </ConfigProvider>
  );
};

// ─── Styles ─────────────────────────────────────────────────
const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    background: `linear-gradient(135deg, ${ERP_COLORS.sidebar} 0%, ${ERP_COLORS.sidebarActive} 58%, ${ERP_COLORS.primaryActive} 100%)`,
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    background: '#FFFFFF',
    borderRadius: 12,
    padding: '40px 32px 32px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
  },
  header: {
    textAlign: 'center',
  },
  brandRow: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },
  logoMark: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    borderRadius: 12,
    background: `linear-gradient(135deg, ${ERP_COLORS.sidebarActive}, ${ERP_COLORS.sidebarHover})`,
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: 700,
    letterSpacing: 0,
  },
  brandText: {
    color: ERP_COLORS.text,
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: 0,
  },
  title: {
    margin: '0 0 4px',
    color: ERP_COLORS.text,
  },
  portalGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    marginBottom: 4,
  },
  portalGridTop: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    marginTop: 22,
  },
  portalCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    background: ERP_COLORS.layout,
    border: `1px solid ${ERP_COLORS.border}`,
    borderRadius: 10,
    padding: '14px 16px',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left',
    transition: 'all 0.2s',
  },
  portalCardHover: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    background: ERP_COLORS.primarySoft,
    border: `1px solid ${ERP_COLORS.primaryHover}`,
    borderRadius: 10,
    padding: '14px 16px',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left',
    transition: 'all 0.2s',
    transform: 'translateY(-1px)',
    boxShadow: '0 4px 12px rgba(194, 65, 12, 0.14)',
  },
  portalCardActive: {
    background: ERP_COLORS.primarySoft,
    border: `1px solid ${ERP_COLORS.primary}`,
    boxShadow: '0 4px 14px rgba(194, 65, 12, 0.16)',
  },
  portalIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  portalInfo: {
    flex: 1,
  },
  portalTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: ERP_COLORS.text,
    lineHeight: '1.2',
  },
  portalSub: {
    fontSize: 12,
    color: ERP_COLORS.textMuted,
    marginTop: 2,
  },
  footer: {
    textAlign: 'center',
    marginTop: 24,
    paddingTop: 16,
    borderTop: '1px solid #F1F5F9',
  },
};

export default Login;
