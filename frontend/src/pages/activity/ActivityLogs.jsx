import React, { useEffect, useState, useCallback } from 'react';
import { Typography, Timeline, App, Empty, Spin, Tag, Select, Row, Col } from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined, DollarOutlined,
  CalendarOutlined, FileTextOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import { activityAPI } from '@/services/api';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
dayjs.extend(relativeTime);

const { Title, Text } = Typography;

const moduleIcons = {
  admission: <FileTextOutlined style={{ color: '#3B82F6' }} />,
  fee: <DollarOutlined style={{ color: '#22C55E' }} />,
  attendance: <CalendarOutlined style={{ color: '#F59E0B' }} />,
  exam: <CheckCircleOutlined style={{ color: '#8B5CF6' }} />,
  student: <ClockCircleOutlined style={{ color: '#64748B' }} />,
  general: <ClockCircleOutlined style={{ color: '#64748B' }} />,
};

const moduleColors = {
  admission: 'blue',
  fee: 'green',
  attendance: 'orange',
  exam: 'purple',
  student: 'default',
  general: 'default',
};

const ActivityLogs = () => {
  const { message } = App.useApp();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [moduleFilter, setModuleFilter] = useState(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await activityAPI.getRecent({ limit: 50 });
      setLogs(res.data.logs);
      setTotal(res.data.total);
    } catch (err) {
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const filteredLogs = moduleFilter
    ? logs.filter((l) => l.module === moduleFilter)
    : logs;

  const timelineItems = filteredLogs.map((log) => ({
    key: log._id,
    dot: moduleIcons[log.module] || moduleIcons.general,
    children: (
      <div style={{ marginBottom: 4 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Tag color={moduleColors[log.module] || 'default'} style={{ margin: 0 }}>
            {log.module?.toUpperCase()}
          </Tag>
          <Text strong>{log.action}</Text>
        </div>
        <div style={{ marginTop: 4, fontSize: 12, color: '#94A3B8' }}>
          {log.performedBy?.name && <span>by {log.performedBy.name} · </span>}
          {log.studentId?.name && <span>{log.studentId.name} ({log.studentId.rollNo}) · </span>}
          {dayjs(log.createdAt).fromNow()}
        </div>
      </div>
    ),
  }));

  return (
    <div className="page-container">
      <div className="page-header">
        <Title level={3} className="page-title" style={{ margin: 0 }}>Activity Logs</Title>
        <Text className="page-subtitle">Track all system activities and student events</Text>
      </div>

      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8} md={6}>
          <Select
            placeholder="Filter by module"
            style={{ width: '100%' }}
            value={moduleFilter}
            onChange={setModuleFilter}
            allowClear
            options={[
              { label: 'Admission', value: 'admission' },
              { label: 'Fee', value: 'fee' },
              { label: 'Attendance', value: 'attendance' },
              { label: 'Exam', value: 'exam' },
              { label: 'Student', value: 'student' },
            ]}
          />
        </Col>
        <Col>
          <Text type="secondary">{total} total events</Text>
        </Col>
      </Row>

      <div style={{ background: '#FFF', borderRadius: 8, padding: 24, minHeight: 300 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <Spin size="large" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No activity logs yet" />
        ) : (
          <Timeline items={timelineItems} />
        )}
      </div>
    </div>
  );
};

export default ActivityLogs;
