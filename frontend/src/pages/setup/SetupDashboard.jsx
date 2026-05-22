import React from 'react';
import { Card, Row, Col, Typography, Alert } from 'antd';
import useAuthStore from '@/store/authStore';
import {
  BankOutlined, CalendarOutlined, BookOutlined,
  TeamOutlined, TrophyOutlined,
  CheckSquareOutlined, CreditCardOutlined, SettingOutlined,
  ReadOutlined, ApartmentOutlined,
  MessageOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

const tiles = [
  { key: 'school-settings', icon: <BankOutlined />, title: 'School Settings', desc: 'Name, board, contact info', color: 'var(--color-secondary)' },
  { key: 'academic-year', icon: <CalendarOutlined />, title: 'Academic Year', desc: 'Set active year & date range', color: 'var(--color-primary)' },
  { key: 'academic-term', icon: <CalendarOutlined />, title: 'Academic Terms', desc: 'Term 1, Mid Term, Final', color: 'var(--color-primary)' },
  { key: 'classes', icon: <BookOutlined />, title: 'Classes', desc: 'LKG, UKG, 1–12', color: '#14B8A6' },
  { key: 'sections', icon: <TeamOutlined />, title: 'Sections', desc: 'A, B, C sections per class', color: '#22C55E' },
  { key: 'class-groups', icon: <SettingOutlined />, title: 'Class Groups', desc: '5A, V-B with class teacher', color: '#F59E0B' },
  { key: 'subjects',     icon: <ReadOutlined />,      title: 'Subjects',         desc: 'Manage all school subjects', color: 'var(--color-secondary)' },
  { key: 'class-config', icon: <ApartmentOutlined />, title: 'Class Config',      desc: 'Assign subjects & sections per class/year', color: 'var(--color-primary)' },
  { key: 'grade-setup', icon: <TrophyOutlined />, title: 'Grade System', desc: 'A+, A, B grade ranges', color: '#F97316' },
  { key: 'attendance-config', icon: <CheckSquareOutlined />, title: 'Attendance Config', desc: 'Sessions (Morning / P1, P2…)', color: 'var(--color-secondary)' },
  { key: 'payment-settings', icon: <CreditCardOutlined />, title: 'Payment Settings', desc: 'Razorpay, QR, manual pay', color: '#EC4899' },
  { key: 'message-templates', icon: <MessageOutlined />, title: 'Message Templates', desc: 'SMS and WhatsApp content', color: 'var(--color-secondary)' },
];

const SetupDashboard = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isVisitor = user?.role === 'visitor';
  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ marginBottom: 4 }}>⚙️ System Setup</Title>
      {isVisitor && (
        <Alert
          type="info"
          showIcon
          message="You are logged in as a visitor. All system setup controls are read-only."
          style={{ marginBottom: 16 }}
        />
      )}
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        Configure your school ERP from scratch. Set up once, run forever.
      </Text>
      <Row gutter={[16, 16]}>
        {tiles.map((t) => (
          <Col xs={24} sm={12} md={8} xl={6} key={t.key}>
            <Card
              hoverable
              onClick={() => navigate(`/setup/${t.key}`)}
              style={{ borderRadius: 10, cursor: 'pointer', borderTop: `3px solid ${t.color}` }}
              styles={{ body: { padding: '20px 18px' } }}
            >
              <div style={{ fontSize: 26, color: t.color, marginBottom: 8 }}>{t.icon}</div>
              <Text strong style={{ fontSize: 14, display: 'block' }}>{t.title}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>{t.desc}</Text>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default SetupDashboard;
