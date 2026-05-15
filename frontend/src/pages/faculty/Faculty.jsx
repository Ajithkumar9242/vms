import React, { useEffect, useState } from 'react';
import {
  Row, Col, Card, Statistic, Typography, Tag, Table, Spin,
  Select, Empty, Alert, Badge, Avatar,
} from 'antd';
import {
  TeamOutlined, BookOutlined, CalendarOutlined,
  TrophyOutlined, FileTextOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import { facultyDashboardAPI, examAPI } from '@/services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const STATUS_COLOR = { draft: 'default', published: 'blue', locked: 'green' };

const FacultyDashboard = () => {
  const [loading,  setLoading]  = useState(true);
  const [data,     setData]     = useState(null);
  const [students, setStudents] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [selClass, setSelClass] = useState(null);
  const [selExam,  setSelExam]  = useState(null);
  const [exams,    setExams]    = useState([]);
  const [stuLoading, setStuLoading] = useState(false);
  const [anaLoading, setAnaLoading] = useState(false);

  useEffect(() => {
    facultyDashboardAPI.getDashboard()
      .then((r) => { setData(r?.data || r); })
      .catch(() => {})
      .finally(() => setLoading(false));
    examAPI.getAll().then((r) => setExams(Array.isArray(r?.data) ? r.data : r?.data?.exams || [])).catch(() => {});
  }, []);

  const loadStudents = (classId) => {
    setSelClass(classId);
    setStudents([]);
    setAnalytics(null);
    setStuLoading(true);
    facultyDashboardAPI.getClassStudents(classId)
      .then((r) => setStudents(Array.isArray(r?.data) ? r.data : []))
      .catch(() => {})
      .finally(() => setStuLoading(false));
  };

  const loadAnalytics = (classId, examId) => {
    setSelExam(examId);
    setAnaLoading(true);
    facultyDashboardAPI.getClassAnalytics(classId, examId)
      .then((r) => setAnalytics(r?.data || null))
      .catch(() => {})
      .finally(() => setAnaLoading(false));
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;

  const faculty    = data?.faculty;
  const stats      = data?.stats || {};
  const recentExams = data?.recentExams || [];

  const studentCols = [
    { title: 'Roll No', dataIndex: 'rollNo', key: 'rollNo', width: 90 },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    {
      title: 'Attendance %', key: 'att',
      render: (_, r) => {
        const pct = r.attendancePct;
        if (pct === null) return <Text type="secondary">—</Text>;
        const color = pct >= 75 ? '#16A34A' : pct >= 50 ? '#D97706' : '#DC2626';
        return <Tag color={pct >= 75 ? 'green' : pct >= 50 ? 'orange' : 'red'}>{pct}%</Tag>;
      },
    },
    {
      title: 'Last Marks', key: 'mark',
      render: (_, r) => r.lastMark
        ? `${r.lastMark.marksObtained}/${r.lastMark.maxMarks || 100}`
        : <Text type="secondary">—</Text>,
    },
  ];

  const analyticsCols = [
    { title: 'Rank', dataIndex: 'rank', key: 'rank', width: 60 },
    { title: 'Student', key: 'name', render: (_, r) => r.student?.name || '—' },
    { title: 'Total', key: 'total', render: (_, r) => `${r.totalObtained}/${r.totalMax}` },
    {
      title: '%', dataIndex: 'percentage', key: 'pct',
      render: (v) => <Tag color={v >= 75 ? 'green' : v >= 40 ? 'orange' : 'red'}>{v}%</Tag>,
    },
  ];

  const classes = faculty?.assignedClasses || [];

  return (
    <div style={{ padding: '0 0 40px' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, var(--color-primary-dark) 0%, var(--color-primary) 100%)',
        padding: '24px 28px', borderRadius: 16, marginBottom: 24, color: '#fff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Avatar size={56} style={{ background: '#fff', color: 'var(--color-primary-dark)', fontSize: 24, fontWeight: 800 }}>
            {(faculty?.name || 'F').charAt(0)}
          </Avatar>
          <div>
            <Title level={4} style={{ color: '#fff', margin: 0 }}>{faculty?.name || 'Faculty'}</Title>
            <Text style={{ color: '#93C5FD' }}>{faculty?.designation || 'Teacher'} · {faculty?.department || 'General'}</Text>
          </div>
        </div>
      </div>

      {/* Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {[
          { title: 'Classes', value: stats.classCount   || 0, icon: <TeamOutlined />,       color: 'var(--color-primary)' },
          { title: 'Subjects',value: stats.subjectCount || 0, icon: <BookOutlined />,       color: '#7C3AED' },
          { title: 'Students',value: stats.studentCount || 0, icon: <CalendarOutlined />,   color: '#059669' },
          { title: 'To Grade', value: stats.pendingGrade|| 0, icon: <FileTextOutlined />,   color: '#D97706' },
        ].map((s) => (
          <Col key={s.title} xs={12} sm={6}>
            <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <Statistic
                title={s.title}
                value={s.value}
                prefix={<span style={{ color: s.color }}>{s.icon}</span>}
                valueStyle={{ color: s.color, fontWeight: 800 }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        {/* Class Students Panel */}
        <Col xs={24} lg={14}>
          <Card
            title={<><TeamOutlined style={{ marginRight: 8, color: 'var(--color-primary)' }} />Class Students</>}
            bordered={false}
            style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
            extra={
              <Select
                placeholder="Select class"
                style={{ width: 160 }}
                onChange={loadStudents}
                options={classes.map((c) => ({ value: c._id, label: c.name }))}
                id="dashboard-class-select"
              />
            }
          >
            {stuLoading ? <Spin /> : students.length > 0 ? (
              <Table
                dataSource={students} columns={studentCols}
                rowKey="_id" size="small" pagination={{ pageSize: 10 }}
              />
            ) : (
              <Empty description={selClass ? 'No students found' : 'Select a class above'} />
            )}
          </Card>
        </Col>

        {/* Recent Exams + Analytics */}
        <Col xs={24} lg={10}>
          <Card
            title={<><TrophyOutlined style={{ marginRight: 8, color: '#D97706' }} />Recent Exams</>}
            bordered={false}
            style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 16 }}
          >
            {recentExams.length === 0
              ? <Empty description="No exams yet" />
              : recentExams.map((e) => (
                <div key={e._id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 0', borderBottom: '1px solid #F1F5F9',
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{e.examName || e.name}</div>
                    <div style={{ fontSize: 12, color: '#64748B' }}>{e.classId?.name}</div>
                  </div>
                  <Tag color={STATUS_COLOR[e.status] || 'default'}>{e.status}</Tag>
                </div>
              ))
            }
          </Card>

          {/* Analytics Panel */}
          {selClass && (
            <Card
              title={<><TrophyOutlined style={{ marginRight: 8, color: '#7C3AED' }} />Performance Analytics</>}
              bordered={false}
              style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
              extra={
                <Select
                  placeholder="Select exam"
                  style={{ width: 160 }}
                  onChange={(eid) => loadAnalytics(selClass, eid)}
                  options={exams
                    .filter((e) => String(e.classId?._id || e.classId) === String(selClass))
                    .map((e) => ({ value: e._id, label: e.examName || e.name }))}
                  id="analytics-exam-select"
                />
              }
            >
              {anaLoading ? <Spin /> : analytics ? (
                <>
                  <Row gutter={8} style={{ marginBottom: 12 }}>
                    {[
                      { label: 'Avg %', value: `${analytics.stats?.averagePercentage ?? '—'}%` },
                      { label: 'Passed', value: analytics.stats?.passed ?? '—' },
                      { label: 'Failed', value: analytics.stats?.failed ?? '—' },
                    ].map((s) => (
                      <Col key={s.label} span={8}>
                        <div style={{ textAlign: 'center', background: '#F8FAFC', borderRadius: 8, padding: '10px 4px' }}>
                          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-primary-dark)' }}>{s.value}</div>
                          <div style={{ fontSize: 11, color: '#64748B' }}>{s.label}</div>
                        </div>
                      </Col>
                    ))}
                  </Row>
                  {analytics.stats?.topper && (
                    <Alert
                      type="success" showIcon
                      message={`Topper: ${analytics.stats.topper.name} — ${analytics.stats.topper.percentage}%`}
                      style={{ marginBottom: 8 }}
                    />
                  )}
                  <Table
                    dataSource={analytics.students} columns={analyticsCols}
                    rowKey={(r) => r.student?._id || r.rank} size="small" pagination={{ pageSize: 5 }}
                  />
                </>
              ) : (
                <Empty description="Select an exam to view analytics" />
              )}
            </Card>
          )}
        </Col>
      </Row>
    </div>
  );
};

export default FacultyDashboard;
