import React, { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Typography,
  Select,
  Row,
  Col,
  Button,
  Space,
  App,
  Card,
  Statistic,
  Empty,
} from 'antd';
import {
  DollarOutlined,
  WalletOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import { feesAPI, schoolAPI } from '@/services/api';
import StatusTag from '@/components/common/StatusTag';
import CollectFeeModal from './CollectFeeModal';
import PaymentHistoryDrawer from './PaymentHistoryDrawer';

const { Title, Text } = Typography;

const Fees = () => {
  const { message } = App.useApp();

  // ─── State ──────────────────────────────────────────────────
  const [overview, setOverview] = useState([]);
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState([]);
  const [classFilter, setClassFilter] = useState(undefined);

  // Modal / Drawer state
  const [collectModal, setCollectModal] = useState({ open: false, student: null });
  const [historyDrawer, setHistoryDrawer] = useState({ open: false, studentId: null, studentName: '' });

  // ─── Derived stats ─────────────────────────────────────────
  const totalStudents = overview.length;
  const totalCollected = overview.reduce((sum, s) => sum + s.totalPaid, 0);
  const totalDue = overview.reduce((sum, s) => sum + s.totalDue, 0);
  const paidCount = overview.filter((s) => s.status === 'Paid').length;

  // ─── Fetch overview ─────────────────────────────────────────
  const fetchOverview = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (classFilter) params.classId = classFilter;
      const res = await feesAPI.getOverview(params);
      setOverview(res.data || []);
    } catch (err) {
      message.error(err.message || 'Failed to load fee overview');
    } finally {
      setLoading(false);
    }
  }, [classFilter, message]);

  // ─── Fetch classes for filter ───────────────────────────────
  useEffect(() => {
    const loadClasses = async () => {
      try {
        const res = await schoolAPI.getClasses({ limit: 50 });
        setClasses(res.data || []);
      } catch {
        // Non-critical
      }
    };
    loadClasses();
  }, []);

  // ─── Reload on filter change ────────────────────────────────
  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  // ─── Table columns ──────────────────────────────────────────
  const columns = [
    {
      title: 'Roll No',
      dataIndex: 'rollNo',
      key: 'rollNo',
      width: 100,
      fixed: 'left',
    },
    {
      title: 'Student Name',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      render: (text) => <Text strong>{text}</Text>,
    },
    {
      title: 'Class',
      dataIndex: 'className',
      key: 'className',
      width: 120,
    },
    {
      title: 'Total Fee',
      dataIndex: 'totalFee',
      key: 'totalFee',
      width: 130,
      align: 'right',
      render: (val) => (
        <Text>₹{(val ?? 0).toLocaleString('en-IN')}</Text>
      ),
    },
    {
      title: 'Paid Amount',
      dataIndex: 'totalPaid',
      key: 'totalPaid',
      width: 130,
      align: 'right',
      render: (val) => (
        <Text style={{ color: '#22C55E', fontWeight: 600 }}>
          ₹{(val ?? 0).toLocaleString('en-IN')}
        </Text>
      ),
    },
    {
      title: 'Due Amount',
      dataIndex: 'totalDue',
      key: 'totalDue',
      width: 130,
      align: 'right',
      render: (val) => (
        <Text style={{ color: val > 0 ? '#EF4444' : '#22C55E', fontWeight: 600 }}>
          ₹{(val ?? 0).toLocaleString('en-IN')}
        </Text>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => <StatusTag status={status.toLowerCase()} />,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="primary"
            size="small"
            icon={<DollarOutlined />}
            onClick={() =>
              setCollectModal({
                open: true,
                student: {
                  _id: record._id,
                  name: record.name,
                  totalDue: record.totalDue,
                },
              })
            }
            id={`collect-fee-${record._id}`}
          >
            Collect
          </Button>
          <Button
            size="small"
            icon={<HistoryOutlined />}
            onClick={() =>
              setHistoryDrawer({
                open: true,
                studentId: record._id,
                studentName: record.name,
              })
            }
            id={`view-history-${record._id}`}
          >
            History
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="page-container">
      {/* ─── Page Header ────────────────────────────────────── */}
      <div className="page-header">
        <Title level={4} className="page-title" style={{ margin: 0 }}>
          Fee Management
        </Title>
        <Text type="secondary">Track and collect student fees</Text>
      </div>

      {/* ─── Stats Cards ────────────────────────────────────── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card size="small" variant="borderless" style={{ borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <Statistic
              title={<span style={{ fontSize: 12, color: '#64748B' }}>Total Students</span>}
              value={totalStudents}
              prefix={<WalletOutlined style={{ color: '#3B82F6' }} />}
              styles={{ content: { fontSize: 22, fontWeight: 700, color: '#1B3A5C' } }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" variant="borderless" style={{ borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <Statistic
              title={<span style={{ fontSize: 12, color: '#64748B' }}>Total Collected</span>}
              value={totalCollected}
              prefix={<CheckCircleOutlined style={{ color: '#22C55E' }} />}
              formatter={(val) => `₹${val.toLocaleString('en-IN')}`}
              styles={{ content: { fontSize: 22, fontWeight: 700, color: '#22C55E' } }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" variant="borderless" style={{ borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <Statistic
              title={<span style={{ fontSize: 12, color: '#64748B' }}>Total Due</span>}
              value={totalDue}
              prefix={<ExclamationCircleOutlined style={{ color: '#EF4444' }} />}
              formatter={(val) => `₹${val.toLocaleString('en-IN')}`}
              styles={{ content: { fontSize: 22, fontWeight: 700, color: '#EF4444' } }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" variant="borderless" style={{ borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <Statistic
              title={<span style={{ fontSize: 12, color: '#64748B' }}>Fully Paid</span>}
              value={paidCount}
              suffix={<span style={{ fontSize: 13, color: '#94A3B8' }}>/ {totalStudents}</span>}
              prefix={<CheckCircleOutlined style={{ color: '#3B82F6' }} />}
              styles={{ content: { fontSize: 22, fontWeight: 700, color: '#1B3A5C' } }}
            />
          </Card>
        </Col>
      </Row>

      {/* ─── Filter ─────────────────────────────────────────── */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <Select
            placeholder="Filter by class"
            allowClear
            style={{ width: '100%' }}
            value={classFilter}
            onChange={(val) => setClassFilter(val)}
            options={classes.map((c) => ({ label: c.name, value: c._id }))}
            id="fee-class-filter"
          />
        </Col>
      </Row>

      {/* ─── Table ──────────────────────────────────────────── */}
      <Table
        columns={columns}
        dataSource={overview}
        rowKey="_id"
        loading={loading}
        pagination={{
          showSizeChanger: true,
          showTotal: (total) => `Total ${total} students`,
          pageSize: 20,
        }}
        scroll={{ x: 1090 }}
        size="middle"
        bordered={false}
        style={{ background: '#FFF', borderRadius: 8 }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No fee records found"
            />
          ),
        }}
      />

      {/* ─── Collect Fee Modal ──────────────────────────────── */}
      <CollectFeeModal
        open={collectModal.open}
        student={collectModal.student}
        onClose={() => setCollectModal({ open: false, student: null })}
        onSuccess={() => {
          setCollectModal({ open: false, student: null });
          fetchOverview(); // Refresh table
        }}
      />

      {/* ─── Payment History Drawer ─────────────────────────── */}
      <PaymentHistoryDrawer
        open={historyDrawer.open}
        studentId={historyDrawer.studentId}
        studentName={historyDrawer.studentName}
        onClose={() => setHistoryDrawer({ open: false, studentId: null, studentName: '' })}
      />
    </div>
  );
};

export default Fees;
