import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Typography, Spin } from 'antd';
import {
  TeamOutlined,
  FormOutlined,
  BookOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { studentAPI, admissionAPI, schoolAPI } from '@/services/api';
import useAuthStore from '@/store/authStore';

const { Title, Text } = Typography;

const Dashboard = () => {
  const user = useAuthStore((s) => s.user);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalAdmissions: 0,
    pendingAdmissions: 0,
    approvedAdmissions: 0,
    rejectedAdmissions: 0,
    totalClasses: 0,
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [students, admissions, pendingAdm, approvedAdm, rejectedAdm, classes] =
        await Promise.allSettled([
          studentAPI.getAll({ limit: 1 }),
          admissionAPI.getAll({ limit: 1 }),
          admissionAPI.getAll({ status: 'pending', limit: 1 }),
          admissionAPI.getAll({ status: 'approved', limit: 1 }),
          admissionAPI.getAll({ status: 'rejected', limit: 1 }),
          schoolAPI.getClasses({ limit: 1 }),
        ]);

      setStats({
        totalStudents: students.status === 'fulfilled' ? students.value.pagination?.total || 0 : 0,
        totalAdmissions: admissions.status === 'fulfilled' ? admissions.value.pagination?.total || 0 : 0,
        pendingAdmissions: pendingAdm.status === 'fulfilled' ? pendingAdm.value.pagination?.total || 0 : 0,
        approvedAdmissions: approvedAdm.status === 'fulfilled' ? approvedAdm.value.pagination?.total || 0 : 0,
        rejectedAdmissions: rejectedAdm.status === 'fulfilled' ? rejectedAdm.value.pagination?.total || 0 : 0,
        totalClasses: classes.status === 'fulfilled' ? classes.value.pagination?.total || 0 : 0,
      });
    } catch {
      // Stats will remain 0 on error — acceptable for dashboard
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Total Students',
      value: stats.totalStudents,
      icon: <TeamOutlined />,
      color: '#3B82F6',
      bg: '#EFF6FF',
    },
    {
      title: 'Total Admissions',
      value: stats.totalAdmissions,
      icon: <FormOutlined />,
      color: '#8B5CF6',
      bg: '#F5F3FF',
    },
    {
      title: 'Pending Admissions',
      value: stats.pendingAdmissions,
      icon: <ClockCircleOutlined />,
      color: '#F59E0B',
      bg: '#FFFBEB',
    },
    {
      title: 'Approved',
      value: stats.approvedAdmissions,
      icon: <CheckCircleOutlined />,
      color: '#22C55E',
      bg: '#F0FDF4',
    },
    {
      title: 'Rejected',
      value: stats.rejectedAdmissions,
      icon: <CloseCircleOutlined />,
      color: '#EF4444',
      bg: '#FEF2F2',
    },
    {
      title: 'Total Classes',
      value: stats.totalClasses,
      icon: <BookOutlined />,
      color: '#06B6D4',
      bg: '#ECFEFF',
    },
  ];

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <Title level={4} className="page-title" style={{ margin: 0 }}>
          Dashboard
        </Title>
        <Text type="secondary">
          Welcome back, {user?.name || 'Admin'}
        </Text>
      </div>

      {/* Stat Cards */}
      <Spin spinning={loading}>
        <Row gutter={[16, 16]}>
          {statCards.map((card) => (
            <Col xs={24} sm={12} lg={8} key={card.title}>
              <Card
                variant="borderless"
                style={{
                  borderRadius: 10,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
                styles={{ body: { padding: '20px 24px' } }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>
                      {card.title}
                    </Text>
                    <Statistic
                      value={card.value}
                      styles={{ content: { fontSize: 28, fontWeight: 700, color: '#0F172A' } }}
                    />
                  </div>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      background: card.bg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                      color: card.color,
                    }}
                  >
                    {card.icon}
                  </div>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </Spin>
    </div>
  );
};

export default Dashboard;
