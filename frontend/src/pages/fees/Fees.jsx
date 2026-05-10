import React, { useEffect, useState, useCallback } from 'react';
import {
  Table, Typography, Select, Row, Col, Button, Space, App,
  Card, Statistic, Empty, Tag, Drawer, Descriptions, Divider, Badge, Tabs,
} from 'antd';
import {
  DollarOutlined, WalletOutlined, CheckCircleOutlined,
  ExclamationCircleOutlined, HistoryOutlined, FileTextOutlined,
  AlertOutlined, AppstoreOutlined, TeamOutlined, BarChartOutlined,
  SettingOutlined,
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

const statusColorMap = {
  Paid: 'green', Partial: 'orange', Pending: 'red',
  unpaid: 'red', partial: 'orange', paid: 'green', overdue: 'red',
};

const Fees = () => {
  const { message } = App.useApp();
  const user     = useAuthStore(s => s.user);
  const isAdmin  = ['admin', 'super_admin', 'principal'].includes(user?.role);
  const [activeTab, setActiveTab] = useState('overview');

  const [overview, setOverview] = useState([]);
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState([]);
  const [classFilter, setClassFilter] = useState(undefined);
  const [statusFilter, setStatusFilter] = useState(undefined);

  const [collectModal, setCollectModal] = useState({ open: false, student: null });
  const [historyDrawer, setHistoryDrawer] = useState({ open: false, studentId: null, studentName: '' });
  const [invoiceDrawer, setInvoiceDrawer] = useState({ open: false, studentId: null, studentName: '' });
  const [invoiceData, setInvoiceData] = useState(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);

  // Invoice Detail Drawer (enhanced)
  const [detailDrawer, setDetailDrawer] = useState({ open: false, invoiceId: null, invoiceNumber: '' });

  // ─── Stats ───────────────────────────────────────────────
  const filtered      = overview.filter(s => !statusFilter || s.status === statusFilter);
  const totalCollected = filtered.reduce((sum, s) => sum + s.totalPaid, 0);
  const totalDue       = filtered.reduce((sum, s) => sum + s.totalDue, 0);
  const paidCount      = filtered.filter(s => s.status === 'Paid').length;
  const dueCount       = filtered.filter(s => s.status === 'Pending' || s.status === 'Partial').length;

  // ─── Fetch overview ──────────────────────────────────────
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
    schoolAPI.getClasses({ limit: 50 }).then(res => setClasses(res.data || [])).catch(() => {});
  }, []);

  useEffect(() => { if (activeTab === 'overview') fetchOverview(); }, [fetchOverview, activeTab]);

  // ─── Invoice drawer (legacy) ─────────────────────────────
  const openInvoice = async (studentId, studentName) => {
    setInvoiceDrawer({ open: true, studentId, studentName });
    setInvoiceLoading(true);
    try {
      const res = await feesAPI.getInvoice(studentId);
      setInvoiceData(res.data);
    } catch (err) {
      message.error(err.message || 'Failed to load invoice');
    } finally {
      setInvoiceLoading(false);
    }
  };

  // ─── Open enhanced invoice detail ───────────────────────
  const openInvoiceDetail = (record) => {
    if (record.invoiceId) {
      setDetailDrawer({ open: true, invoiceId: record.invoiceId, invoiceNumber: record.invoiceNumber || '' });
    } else {
      openInvoice(record._id, record.name);
    }
  };

  // ─── Table columns ───────────────────────────────────────
  const columns = [
    { title: 'Roll No', dataIndex: 'rollNo', key: 'rollNo', width: 100, fixed: 'left' },
    {
      title: 'Student Name', dataIndex: 'name', key: 'name', width: 180,
      render: text => <Text strong>{text}</Text>,
    },
    { title: 'Class', dataIndex: 'className', key: 'className', width: 110 },
    {
      title: 'Invoice', key: 'invoice', width: 150,
      render: (_, r) => r.invoiceNumber
        ? <Tag color="blue" style={{ cursor: 'pointer', fontSize: 11 }}
            onClick={() => openInvoiceDetail(r)}>
            <FileTextOutlined /> {r.invoiceNumber}
          </Tag>
        : <Tag color="default">No Invoice</Tag>,
    },
    {
      title: 'Total Fee', dataIndex: 'totalFee', key: 'totalFee', width: 120, align: 'right',
      render: val => <Text>₹{(val ?? 0).toLocaleString('en-IN')}</Text>,
    },
    {
      title: 'Paid', dataIndex: 'totalPaid', key: 'totalPaid', width: 120, align: 'right',
      render: val => <Text style={{ color: '#22C55E', fontWeight: 600 }}>₹{(val ?? 0).toLocaleString('en-IN')}</Text>,
    },
    {
      title: 'Due', dataIndex: 'totalDue', key: 'totalDue', width: 120, align: 'right',
      sorter: (a, b) => b.totalDue - a.totalDue,
      render: val => (
        <Text style={{ color: val > 0 ? '#EF4444' : '#22C55E', fontWeight: 600 }}>
          ₹{(val ?? 0).toLocaleString('en-IN')}
        </Text>
      ),
    },
    {
      title: 'Due Date', key: 'dueDate', width: 110,
      render: (_, r) => {
        const val = r.nextDueDate || r.dueDate;
        if (!val) return '—';
        const d = dayjs(val);
        const overdue = d.isBefore(dayjs(), 'day');
        return <Text style={{ color: overdue && r.status !== 'Paid' ? '#EF4444' : undefined }}>
          {d.format('DD MMM YYYY')}
        </Text>;
      },
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 100,
      filters: [
        { text: 'Paid', value: 'Paid' },
        { text: 'Partial', value: 'Partial' },
        { text: 'Pending', value: 'Pending' },
      ],
      onFilter: (value, record) => record.status === value,
      render: status => <StatusTag status={status.toLowerCase()} />,
    },
    {
      title: 'Actions', key: 'actions', width: 230, fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          {record.status !== 'Paid' && (
            <Button type="primary" size="small" icon={<DollarOutlined />}
              onClick={() => setCollectModal({ open: true, student: { _id: record._id, name: record.name, totalDue: record.totalDue, invoiceId: record.invoiceId } })}
              id={`collect-fee-${record._id}`}>Collect</Button>
          )}
          <Button size="small" icon={<HistoryOutlined />}
            onClick={() => setHistoryDrawer({ open: true, studentId: record._id, studentName: record.name })}
            id={`view-history-${record._id}`}>History</Button>
          <Button size="small" icon={<FileTextOutlined />}
            onClick={() => openInvoiceDetail(record)}
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
            <Col xs={12} sm={6}>
              <Card size="small" variant="borderless" style={{ borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <Statistic title={<span style={{ fontSize: 12, color: '#64748B' }}>Total Students</span>}
                  value={filtered.length} prefix={<WalletOutlined style={{ color: '#3B82F6' }} />}
                  styles={{ content: { fontSize: 22, fontWeight: 700, color: '#1B3A5C' } }} />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card size="small" variant="borderless" style={{ borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <Statistic title={<span style={{ fontSize: 12, color: '#64748B' }}>Total Collected</span>}
                  value={totalCollected} prefix={<CheckCircleOutlined style={{ color: '#22C55E' }} />}
                  formatter={v => `₹${v.toLocaleString('en-IN')}`}
                  styles={{ content: { fontSize: 22, fontWeight: 700, color: '#22C55E' } }} />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card size="small" variant="borderless" style={{ borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <Statistic title={<span style={{ fontSize: 12, color: '#64748B' }}>Total Due</span>}
                  value={totalDue} prefix={<ExclamationCircleOutlined style={{ color: '#EF4444' }} />}
                  formatter={v => `₹${v.toLocaleString('en-IN')}`}
                  styles={{ content: { fontSize: 22, fontWeight: 700, color: '#EF4444' } }} />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card size="small" variant="borderless" style={{ borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <Statistic title={<span style={{ fontSize: 12, color: '#64748B' }}>Fully Paid</span>}
                  value={paidCount} suffix={<span style={{ fontSize: 13, color: '#94A3B8' }}>/ {filtered.length}</span>}
                  prefix={<CheckCircleOutlined style={{ color: '#3B82F6' }} />}
                  styles={{ content: { fontSize: 22, fontWeight: 700, color: '#1B3A5C' } }} />
              </Card>
            </Col>
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
            scroll={{ x: 1200 }}
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

      {/* Legacy Invoice Drawer (for students without invoiceId) */}
      <Drawer
        title={<><FileTextOutlined /> Invoice — {invoiceDrawer.studentName}</>}
        open={invoiceDrawer.open}
        onClose={() => { setInvoiceDrawer({ open: false, studentId: null, studentName: '' }); setInvoiceData(null); }}
        width={480}
        loading={invoiceLoading}
      >
        {invoiceData ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text strong style={{ fontSize: 16 }}>{invoiceData.invoiceNumber}</Text>
              <Tag color={statusColorMap[invoiceData.status] || 'default'} style={{ fontSize: 13, padding: '2px 10px' }}>
                {invoiceData.status?.toUpperCase()}
              </Tag>
            </div>
            <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Class">{invoiceData.classId?.name || '—'}</Descriptions.Item>
              <Descriptions.Item label="Academic Year">{invoiceData.academicYearId?.name || '—'}</Descriptions.Item>
              <Descriptions.Item label="Due Date">
                {invoiceData.dueDate ? dayjs(invoiceData.dueDate).format('DD MMM YYYY') : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Total Amount">
                <Text strong>₹{(invoiceData.totalAmount || 0).toLocaleString('en-IN')}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Paid Amount">
                <Text strong style={{ color: '#22C55E' }}>₹{(invoiceData.paidAmount || 0).toLocaleString('en-IN')}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Due Amount">
                <Text strong style={{ color: invoiceData.dueAmount > 0 ? '#EF4444' : '#22C55E' }}>
                  ₹{(invoiceData.dueAmount || 0).toLocaleString('en-IN')}
                </Text>
              </Descriptions.Item>
            </Descriptions>
            {invoiceData.feeItems?.length > 0 && (
              <>
                <Divider orientation="left" orientationMargin={0} style={{ fontSize: 12 }}>Installments</Divider>
                {invoiceData.feeItems.map((item, idx) => (
                  <div key={idx} style={{
                    display: 'flex', justifyContent: 'space-between',
                    padding: '8px 12px', background: '#F8FAFC', borderRadius: 6, marginBottom: 6,
                  }}>
                    <span>
                      <Text strong>{item.name}</Text>
                      {item.dueDate && <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>
                        Due: {dayjs(item.dueDate).format('DD MMM YYYY')}
                      </Text>}
                    </span>
                    <Text strong>₹{(item.amount || 0).toLocaleString('en-IN')}</Text>
                  </div>
                ))}
              </>
            )}
          </>
        ) : !invoiceLoading ? (
          <Empty description="No invoice found for this student" />
        ) : null}
      </Drawer>

      {/* Enhanced Invoice Detail Drawer */}
      <Drawer
        title={<><FileTextOutlined /> Invoice Detail {detailDrawer.invoiceNumber && `— ${detailDrawer.invoiceNumber}`}</>}
        open={detailDrawer.open}
        onClose={() => setDetailDrawer({ open: false, invoiceId: null, invoiceNumber: '' })}
        width={640}
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
