import React, { useEffect, useState, useCallback } from 'react';
import {
  Table, Button, Space, App, Modal, Input, Select, Tag,
  Typography, Row, Col, Drawer, Descriptions,
} from 'antd';
import {
  FilePdfOutlined, CloseCircleOutlined, AuditOutlined, ReloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { invoiceRegistryAPI } from '@/services/api';

const { Title, Text } = Typography;

const TYPE_COLORS  = { fees: 'blue', pos: 'purple', vault: 'cyan' };
const STATUS_COLOR = (s) => ({ paid: 'green', unpaid: 'default', partial: 'orange', overdue: 'red', cancelled: 'red', fulfilled: 'green', approved: 'blue', requested: 'default', rejected: 'red' }[s] || 'default');

const InvoiceRegistry = () => {
  const { message, modal } = App.useApp();
  const [data, setData]         = useState([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(false);
  const [filters, setFilters]   = useState({ type: undefined, status: undefined });
  const [cancelReason, setCancelReason] = useState('');
  const [auditData, setAuditData]       = useState(null);
  const [auditOpen, setAuditOpen]       = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await invoiceRegistryAPI.list({ ...filters, limit: 100 });
      const payload = res.data;
      setData(payload?.data || payload || []);
      setTotal(payload?.total || 0);
    } catch (e) { message.error(e.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, [filters, message]);

  useEffect(() => { load(); }, [load]);

  const handleCancel = (r) => {
    if (!r.canCancel) { message.warning('This invoice cannot be cancelled from the registry.'); return; }
    modal.confirm({
      title: `Cancel invoice ${r.invoiceNumber}?`,
      okButtonProps: { danger: true },
      content: <Input.TextArea rows={3} placeholder="Reason (required)" onChange={e => setCancelReason(e.target.value)} />,
      onOk: async () => {
        try {
          if (!cancelReason.trim()) { message.error('Reason is required'); return; }
          await invoiceRegistryAPI.cancel(r._id, r.type, { cancelReason });
          message.success('Invoice cancelled');
          setCancelReason('');
          load();
        } catch (e) { message.error(e.message || 'Cancel failed'); }
      },
    });
  };

  const openAudit = async (r) => {
    try {
      const res = await invoiceRegistryAPI.getAudit(r._id, r.type);
      setAuditData({ logs: res.data || [], inv: r });
      setAuditOpen(true);
    } catch (e) { message.error(e.message || 'Failed to load audit'); }
  };

  const columns = [
    { title: 'Type', dataIndex: 'type', key: 'type', width: 70, render: v => <Tag color={TYPE_COLORS[v]}>{v?.toUpperCase()}</Tag> },
    { title: 'Invoice #', dataIndex: 'invoiceNumber', key: 'inv', width: 150, render: v => <Text code style={{ fontSize: 11 }}>{v}</Text> },
    { title: 'Student', dataIndex: 'studentName', key: 'sn', render: v => <Text strong>{v}</Text> },
    { title: 'Amount (₹)', dataIndex: 'amount', key: 'amt', width: 100, align: 'right', render: v => `₹${(v || 0).toLocaleString('en-IN')}` },
    { title: 'Paid (₹)',   dataIndex: 'paidAmount', key: 'pa', width: 100, align: 'right', render: v => `₹${(v || 0).toLocaleString('en-IN')}` },
    { title: 'Status', dataIndex: 'status', key: 'st', width: 100, render: v => <Tag color={STATUS_COLOR(v)}>{v?.toUpperCase()}</Tag> },
    { title: 'Date', key: 'dt', width: 100, render: (_, r) => dayjs(r.createdAt).format('DD MMM YY') },
    {
      title: 'Actions', key: 'act', width: 180,
      render: (_, r) => (
        <Space size="small">
          <Button size="small" icon={<FilePdfOutlined />} href={invoiceRegistryAPI.getPdfUrl(r._id, r.type)} target="_blank">PDF</Button>
          <Button size="small" icon={<AuditOutlined />} onClick={() => openAudit(r)}>Audit</Button>
          {r.canCancel && (
            <Button size="small" danger icon={<CloseCircleOutlined />} onClick={() => handleCancel(r)}>Cancel</Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>📊 Invoice Registry</Title>
        <Space>
          <Select
            allowClear placeholder="All Types"
            style={{ width: 120 }}
            value={filters.type}
            onChange={v => setFilters(f => ({ ...f, type: v }))}
            options={[{ label: 'Fees', value: 'fees' }, { label: 'POS', value: 'pos' }, { label: 'Vault', value: 'vault' }]}
          />
          <Select
            allowClear placeholder="All Status"
            style={{ width: 120 }}
            value={filters.status}
            onChange={v => setFilters(f => ({ ...f, status: v }))}
            options={[{ label: 'Paid', value: 'paid' }, { label: 'Unpaid', value: 'unpaid' }, { label: 'Partial', value: 'partial' }, { label: 'Cancelled', value: 'cancelled' }]}
          />
          <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
        </Space>
      </Row>

      <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 12 }}>
        Showing {data.length} of {total} records. Fee invoices are read-only. Only POS invoices can be cancelled here.
      </Text>

      <Table columns={columns} dataSource={data} rowKey={r => `${r.type}-${r._id}`} loading={loading} size="middle" scroll={{ x: 900 }} />

      <Drawer title={`Audit — ${auditData?.inv?.invoiceNumber}`} open={auditOpen} onClose={() => setAuditOpen(false)} width={440}>
        {(auditData?.logs || []).map((log, i) => (
          <div key={i} style={{ marginBottom: 10, padding: '8px 12px', background: i % 2 === 0 ? '#F8FAFC' : '#FFF', borderRadius: 8, border: '1px solid #E2E8F0' }}>
            <Text strong style={{ fontSize: 13 }}>{log.action}</Text>
            {log.performedAt && <div style={{ color: '#64748B', fontSize: 11, marginTop: 2 }}>{dayjs(log.performedAt).format('DD MMM YYYY, HH:mm:ss')}</div>}
            {log.meta && Object.keys(log.meta).length > 0 && (
              <div style={{ fontSize: 11, color: '#475569', marginTop: 4, fontFamily: 'monospace' }}>
                {JSON.stringify(log.meta)}
              </div>
            )}
          </div>
        ))}
        {!auditData?.logs?.length && <Text type="secondary">No audit entries.</Text>}
      </Drawer>
    </div>
  );
};

export default InvoiceRegistry;
