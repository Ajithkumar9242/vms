import React, { useEffect, useState, useCallback } from 'react';
import {
  Button, Select, Input, InputNumber, Typography, Row, Col,
  Table, Tag, Space, Card, Divider, App, Modal,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, FilePdfOutlined, ShoppingCartOutlined,
} from '@ant-design/icons';
import { posAPI, studentAPI } from '@/services/api';

const { Title, Text } = Typography;

const PAYMENT_MODES = [
  { label: 'Cash',        value: 'cash' },
  { label: 'UPI',         value: 'upi' },
  { label: 'Cheque',      value: 'cheque' },
  { label: 'Razorpay',    value: 'razorpay' },
];

const PosBilling = () => {
  const { message } = App.useApp();
  const [catalog, setCatalog]         = useState([]);
  const [students, setStudents]       = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [lineItems, setLineItems]     = useState([]);
  const [invoiceDiscount, setInvoiceDiscount] = useState(0);
  const [paymentMode, setPaymentMode] = useState('cash');
  const [paymentRef, setPaymentRef]   = useState('');
  const [notes, setNotes]             = useState('');
  const [saving, setSaving]           = useState(false);
  const [lastInvoice, setLastInvoice] = useState(null);
  const [pdfConfirm, setPdfConfirm]   = useState(false);

  useEffect(() => {
    posAPI.getCatalog()
      .then(res => setCatalog(res.data || []))
      .catch(() => {});
    studentAPI.getAll({ limit: 300 })
      .then(res => setStudents(res.data?.students || res.data || []))
      .catch(() => {});
  }, []);

  const addItem = (itemId) => {
    const item = catalog.find(c => c._id === itemId);
    if (!item) return;
    const existing = lineItems.find(l => l.itemId === itemId);
    if (existing) {
      setLineItems(prev => prev.map(l => l.itemId === itemId ? { ...l, qty: l.qty + 1 } : l));
    } else {
      setLineItems(prev => [...prev, { itemId: item._id, nameSnapshot: item.name, qty: 1, unitPrice: item.price, discount: 0, taxPercent: item.taxPercent || 0 }]);
    }
  };

  const updateLine = (idx, field, val) => {
    setLineItems(prev => prev.map((l, i) => i === idx ? { ...l, [field]: Number(val) || 0 } : l));
  };

  const removeLine = (idx) => setLineItems(prev => prev.filter((_, i) => i !== idx));

  const computeTotals = () => {
    const subtotal  = lineItems.reduce((s, l) => s + l.unitPrice * l.qty, 0);
    const taxTotal  = lineItems.reduce((s, l) => s + (l.unitPrice - (l.discount || 0)) * l.qty * (l.taxPercent || 0) / 100, 0);
    const grandTotal = Math.max(0, subtotal - (invoiceDiscount || 0) + taxTotal);
    return { subtotal, taxTotal, grandTotal };
  };

  const { subtotal, taxTotal, grandTotal } = computeTotals();

  const handleSave = async () => {
    if (!lineItems.length) { message.error('Add at least one item'); return; }
    if (!paymentMode) { message.error('Select payment mode'); return; }
    setSaving(true);
    try {
      const payload = {
        studentId:     selectedStudentId,
        items:         lineItems,
        paymentMode,
        discountTotal: invoiceDiscount,
        notes,
        paymentRef,
      };
      const res = await posAPI.createInvoice(payload);
      const invoice = res.data;
      setLastInvoice(invoice);
      message.success(`Invoice ${invoice.invoiceNumber} created`);
      setPdfConfirm(true);
      // Reset form
      setLineItems([]);
      setSelectedStudentId(null);
      setInvoiceDiscount(0);
      setPaymentRef('');
      setNotes('');
    } catch (e) { message.error(e.message || 'Failed to create invoice'); }
    finally { setSaving(false); }
  };

  const columns = [
    { title: 'Item', dataIndex: 'nameSnapshot', key: 'n', render: t => <Text strong>{t}</Text> },
    {
      title: 'Qty', key: 'qty', width: 80,
      render: (_, r, i) => <InputNumber min={1} size="small" value={r.qty} onChange={v => updateLine(i, 'qty', v)} style={{ width: 64 }} />,
    },
    {
      title: 'Unit ₹', key: 'up', width: 100,
      render: (_, r, i) => <InputNumber min={0} size="small" value={r.unitPrice} onChange={v => updateLine(i, 'unitPrice', v)} style={{ width: 80 }} />,
    },
    {
      title: 'Disc ₹', key: 'd', width: 100,
      render: (_, r, i) => <InputNumber min={0} size="small" value={r.discount} onChange={v => updateLine(i, 'discount', v)} style={{ width: 80 }} />,
    },
    { title: 'Tax %', dataIndex: 'taxPercent', key: 't', width: 70, render: v => `${v}%` },
    {
      title: 'Amount ₹', key: 'amt', width: 100, align: 'right',
      render: (_, r) => {
        const base = (r.unitPrice - (r.discount || 0)) * r.qty;
        const tax  = base * (r.taxPercent || 0) / 100;
        return <Text strong>₹{(base + tax).toFixed(2)}</Text>;
      },
    },
    { title: '', key: 'del', width: 40, render: (_, __, i) => <Button danger size="small" icon={<DeleteOutlined />} onClick={() => removeLine(i)} /> },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ marginBottom: 16 }}>🧾 POS / Counter Billing</Title>

      <Row gutter={16}>
        {/* Left: Item picker + line items */}
        <Col span={17}>
          <Card size="small" title="Add Items" style={{ marginBottom: 12 }}>
            <Select
              showSearch optionFilterProp="label" placeholder="Search and add item..."
              style={{ width: '100%' }}
              value={null}
              onChange={addItem}
              options={(catalog.filter(c => c.active)).map(c => ({ label: `${c.name} — ₹${c.price}`, value: c._id }))}
            />
          </Card>

          <Table
            columns={columns} dataSource={lineItems} rowKey="itemId"
            size="small" pagination={false}
            locale={{ emptyText: <div style={{ color: '#94A3B8', padding: '20px 0' }}><ShoppingCartOutlined style={{ fontSize: 24, display: 'block', marginBottom: 8 }} />Add items from the picker above</div> }}
          />
        </Col>

        {/* Right: Invoice summary + payment */}
        <Col span={7}>
          <Card size="small" title="Invoice Summary" style={{ marginBottom: 12 }}>
            <Select
              showSearch optionFilterProp="label" allowClear
              placeholder="Student (optional)"
              style={{ width: '100%', marginBottom: 10 }}
              value={selectedStudentId}
              onChange={setSelectedStudentId}
              options={students.map(s => ({ label: `${s.name} (${s.rollNo})`, value: s._id }))}
            />
            <Divider style={{ margin: '8px 0' }} />
            <Row justify="space-between"><Col>Subtotal</Col><Col><Text>₹{subtotal.toFixed(2)}</Text></Col></Row>
            <Row justify="space-between" style={{ marginTop: 4 }}>
              <Col>Discount (₹)</Col>
              <Col><InputNumber min={0} size="small" value={invoiceDiscount} onChange={v => setInvoiceDiscount(Number(v) || 0)} style={{ width: 80 }} /></Col>
            </Row>
            <Row justify="space-between" style={{ marginTop: 4 }}><Col>Tax</Col><Col><Text>₹{taxTotal.toFixed(2)}</Text></Col></Row>
            <Divider style={{ margin: '8px 0' }} />
            <Row justify="space-between">
              <Col><Text strong>Grand Total</Text></Col>
              <Col><Text strong style={{ fontSize: 16, color: 'var(--color-primary-dark)' }}>₹{grandTotal.toFixed(2)}</Text></Col>
            </Row>
          </Card>

          <Card size="small" title="Payment">
            <Select options={PAYMENT_MODES} value={paymentMode} onChange={setPaymentMode} style={{ width: '100%', marginBottom: 8 }} />
            <Input placeholder="Payment ref / transaction ID" value={paymentRef} onChange={e => setPaymentRef(e.target.value)} style={{ marginBottom: 8 }} />
            <Input.TextArea rows={2} placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} style={{ marginBottom: 12 }} />
            <Button type="primary" block loading={saving} onClick={handleSave} disabled={!lineItems.length}>
              Save Invoice
            </Button>
          </Card>
        </Col>
      </Row>

      <Modal
        title="Invoice Created!"
        open={pdfConfirm}
        onCancel={() => setPdfConfirm(false)}
        footer={[
          <Button key="close" onClick={() => setPdfConfirm(false)}>Close</Button>,
          <Button key="pdf" type="primary" icon={<FilePdfOutlined />} href={posAPI.getPdfUrl(lastInvoice?._id)} target="_blank">
            Download PDF
          </Button>,
        ]}
      >
        {lastInvoice && (
          <>
            <p><Text strong>Invoice #:</Text> {lastInvoice.invoiceNumber}</p>
            <p><Text strong>Grand Total:</Text> ₹{lastInvoice.grandTotal?.toFixed(2)}</p>
            <p><Text strong>Payment Mode:</Text> {lastInvoice.paymentMode?.toUpperCase()}</p>
          </>
        )}
      </Modal>
    </div>
  );
};

export default PosBilling;
