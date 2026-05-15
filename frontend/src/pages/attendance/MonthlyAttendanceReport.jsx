import React, { useState, useEffect, useCallback } from 'react';
import {
  Select, Table, Typography, Card, Statistic,
  Row, Col, App, Empty, Tag,
} from 'antd';
import { PercentageOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { schoolAPI, attendanceAPI } from '@/services/api';

const { Text } = Typography;

const MonthlyAttendanceReport = () => {
  const { message } = App.useApp();

  const [classes, setClasses]       = useState([]);
  const [classId, setClassId]       = useState(undefined);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading]       = useState(false);

  useEffect(() => {
    schoolAPI.getClasses({ limit: 50 })
      .then(res => setClasses(res.data || []))
      .catch(() => {});
  }, []);

  const fetchReport = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    try {
      const res = await attendanceAPI.getMonthlyClassReport(classId);
      setReportData(res?.data || null);
    } catch (e) {
      message.error(e.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [classId, message]);

  useEffect(() => {
    if (classId) fetchReport();
    else setReportData(null);
  }, [classId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Expandable: month-wise breakdown per student
  const expandedRowRender = (record) => {
    if (!record.monthWise?.length) return <Text type="secondary">No month data</Text>;
    return (
      <Table
        dataSource={record.monthWise}
        rowKey="monthKey"
        pagination={false}
        size="small"
        columns={[
          { title: 'Month', dataIndex: 'monthKey', key: 'mk',
            render: mk => dayjs(mk, 'YYYY-MM').format('MMMM YYYY') },
          { title: 'Conducted', dataIndex: 'conducted', key: 'c', align: 'center' },
          { title: 'Attended', dataIndex: 'attended', key: 'a', align: 'center',
            render: v => <Tag color="orange">{v}</Tag> },
          { title: 'Absent', key: 'abs', align: 'center',
            render: (_, r) => <Tag color="red">{r.conducted - r.attended}</Tag> },
          { title: '%', key: 'pct', align: 'center',
            render: (_, r) => {
              const p = r.conducted > 0 ? Math.round((r.attended / r.conducted) * 100) : 0;
              const color = p >= 75 ? '#22C55E' : p >= 50 ? '#F59E0B' : '#EF4444';
              return <Text style={{ color, fontWeight: 600 }}>{p}%</Text>;
            } },
        ]}
      />
    );
  };

  const columns = [
    { title: '#', key: 'i', width: 44, render: (_, __, i) => i + 1 },
    { title: 'Roll No', dataIndex: 'rollNo', key: 'rollNo', width: 80 },
    {
      title: 'Student Name', dataIndex: 'name', key: 'name',
      render: t => <Text strong>{t}</Text>,
    },
    {
      title: 'Total Conducted', dataIndex: 'totalConducted', key: 'totalConducted',
      width: 130, align: 'center',
    },
    {
      title: 'Attended', dataIndex: 'totalAttended', key: 'totalAttended',
      width: 100, align: 'center',
      render: v => <Tag color="orange">{v}</Tag>,
    },
    {
      title: 'Absent', key: 'absent', width: 90, align: 'center',
      render: (_, r) => <Tag color="red">{r.totalConducted - r.totalAttended}</Tag>,
    },
    {
      title: 'Attendance %', dataIndex: 'percentage', key: 'percentage',
      width: 130, align: 'center',
      sorter: (a, b) => a.percentage - b.percentage,
      render: val => {
        const color = val >= 75 ? '#22C55E' : val >= 50 ? '#F59E0B' : '#EF4444';
        return <Text strong style={{ color }}>{val}%</Text>;
      },
    },
  ];

  const stats = reportData;

  return (
    <>
      {/* Class selector */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8} md={6}>
          <Select
            placeholder="Select class"
            style={{ width: '100%' }}
            value={classId}
            onChange={val => setClassId(val)}
            options={classes.map(c => ({ label: c.name, value: c._id }))}
            allowClear
            id="monthly-report-class-select"
          />
        </Col>
      </Row>

      {/* Summary cards */}
      {stats && (
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={6}>
            <Card size="small" variant="borderless" style={{ borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <Statistic
                title={<span style={{ fontSize: 12, color: '#64748B' }}>Total Months</span>}
                value={stats.months?.length || 0}
                styles={{ content: { fontSize: 20, fontWeight: 700 } }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small" variant="borderless" style={{ borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <Statistic
                title={<span style={{ fontSize: 12, color: '#64748B' }}>Total Conducted</span>}
                value={stats.totalConducted || 0}
                styles={{ content: { fontSize: 20, fontWeight: 700, color: 'var(--color-primary-dark)' } }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small" variant="borderless" style={{ borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <Statistic
                title={<span style={{ fontSize: 12, color: '#64748B' }}>Students</span>}
                value={stats.students?.length || 0}
                styles={{ content: { fontSize: 20, fontWeight: 700 } }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small" variant="borderless" style={{ borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <Statistic
                title={<span style={{ fontSize: 12, color: '#64748B' }}>Class Avg %</span>}
                value={
                  stats.students?.length
                    ? Math.round(
                        (stats.students.reduce((s, r) => s + r.percentage, 0) / stats.students.length) * 10
                      ) / 10
                    : 0
                }
                suffix="%"
                prefix={<PercentageOutlined style={{ color: 'var(--color-secondary)' }} />}
                styles={{ content: { fontSize: 20, fontWeight: 700, color: 'var(--color-secondary)' } }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {!classId ? (
        <Empty description="Select a class to view the cumulative monthly report" style={{ marginTop: 48 }} />
      ) : (
        <Table
          columns={columns}
          dataSource={stats?.students || []}
          rowKey="_id"
          loading={loading}
          pagination={{ showSizeChanger: true, showTotal: t => `Total ${t} students`, pageSize: 20 }}
          scroll={{ x: 740 }}
          size="middle"
          bordered={false}
          style={{ background: '#FFF', borderRadius: 8 }}
          locale={{ emptyText: 'No monthly attendance data recorded for this class' }}
          expandable={{ expandedRowRender, rowExpandable: r => r.monthWise?.length > 0 }}
        />
      )}
    </>
  );
};

export default MonthlyAttendanceReport;
