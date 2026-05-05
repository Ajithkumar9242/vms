import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Typography, App } from 'antd';
import { LockOutlined, MailOutlined } from '@ant-design/icons';
import useAuthStore from '@/store/authStore';

const { Title, Text } = Typography;

const Login = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { login, loading, isAuthenticated } = useAuthStore();

  const { user } = useAuthStore();

  // Role-aware redirect if already logged in
  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'parent') navigate('/parent/dashboard', { replace: true });
      else if (user.role === 'faculty') navigate('/faculty-app/attendance', { replace: true });
      else navigate('/', { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const onFinish = async (values) => {
    const result = await login(values.email, values.password);
    if (result.success) {
      message.success('Login successful');
      const u = useAuthStore.getState().user;
      if (u?.role === 'parent') navigate('/parent/dashboard', { replace: true });
      else if (u?.role === 'faculty') navigate('/faculty-app/attendance', { replace: true });
      else navigate('/', { replace: true });
    } else {
      message.error(result.message || 'Login failed');
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Logo / Brand */}
        <div style={styles.header}>
          <div style={styles.logoMark}>VMS</div>
          <Title level={3} style={styles.title}>
            School ERP
          </Title>
          <Text type="secondary">Sign in to your admin account</Text>
        </div>

        {/* Login Form */}
        <Form
          form={form}
          name="login"
          layout="vertical"
          onFinish={onFinish}
          autoComplete="off"
          requiredMark={false}
          size="large"
          style={{ marginTop: 32 }}
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

        {/* Footer */}
        <div style={styles.footer}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            VMS School ERP • Admin Panel
          </Text>
        </div>
      </div>
    </div>
  );
};

// ─── Styles ─────────────────────────────────────────────────
const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0F172A 0%, #1E3A5F 50%, #1B3A5C 100%)',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    background: '#FFFFFF',
    borderRadius: 12,
    padding: '40px 32px 32px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
  },
  header: {
    textAlign: 'center',
  },
  logoMark: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    height: 56,
    borderRadius: 12,
    background: 'linear-gradient(135deg, #1B3A5C, #2563EB)',
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: 1,
    marginBottom: 16,
  },
  title: {
    margin: '0 0 4px',
    color: '#0F172A',
  },
  footer: {
    textAlign: 'center',
    marginTop: 24,
    paddingTop: 16,
    borderTop: '1px solid #F1F5F9',
  },
};

export default Login;
