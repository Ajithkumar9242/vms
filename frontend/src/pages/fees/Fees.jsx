import React, { useEffect, useState, useCallback } from 'react';
import {
  Table, Typography, Select, Row, Col, Button, Space, App,
  Card, Statistic, Empty, Tag, Drawer, Badge, Tabs, Tooltip,
} from 'antd';
import {
  DollarOutlined, WalletOutlined, CheckCircleOutlined,
  ExclamationCircleOutlined, HistoryOutlined, FileTextOutlined,
  AlertOutlined, TeamOutlined, BarChartOutlined, SettingOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { feesAPI, schoolAPI } from '@/services/api';
import StatusTag from '@/components/common/StatusTag';
import CollectFeeModal from './CollectFeeModal';
import PaymentHistoryDrawer from './PaymentHistoryDrawer';
import FeeComponents from './FeeComponents';
import StudentFeeAssignment from './StudentFeeAssignment';
import FeeDashboard from './FeeDashboard';
import FeeInvoiceDetail from './FeeInvoiceDetail';
import useAuthStore from '@/store/authStore';

const { Title, Text } = Typography;

const Fees = () => {
  const { message } = App.useApp();
  const user = useAuthStore(s => s.user);
  const isAdmin = ['admin', 'super_admin', 'principal'].includes(user?.role);
  const [activeTab, setActiveTab] = useState('overview');

  const [overview, setOverview] = useState([]);
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState([]);
  const [classFilter, setClassFilter] = useState(undefined);
  const [statusFilter, setStatusFilter] = useState(undefined);

  const [collectModal, setCollectModal] = useState({ open: false, student: null });
  const [historyDrawer, setHistoryDrawer] = useState({ open: false, studentId: null, studentName: '' });
  const [detailDrawer, setDetailDrawer] = useState({ open: false, invoiceId: null, invoiceNumber: '' });

  // ─── Stats ───────────────────────────────────────────────
  const filtered = statusFilter ? overview.filter(s => s.status === statusFilter) : overview;
  const totalCollected = filtered.reduce((sum, s) => sum + (s.paidAmount || s.totalPaid || 0), 0);
  const totalDue = filtered.reduce((sum, s) => sum + (s.dueAmount || s.totalDue || 0), 0);
  const paidCount = filtered.filter(s => s.status === 'Paid' || s.status === 'paid').length;
  const dueCount = filtered.filter(s => ['Pending', 'Partial', 'unpaid', 'partial', 'overdue'].includes(s.status)).length;

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

  useEffect(() => {
    schoolAPI.getClasses({ limit: 50 }).then(res => setClasses(res.data || [])).catch(() => { });
  }, []);

  useEffect(() => { if (activeTab === 'overview') fetchOverview(); }, [fetchOverview, activeTab]);

  // Open invoice detail drawer — always enhanced
  const openInvoiceDetail = (record) => {
    if (record.invoiceId) {
      setDetailDrawer({ open: true, invoiceId: record.invoiceId, invoiceNumber: record.invoiceNumber || '' });
    } else {
      message.info('No invoice found. Please assign fees and generate an invoice first.');
    }
  };

  // ─── Table columns ───────────────────────────────────────
  const columns = [
    { title: 'Roll No', dataIndex: 'rollNo', key: 'rollNo', width: 90, fixed: 'left' },
    {
      title: 'Student Name', dataIndex: 'name', key: 'name', width: 180,
      render: (text, r) => (
        <div>
          <Text strong>{text}</Text>
          {r.status === 'No Profile' && <Tag color="default" style={{ marginLeft: 4, fontSize: 10 }}>No Profile</Tag>}
        </div>
      ),
    },
    { title: 'Class', dataIndex: 'className', key: 'className', width: 100 },
    {
      title: 'Invoice', key: 'invoice', width: 140,
      render: (_, r) => r.invoiceNumber
        ? <Tag color="blue" style={{ cursor: 'pointer', fontSize: 11 }}
          onClick={() => openInvoiceDetail(r)}>
          <FileTextOutlined /> {r.invoiceNumber}
        </Tag>
        : <Tag color="default">No Invoice</Tag>,
    },
    {
      title: 'Gross Fee', dataIndex: 'grossFee', key: 'grossFee', width: 110, align: 'right',
      render: v => <Text type="secondary">₹{(v ?? 0).toLocaleString('en-IN')}</Text>,
    },
    {
      title: 'Discount', dataIndex: 'discountAmount', key: 'discountAmount', width: 100, align: 'right',
      render: v => v > 0
        ? <Text style={{ color: '#22C55E' }}>-₹{v.toLocaleString('en-IN')}</Text>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Net Fee', dataIndex: 'netFee', key: 'netFee', width: 110, align: 'right',
      render: v => <Text strong>₹{(v ?? 0).toLocaleString('en-IN')}</Text>,
    },
    {
      title: 'Paid', dataIndex: 'paidAmount', key: 'paidAmount', width: 110, align: 'right',
      render: v => <Text style={{ color: '#22C55E', fontWeight: 600 }}>₹{(v ?? 0).toLocaleString('en-IN')}</Text>,
    },
    {
      title: 'Due', dataIndex: 'dueAmount', key: 'dueAmount', width: 110, align: 'right',
      sorter: (a, b) => (b.dueAmount || 0) - (a.dueAmount || 0),
      render: (v, r) => (
        <Text style={{ color: v > 0 ? '#EF4444' : '#22C55E', fontWeight: 600 }}>
          ₹{(v ?? 0).toLocaleString('en-IN')}
          {r.livePenalty > 0 && (
            <span style={{ fontSize: 10, color: '#F59E0B', marginLeft: 4 }}>
              +₹{r.livePenalty.toLocaleString('en-IN')} penalty
            </span>
          )}
        </Text>
      ),
    },
    {
      title: 'Next Due', key: 'nextDueDate', width: 125,
      render: (_, r) => {
        const val = r.nextDueDate;
        if (val) {
          const d = dayjs(val);
          const overdue = d.isBefore(dayjs(), 'day') && r.status !== 'Paid';
          return (
            <Text style={{ color: overdue ? '#EF4444' : undefined, fontWeight: overdue ? 600 : undefined }}>
              {overdue && <WarningOutlined style={{ marginRight: 4 }} />}
              {d.format('DD MMM YYYY')}
            </Text>
          );
        }
        // Invoice exists but no nextDueDate = schedule is missing or not set
        if (r.invoiceId) {
          return (
            <Tooltip title="No payment schedule set. Open Assign Fees → Sch. to add installments with due dates, then regenerate schedule.">
              <Tag color="orange" style={{ fontSize: 10, cursor: 'default' }}>⚠ No Schedule</Tag>
            </Tooltip>
          );
        }
        // No invoice at all
        return <Text type="secondary" style={{ fontSize: 11 }}>No Invoice</Text>;
      },
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 100,
      filters: [
        { text: 'Paid', value: 'Paid' },
        { text: 'Partial', value: 'Partial' },
        { text: 'Pending', value: 'Pending' },
        { text: 'Overdue', value: 'Overdue' },
        { text: 'No Invoice', value: 'No Invoice' },
      ],
      onFilter: (value, record) => record.status === value,
      render: status => <StatusTag status={status?.toLowerCase() || 'pending'} />,
    },
    {
      title: 'Actions', key: 'actions', width: 220, fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          {record.invoiceId && record.status !== 'Paid' && (
            <Button type="primary" size="small" icon={<DollarOutlined />}
              onClick={() => setCollectModal({
                open: true,
                student: {
                  _id: record._id,
                  name: record.name,
                  totalDue: record.dueAmount || record.totalDue,
                  invoiceId: record.invoiceId,
                },
              })}
              id={`collect-fee-${record._id}`}>Collect</Button>
          )}
          {/* <Button size="small" icon={<HistoryOutlined />}
            onClick={() => setHistoryDrawer({ open: true, studentId: record._id, studentName: record.name })}
            id={`view-history-${record._id}`}>History</Button> */}
          <Button size="small" icon={<FileTextOutlined />}
            onClick={() => openInvoiceDetail(record)}
            disabled={!record.invoiceId}
            id={`view-invoice-${record._id}`}>Invoice</Button>
        </Space>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'overview',
      label: <><WalletOutlined /> Overview</>,
      children: (
        <>
          {/* Stats */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            {[
              { label: 'Total Students', value: filtered.length, color: '#3B82F6', icon: <WalletOutlined />, fmt: v => v },
              { label: 'Total Collected', value: totalCollected, color: '#22C55E', icon: <CheckCircleOutlined />, fmt: v => `₹${v.toLocaleString('en-IN')}` },
              { label: 'Total Due', value: totalDue, color: '#EF4444', icon: <ExclamationCircleOutlined />, fmt: v => `₹${v.toLocaleString('en-IN')}` },
              { label: 'Fully Paid', value: paidCount, color: '#1B3A5C', icon: <CheckCircleOutlined />, fmt: v => `${v} / ${filtered.length}` },
            ].map(card => (
              <Col xs={12} sm={6} key={card.label}>
                <Card size="small" variant="borderless" style={{ borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderTop: `3px solid ${card.color}` }}>
                  <Statistic
                    title={<span style={{ fontSize: 12, color: '#64748B' }}>{card.label}</span>}
                    value={card.value}
                    prefix={<span style={{ color: card.color }}>{card.icon}</span>}
                    formatter={card.fmt}
                    styles={{ content: { fontSize: 20, fontWeight: 700, color: card.color } }}
                  />
                </Card>
              </Col>
            ))}
          </Row>

          {/* Filters */}
          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={8} md={5}>
              <Select placeholder="Filter by class" allowClear style={{ width: '100%' }}
                value={classFilter} onChange={v => setClassFilter(v)}
                options={classes.map(c => ({ label: c.name, value: c._id }))}
                id="fee-class-filter" />
            </Col>
            <Col xs={24} sm={8} md={5}>
              <Select placeholder="Filter by status" allowClear style={{ width: '100%' }}
                value={statusFilter} onChange={v => setStatusFilter(v)}
                options={[
                  { label: <><CheckCircleOutlined style={{ color: '#22C55E' }} /> Paid</>, value: 'Paid' },
                  { label: <><AlertOutlined style={{ color: '#F59E0B' }} /> Partial</>, value: 'Partial' },
                  { label: <><ExclamationCircleOutlined style={{ color: '#EF4444' }} /> Pending</>, value: 'Pending' },
                  { label: <><WarningOutlined style={{ color: '#DC2626' }} /> Overdue</>, value: 'Overdue' },
                ]}
                id="fee-status-filter" />
            </Col>
            {dueCount > 0 && (
              <Col>
                <Badge count={dueCount} color="#EF4444">
                  <Button icon={<AlertOutlined />} onClick={() => setStatusFilter('Pending')}>
                    Show Due Only
                  </Button>
                </Badge>
              </Col>
            )}
          </Row>

          {/* Table */}
          <Table
            columns={columns}
            dataSource={filtered}
            rowKey="_id"
            loading={loading}
            pagination={{ showSizeChanger: true, showTotal: t => `Total ${t} students`, pageSize: 20 }}
            scroll={{ x: 1400 }}
            size="middle"
            bordered={false}
            style={{ background: '#FFF', borderRadius: 8 }}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No fee records found" /> }}
          />
        </>
      ),
    },
    ...(isAdmin ? [
      {
        key: 'components',
        label: <><SettingOutlined /> Fee Components</>,
        children: <FeeComponents />,
      },
      {
        key: 'assign',
        label: <><TeamOutlined /> Assign Fees</>,
        children: <StudentFeeAssignment />,
      },
      {
        key: 'analytics',
        label: <><BarChartOutlined /> Analytics</>,
        children: <FeeDashboard />,
      },
    ] : []),
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <Title level={4} className="page-title" style={{ margin: 0 }}>Fee Management</Title>
        <Text type="secondary">Student-wise fee structure, invoices, collections and analytics</Text>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        style={{ marginTop: 8 }}
        size="large"
      />

      {/* Collect Fee Modal */}
      <CollectFeeModal
        open={collectModal.open}
        student={collectModal.student}
        onClose={() => setCollectModal({ open: false, student: null })}
        onSuccess={() => { setCollectModal({ open: false, student: null }); fetchOverview(); }}
      />

      {/* Payment History Drawer */}
      <PaymentHistoryDrawer
        open={historyDrawer.open}
        studentId={historyDrawer.studentId}
        studentName={historyDrawer.studentName}
        onClose={() => setHistoryDrawer({ open: false, studentId: null, studentName: '' })}
      />

      {/* Enhanced Invoice Detail Drawer */}
      <Drawer
        title={<><FileTextOutlined /> Invoice Detail {detailDrawer.invoiceNumber && `— ${detailDrawer.invoiceNumber}`}</>}
        open={detailDrawer.open}
        onClose={() => setDetailDrawer({ open: false, invoiceId: null, invoiceNumber: '' })}
        width={680}
        destroyOnClose
      >
        <FeeInvoiceDetail
          invoiceId={detailDrawer.invoiceId}
          onPaymentRecorded={fetchOverview}
          onClose={() => setDetailDrawer({ open: false, invoiceId: null, invoiceNumber: '' })}
        />
      </Drawer>
    </div>
  );
};

export default Fees;
