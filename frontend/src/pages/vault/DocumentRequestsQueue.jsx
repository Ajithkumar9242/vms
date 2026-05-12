import React, { useEffect, useState, useCallback } from 'react';
import {
  Table, Button, Space, App, Modal, Input, Tag, Select,
  Typography, Row, Col, Descriptions, Drawer, Badge,
} from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined, GiftOutlined, ReloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { vaultAPI } from '@/services/api';

const { Title, Text } = Typography;

const STATUS_COLORS = { requested: 'default', approved: 'blue', rejected: 'red', fulfilled: 'green' };
const PAY_COLORS = { unpaid: 'default', paid: 'green', refunded: 'orange' };

const DocumentRequestsQueue = () => {
  const { message, modal } = App.useApp();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState({ paymentStatus: 'paid', requestStatus: 'requested' });
  const [detail, setDetail] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [fulfillId, setFulfillId] = useState(null);
  const [vaultFileId, setVaultFileId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter.paymentStatus) params.paymentStatus = filter.paymentStatus;
      if (filter.requestStatus) params.requestStatus = filter.requestStatus;
      const res = await vaultAPI.getRequests(params);
      setRequests(res?.data?.data || res?.data || []);
    } catch (e) { message.error(e.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, [filter, message]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = (r) => {
    modal.confirm({
      title: `Approve request ${r.requestNumber}?`,
      content: (
        <Input.TextArea rows={3} placeholder="Admin notes (optional)" onChange={(e) => setAdminNotes(e.target.value)} />
      ),
      onOk: async () => {
        try {
          await vaultAPI.approveRequest(r._id, { adminNotes });
          message.success('Request approved');
          setAdminNotes('');
          load();
        } catch (e) { message.error(e.message || 'Failed'); }
      },
    });
  };

  const handleReject = (r) => {
    modal.confirm({
      title: `Reject request ${r.requestNumber}?`,
      okButtonProps: { danger: true },
      content: (
        <Input.TextArea rows={3} placeholder="Rejection reason (required)" onChange={(e) => setAdminNotes(e.target.value)} />
      ),
      onOk: async () => {
        try {
          await vaultAPI.rejectRequest(r._id, { adminNotes });
          message.success('Request rejected');
          setAdminNotes('');
          load();
        } catch (e) { message.error(e.message || 'Failed'); }
      },
    });
  };

  const handleFulfill = async () => {
    if (!vaultFileId.trim()) { message.error('Enter a vault file ID'); return; }
    try {
      await vaultAPI.fulfillRequest(fulfillId, { vaultFileId: vaultFileId.trim() });
      message.success('Request fulfilled');
      setFulfillId(null);
      setVaultFileId('');
      load();
    } catch (e) { message.error(e.message || 'Failed'); }
  };

  const columns = [
    { title: 'Req #', dataIndex: 'requestNumber', key: 'rn', width: 130, render: v => <Text code>{v}</Text> },
    { title: 'Student', key: 's', render: (_, r) => <Text strong>{r.studentId?.name || '—'}</Text> },
    { title: 'Document', key: 'd', render: (_, r) => r.catalogItemId?.name },
    { title: 'Copies', dataIndex: 'copies', key: 'c', width: 60, align: 'center' },
    { title: 'Amount', key: 'a', width: 90, align: 'right', render: (_, r) => `₹${r.netAmount}` },
    { title: 'Payment', dataIndex: 'paymentStatus', key: 'ps', width: 90, render: v => <Tag color={PAY_COLORS[v]}>{v}</Tag> },
    { title: 'Status', dataIndex: 'requestStatus', key: 'rs', width: 100, render: v => <Tag color={STATUS_COLORS[v]}>{v}</Tag> },
    { title: 'Date', key: 'dt', width: 100, render: (_, r) => dayjs(r.createdAt).format('DD MMM YY') },
    {
      title: 'Actions', key: 'act', width: 220,
      render: (_, r) => (
        <Space size="small">
          <Button size="small" onClick={() => { setDetail(r); setDrawerOpen(true); }}>View</Button>
          {r.paymentStatus === 'paid' && r.requestStatus === 'requested' && (
            <>
              <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => handleApprove(r)}>Approve</Button>
              <Button size="small" danger icon={<CloseCircleOutlined />} onClick={() => handleReject(r)}>Reject</Button>
            </>
          )}
          {r.requestStatus === 'approved' && (
            <Button size="small" icon={<GiftOutlined />} onClick={() => setFulfillId(r._id)} style={{ borderColor: '#16A34A', color: '#16A34A' }}>Fulfill</Button>
          )}
          {r.paymentStatus === 'paid' && vaultAPI.getReceiptUrl && (
            <Button size="small" href={vaultAPI.getReceiptUrl(r._id)} target="_blank">Receipt</Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>📥 Document Requests Queue</Title>
        <Space>
          <Select
            allowClear placeholder="Payment"
            style={{ width: 110 }}
            value={filter.paymentStatus}
            onChange={(v) => setFilter(f => ({ ...f, paymentStatus: v }))}
            options={[{ label: 'Paid', value: 'paid' }, { label: 'Unpaid', value: 'unpaid' }]}
          />
          <Select
            allowClear placeholder="Status"
            style={{ width: 120 }}
            value={filter.requestStatus}
            onChange={(v) => setFilter(f => ({ ...f, requestStatus: v }))}
            options={[{ label: 'Requested', value: 'requested' }, { label: 'Approved', value: 'approved' }, { label: 'Rejected', value: 'rejected' }, { label: 'Fulfilled', value: 'fulfilled' }]}
          />
          <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
        </Space>
      </Row>

      <Table columns={columns} dataSource={requests} rowKey="_id" loading={loading} size="middle" scroll={{ x: 900 }} />

      {/* Fulfill modal */}
      <Modal title="Fulfill Request" open={!!fulfillId} onCancel={() => setFulfillId(null)} onOk={handleFulfill} okText="Fulfill">
        <Text type="secondary" style={{ fontSize: 12 }}>Paste the Vault File ID (from StudentVaultAdmin) to link it to this request.</Text>
        <Input style={{ marginTop: 10 }} placeholder="Vault File ID" value={vaultFileId} onChange={e => setVaultFileId(e.target.value)} />
      </Modal>

      {/* Detail drawer */}
      <Drawer title={`Request: ${detail?.requestNumber}`} open={drawerOpen} onClose={() => setDrawerOpen(false)} width={440}>
        {detail && (
          <>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Student">{detail.studentId?.name}</Descriptions.Item>
              <Descriptions.Item label="Document">{detail.catalogItemId?.name}</Descriptions.Item>
              <Descriptions.Item label="Copies">{detail.copies}</Descriptions.Item>
              <Descriptions.Item label="Amount">₹{detail.netAmount}</Descriptions.Item>
              <Descriptions.Item label="Payment"><Tag color={PAY_COLORS[detail.paymentStatus]}>{detail.paymentStatus}</Tag></Descriptions.Item>
              <Descriptions.Item label="Status"><Tag color={STATUS_COLORS[detail.requestStatus]}>{detail.requestStatus}</Tag></Descriptions.Item>
              <Descriptions.Item label="Parent Notes">{detail.parentNotes || '—'}</Descriptions.Item>
              <Descriptions.Item label="Admin Notes">{detail.adminNotes || '—'}</Descriptions.Item>
            </Descriptions>
            <div style={{ marginTop: 16 }}>
              <Text strong style={{ fontSize: 12 }}>Audit Log</Text>
              {(detail.auditLogs || []).map((log, i) => (
                <div key={i} style={{ marginTop: 6, padding: '6px 10px', background: '#F8FAFC', borderRadius: 6, fontSize: 12 }}>
                  <strong>{log.action}</strong>
                  <div style={{ color: '#64748B' }}>{dayjs(log.performedAt).format('DD MMM YYYY HH:mm')}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </Drawer>
    </div>
  );
};

export default DocumentRequestsQueue;
