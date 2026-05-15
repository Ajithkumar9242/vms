import React, { useState, useEffect, useCallback } from 'react';
import {
  Descriptions, Tag, Button, Space, App, Divider, Table, Modal,
  Form, InputNumber, Input, Select, Typography, Row, Col, Card,
  Alert, Statistic, Tooltip, Spin, Badge,
} from 'antd';
import {
  LockOutlined, UnlockOutlined, DollarOutlined, WarningOutlined,
  DownloadOutlined, CheckCircleOutlined, ExclamationCircleOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { feesAPI } from '@/services/api';
import useAuthStore from '@/store/authStore';

const { Title, Text } = Typography;

const PAY_MODES = [
  { label: 'Cash',          value: 'cash' },
  { label: 'UPI',           value: 'upi' },
  { label: 'Cheque',        value: 'cheque' },
  { label: 'Online',        value: 'online' },
  { label: 'Bank Transfer', value: 'bank_transfer' },
  { label: 'Razorpay',      value: 'razorpay' },
];

const statusColor = { paid: 'green', partial: 'orange', unpaid: 'red', overdue: 'red' };

const FeeInvoiceDetail = ({ invoiceId, onClose, onPaymentRecorded }) => {
  const { message, modal } = App.useApp();
  const user   = useAuthStore(s => s.user);
  const isAdmin= ['admin', 'super_admin', 'principal'].includes(user?.role);

  const [invoice, setInvoice]         = useState(null);
  const [loading, setLoading]         = useState(false);
  const [payModal, setPayModal]       = useState({ open: false, installmentId: null });
  const [penaltyModal, setPenaltyModal] = useState(false);
  const [waiveModal, setWaiveModal]   = useState(false);
  const [payForm] = Form.useForm();
  const [penaltyForm] = Form.useForm();
  const [waiveForm] = Form.useForm();

  const load = useCallback(async () => {
    if (!invoiceId) return;
    setLoading(true);
    try {
      const res = await feesAPI.getInvoiceById(invoiceId);
      setInvoice(res.data);
    } catch (e) {
      message.error(e.message || 'Failed to load invoice');
    } finally {
      setLoading(false);
    }
  }, [invoiceId, message]);

  useEffect(() => { load(); }, [load]);

  if (!invoiceId) return null;

  const handlePayInstallment = async () => {
    try {
      const values = await payForm.validateFields();
      await feesAPI.payInstallment(invoiceId, { ...values, installmentId: payModal.installmentId });
      message.success('Payment recorded successfully');
      setPayModal({ open: false, installmentId: null });
      payForm.resetFields();
      load();
      onPaymentRecorded?.();
    } catch (e) {
      if (e.errorFields) return;
      message.error(e.message || 'Payment failed');
    }
  };

  const handleApplyPenalty = async () => {
    try {
      const values = await penaltyForm.validateFields();
      await feesAPI.applyPenalty(invoiceId, values);
      message.success('Penalty applied');
      setPenaltyModal(false);
      penaltyForm.resetFields();
      load();
    } catch (e) {
      if (e.errorFields) return;
      message.error(e.message);
    }
  };

  const handleWaivePenalty = async () => {
    try {
      const values = await waiveForm.validateFields();
      await feesAPI.waivePenalty(invoiceId, values);
      message.success('Penalty waived');
      setWaiveModal(false);
      waiveForm.resetFields();
      load();
    } catch (e) {
      if (e.errorFields) return;
      message.error(e.message);
    }
  };

  const handleLock = () => {
    modal.confirm({
      title: 'Lock this invoice?',
      content: 'Once locked, no payments or modifications can be made without admin unlock.',
      icon: <LockOutlined />,
      okText: 'Lock',
      okButtonProps: { danger: true },
      onOk: async () => {
        await feesAPI.lockInvoice(invoiceId);
        message.success('Invoice locked');
        load();
      },
    });
  };

  const handleUnlock = async () => {
    await feesAPI.unlockInvoice(invoiceId);
    message.success('Invoice unlocked');
    load();
  };

  const handleRegenerateSchedule = () => {
    modal.confirm({
      title: 'Regenerate Payment Schedule?',
      content: 'This will sync the invoice installments with the latest Student Fee Profile. Paid amounts will be preserved. Are you sure?',
      icon: <WarningOutlined />,
      okText: 'Regenerate',
      onOk: async () => {
        try {
          await feesAPI.regenerateSchedule(invoiceId);
          message.success('Schedule regenerated successfully');
          load();
        } catch (e) {
          message.error(e.message || 'Failed to regenerate schedule');
        }
      },
    });
  };

  const handleDownloadPDF = () => {
    window.open(feesAPI.getInvoicePdfUrlWithToken(invoiceId), '_blank', 'noopener');
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>;
  if (!invoice) return null;

  const student     = invoice.studentId || {};
  const cls         = invoice.classId   || {};
  const section     = invoice.sectionId || {};
  const ay          = invoice.academicYearId || {};
  const status      = invoice.status || 'unpaid';
  // Use netFee (new schema) with fallback to totalAmount (legacy)
  const grossFee    = invoice.grossFee   || invoice.totalAmount || 0;
  const netFee      = invoice.netFee     || Math.max(0, grossFee - (invoice.discountAmount || 0));
  const netTotal    = netFee + (invoice.penaltyAmount || 0) - (invoice.waivedAmount || 0);
  const balanceDue  = invoice.dueAmount  || Math.max(0, netTotal - (invoice.paidAmount || 0));
  const installments = invoice.installments || [];
  const nextInstallmentDueDate = installments
    .filter((i) => i.dueDate && i.status !== 'paid' && ((i.balanceAmount ?? Math.max(0, (i.amount || 0) - (i.paidAmount || 0))) > 0))
    .sort((a, b) => dayjs(a.dueDate).valueOf() - dayjs(b.dueDate).valueOf())[0]?.dueDate;
  // selectedComponents from populated feeProfileId or directly from feeProfileId
  const selectedComponents = invoice.feeProfileId?.selectedComponents || [];

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Lock Warning */}
      {invoice.locked && (
        <Alert type="warning" icon={<LockOutlined />}
          message="This invoice is locked. No payments or edits allowed."
          style={{ marginBottom: 16 }} showIcon />
      )}

      {/* Header Card */}
      <Card size="small" style={{ marginBottom: 16, background: 'linear-gradient(135deg, #F8FAFC, var(--color-primary-light))', borderRadius: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-primary-dark)' }}>
              <FileTextOutlined style={{ marginRight: 8 }} />
              {invoice.invoiceNumber}
            </div>
            <Row gutter={[12, 6]} style={{ marginTop: 10, maxWidth: 720 }}>
              {[
                ['Student Name', student.name],
                ['Admission No', student.admissionNo || student.admissionNumber],
                ['Register No', student.registerNo],
                ['Class', cls.name],
                ['Section', section.name],
                ['Parent/Guardian', student.parentName],
                ['Phone', student.parentPhone],
                ['Academic Year', ay.name || ay.label],
              ].map(([label, value]) => (
                <Col xs={12} sm={6} key={label}>
                  <div style={{ fontSize: 10, color: '#64748B', textTransform: 'uppercase' }}>{label}</div>
                  <div style={{ fontSize: 12, color: '#0F172A', fontWeight: 600 }}>{value || '—'}</div>
                </Col>
              ))}
            </Row>
          </div>
          <Space>
            <Tag color={statusColor[status] || 'default'} style={{ fontSize: 13, padding: '4px 12px' }}>
              {status.toUpperCase()}
            </Tag>
            {invoice.locked && <Tag color="red" icon={<LockOutlined />}>LOCKED</Tag>}
          </Space>
        </div>
      </Card>

      {/* Amount Summary */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
      {[
          { label: 'Gross Fee',    value: grossFee,                       color: 'var(--color-primary-dark)' },
          { label: 'Discount',     value: invoice.discountAmount || 0,    color: '#16A34A', isNegative: true },
          { label: 'Net Fee',      value: netFee,                         color: 'var(--color-primary-dark)' },
          { label: 'Penalty',      value: invoice.penaltyAmount || 0,     color: '#EF4444' },
          { label: 'Amount Paid',  value: invoice.paidAmount || 0,        color: 'var(--color-primary)' },
          { label: 'Balance Due',  value: balanceDue,                     color: balanceDue > 0 ? '#EF4444' : '#16A34A' },
        ].map(item => (
          <Col xs={12} sm={8} md={4} key={item.label} style={{ flex: 1 }}>
            <Card size="small" style={{ borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: item.color }}>
                {item.isNegative && item.value > 0 ? '-' : ''}₹{Math.abs(item.value).toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: 11, color: '#64748B' }}>{item.label}</div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Actions */}
      {isAdmin && (
        <Space wrap style={{ marginBottom: 16 }}>
          {!invoice.locked && status !== 'paid' && (
            <Button type="primary" icon={<DollarOutlined />}
              onClick={() => setPayModal({ open: true, installmentId: null })}>
              Record Payment
            </Button>
          )}
          {!invoice.locked && status !== 'paid' && (
            <Button icon={<WarningOutlined />} onClick={() => setPenaltyModal(true)}>
              Apply Penalty
            </Button>
          )}
          {!invoice.locked && (invoice.penaltyAmount || 0) > 0 && (
            <Button icon={<CheckCircleOutlined />} onClick={() => setWaiveModal(true)}>
              Waive Penalty
            </Button>
          )}
          {invoice.locked
            ? <Button icon={<UnlockOutlined />} type="primary" onClick={handleUnlock}>Unlock</Button>
            : <Button icon={<LockOutlined />} danger onClick={handleLock}>Lock Invoice</Button>
          }
          {!invoice.locked && status !== 'paid' && (
            <Button onClick={handleRegenerateSchedule}>Regenerate Schedule</Button>
          )}
          <Button icon={<DownloadOutlined />} onClick={handleDownloadPDF}>Download PDF</Button>
        </Space>
      )}

      {/* Auto-Penalty / Overdue Notice */}
      {((invoice.penaltyConfig?.enabled || invoice.penaltyAmount > 0) && status !== 'paid') && (
        <Alert
          type="warning"
          icon={<ExclamationCircleOutlined />}
          showIcon
          style={{ marginBottom: 12, borderRadius: 8 }}
          message={
            <span>
              ⚡ <strong>Auto-calculated Late Fee:</strong> ₹{(invoice.penaltyAmount || 0).toLocaleString('en-IN')}
              {nextInstallmentDueDate && (() => {
                const due = nextInstallmentDueDate;
                return (
                  <span style={{ marginLeft: 8, color: '#64748B', fontSize: 12 }}>
                    · Due {dayjs(due).format('DD MMM YYYY')}
                    {dayjs().isAfter(due, 'day') && (
                      <span style={{ color: '#DC2626', marginLeft: 4, fontWeight: 600 }}>
                        · {dayjs().diff(dayjs(due), 'day')} days overdue
                      </span>
                    )}
                  </span>
                );
              })()}
            </span>
          }
        />
      )}

      {/* Fee Components Table */}
      <Divider orientation="left" style={{ fontSize: 13 }}>Fee Components</Divider>
      {selectedComponents.length > 0 ? (
        <Table
          dataSource={selectedComponents}
          rowKey={(r, i) => r.componentId?._id || r.componentId || i}
          size="small"
          pagination={false}
          style={{ marginBottom: 16 }}
          columns={[
            { title: 'Component', key: 'name', render: (_, r) => <Text strong>{r.name || r.componentId?.name || '—'}</Text> },
            { title: 'Type', dataIndex: 'recurringType', key: 'type', render: (v, r) => <Tag>{((v || r.componentId?.recurringType || 'yearly')).toUpperCase()}</Tag> },
            { title: 'Mandatory', dataIndex: 'mandatory', render: v => <Tag color={v ? 'red' : 'default'}>{v ? 'Yes' : 'No'}</Tag> },
            { title: 'Amount', dataIndex: 'amount', align: 'right', render: (v, r) => `₹${((v || r.componentId?.amount || 0)).toLocaleString('en-IN')}` },
          ]}
        />
      ) : (
        <Alert type="info" message="No components linked to this invoice." style={{ marginBottom: 16 }} />
      )}

      {/* Payment Schedule Table */}
      <Divider orientation="left" style={{ fontSize: 13 }}>Payment Schedule</Divider>
      {installments && installments.length > 0 ? (
        <>
          {/* Warn if any installment has no due date */}
          {installments.some(i => !i.dueDate) && (
            <Alert type="warning" showIcon style={{ marginBottom: 8, borderRadius: 6 }}
              message="Some installments have no due date. Go to Assign Fees → Sch. and set due dates, then click Regenerate Schedule." />
          )}
          <Table
            dataSource={installments}
            rowKey="_id"
            size="small"
            pagination={false}
            style={{ marginBottom: 16 }}
            columns={[
              { title: '#', dataIndex: 'installmentNo', width: 40 },
              {
                title: 'Installment', dataIndex: 'label', key: 'label',
                render: v => <Text strong>{v}</Text>,
              },
              {
                title: 'Due Date', dataIndex: 'dueDate',
                render: (v, r) => v ? (
                  <Space>
                    {dayjs(v).format('DD MMM YYYY')}
                    {r.status !== 'paid' && dayjs().isAfter(v) && (
                      <Badge count={`${dayjs().diff(v, 'day')} days overdue`} color="red" />
                    )}
                  </Space>
                ) : <Tag color="orange">No Due Date</Tag>
              },
              { title: 'Amount', dataIndex: 'amount', align: 'right', render: v => `₹${(v||0).toLocaleString('en-IN')}` },
              { title: 'Paid', dataIndex: 'paidAmount', align: 'right', render: v => <Text style={{ color: '#16A34A' }}>₹{(v||0).toLocaleString('en-IN')}</Text> },
              {
                title: 'Balance', align: 'right',
                render: (_, r) => {
                  const bal = r.balanceAmount != null ? r.balanceAmount : Math.max(0, (r.amount || 0) - (r.paidAmount || 0));
                  return <Text style={{ color: bal > 0 ? '#EF4444' : '#16A34A', fontWeight: 600 }}>₹{bal.toLocaleString('en-IN')}</Text>;
                },
              },
              {
                title: 'Status', dataIndex: 'status',
                render: s => <Tag color={statusColor[s] || 'default'}>{(s||'pending').toUpperCase()}</Tag>,
              },
              {
                title: 'Receipt', dataIndex: 'receiptNumber',
                render: v => v ? <Tag color="orange">{v}</Tag> : '—',
              },
              isAdmin && !invoice.locked && status !== 'paid' ? {
                title: 'Pay',
                render: (_, r) => r.status !== 'paid' && (
                  <Button size="small" type="primary"
                    onClick={() => setPayModal({ open: true, installmentId: r._id })}>
                    Pay
                  </Button>
                ),
              } : {},
            ].filter(c => Object.keys(c).length > 0)}
          />
        </>
      ) : (
        <Alert type="warning" showIcon style={{ marginBottom: 16, borderRadius: 8 }}
          message={
            <span>
              <strong>No payment schedule found.</strong>{' '}
              Go to <strong>Fees → Assign Fees</strong>, click the <strong>Sch.</strong> button for this student,
              add installments with due dates (total must equal net fee ₹{netFee.toLocaleString('en-IN')}),
              save, and then click <strong>"Regenerate Schedule"</strong> above.
            </span>
          }
        />
      )}


      {/* Waiver / Penalty History */}
      {(invoice.waivedAmount > 0 || invoice.penaltyAmount > 0) && (
        <>
          <Divider orientation="left" style={{ fontSize: 13 }}>Penalty & Waiver</Divider>
          <Descriptions size="small" column={2} bordered>
            <Descriptions.Item label="Current Penalty">
              <Text style={{ color: '#EF4444' }}>₹{(invoice.penaltyAmount || 0).toLocaleString('en-IN')}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Total Waived">
              <Text style={{ color: '#16A34A' }}>₹{(invoice.waivedAmount || 0).toLocaleString('en-IN')}</Text>
            </Descriptions.Item>
            {invoice.waivedBy?.name && (
              <Descriptions.Item label="Waived By">{invoice.waivedBy.name}</Descriptions.Item>
            )}
            {invoice.waivedReason && (
              <Descriptions.Item label="Waiver Reason">{invoice.waivedReason}</Descriptions.Item>
            )}
          </Descriptions>
        </>
      )}

      {/* Student Info */}
      <Divider orientation="left" style={{ fontSize: 13 }}>Student Information</Divider>
      <Descriptions size="small" column={2} bordered>
        <Descriptions.Item label="Name">{student.name || '—'}</Descriptions.Item>
        <Descriptions.Item label="Admission No">{student.admissionNo || student.admissionNumber || '—'}</Descriptions.Item>
        <Descriptions.Item label="Register No">{student.registerNo || '—'}</Descriptions.Item>
        <Descriptions.Item label="Roll No">{student.rollNo || '—'}</Descriptions.Item>
        <Descriptions.Item label="Class">{cls.name || '—'}</Descriptions.Item>
        <Descriptions.Item label="Section">{section.name || '—'}</Descriptions.Item>
        <Descriptions.Item label="Parent">{student.parentName || '—'}</Descriptions.Item>
        <Descriptions.Item label="Phone">{student.parentPhone || '—'}</Descriptions.Item>
        <Descriptions.Item label="Next Due Date">
          {invoice.nextDueDate ? dayjs(invoice.nextDueDate).format('DD MMM YYYY') : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Created">
          {dayjs(invoice.createdAt).format('DD MMM YYYY')}
        </Descriptions.Item>
        {invoice.locked && (
          <Descriptions.Item label="Locked By">
            {invoice.lockedBy?.name || '—'} · {invoice.lockedAt ? dayjs(invoice.lockedAt).format('DD MMM YYYY') : ''}
          </Descriptions.Item>
        )}
      </Descriptions>

      {/* Payment Modal */}
      <Modal title="Record Payment" open={payModal.open}
        onOk={handlePayInstallment}
        onCancel={() => { setPayModal({ open: false, installmentId: null }); payForm.resetFields(); }}
        okText="Record" destroyOnClose>
        <Form form={payForm} layout="vertical">
          <Form.Item name="amount" label="Amount (₹)" rules={[{ required: true }]}>
            <InputNumber min={1} max={balanceDue || undefined} style={{ width: '100%' }} prefix="₹" />
          </Form.Item>
          <Form.Item name="paymentMode" label="Payment Mode" rules={[{ required: true }]}>
            <Select options={PAY_MODES} />
          </Form.Item>
          <Form.Item name="transactionId" label="Transaction / Reference ID">
            <Input placeholder="Optional" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Penalty Modal */}
      <Modal title="Apply Late Fee / Penalty" open={penaltyModal}
        onOk={handleApplyPenalty}
        onCancel={() => { setPenaltyModal(false); penaltyForm.resetFields(); }}
        okText="Apply" destroyOnClose>
        <Form form={penaltyForm} layout="vertical">
          <Form.Item name="type" label="Penalty Type" rules={[{ required: true }]}
            initialValue="fixed">
            <Select options={[
              { label: 'Fixed Amount (₹)', value: 'fixed' },
              { label: 'Percentage of Due (%)', value: 'percent' },
            ]} />
          </Form.Item>
          <Form.Item name="value" label="Value" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Waive Penalty Modal */}
      <Modal title="Waive Penalty" open={waiveModal}
        onOk={handleWaivePenalty}
        onCancel={() => { setWaiveModal(false); waiveForm.resetFields(); }}
        okText="Waive" destroyOnClose>
        <Form form={waiveForm} layout="vertical">
          <Form.Item name="waiveAmount" label={`Waive Amount (max ₹${(invoice?.penaltyAmount||0).toLocaleString('en-IN')})`}>
            <InputNumber min={0} max={invoice?.penaltyAmount} style={{ width: '100%' }} prefix="₹"
              placeholder="Leave blank to waive all" />
          </Form.Item>
          <Form.Item name="reason" label="Reason for Waiver" rules={[{ required: true }]}>
            <Input.TextArea rows={2} placeholder="e.g. Medical emergency, already paid on time" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default FeeInvoiceDetail;
