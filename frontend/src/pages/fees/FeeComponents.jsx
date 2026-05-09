import React, { useEffect, useState, useCallback } from 'react';
import {
  Table, Typography, Button, Space, App, Modal, Form, Input,
  InputNumber, Switch, Select, Tag, Card, Tooltip, Popconfirm,
  Row, Col, Badge, Divider,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, PoweroffOutlined,
  DollarCircleOutlined, CheckCircleOutlined, WarningOutlined,
} from '@ant-design/icons';
import { feesAPI } from '@/services/api';

const { Title, Text } = Typography;

const RECURRING_OPTS = [
  { label: 'Yearly',    value: 'yearly' },
  { label: 'Monthly',   value: 'monthly' },
  { label: 'Quarterly', value: 'quarterly' },
  { label: 'One-Time',  value: 'one_time' },
];

const LATE_TYPE_OPTS = [
  { label: 'Fixed Amount (₹)', value: 'fixed' },
  { label: 'Percentage (%)',   value: 'percent' },
];

const FREQ_OPTS = [
  { label: 'Monthly', value: 'monthly' },
  { label: 'Daily',   value: 'daily' },
];

const FeeComponents = () => {
  const { message, modal } = App.useApp();
  const [components, setComponents] = useState([]);
  const [loading, setLoading]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [modalOpen, setModalOpen]   = useState(false);
  const [editing, setEditing]       = useState(null);
  const [lateFeeEnabled, setLateFeeEnabled] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await feesAPI.getComponents();
      setComponents(res.data || []);
    } catch (e) {
      message.error(e.message || 'Failed to load components');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setLateFeeEnabled(false);
    form.resetFields();
    form.setFieldsValue({
      recurringType: 'yearly',
      mandatory: false,
      allowInstallments: true,
      active: true,
      lateFeeConfig: { enabled: false, type: 'fixed', value: 0, frequency: 'monthly' },
    });
    setModalOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    setLateFeeEnabled(record.lateFeeConfig?.enabled || false);
    form.setFieldsValue({
      name:              record.name,
      code:              record.code,
      description:       record.description,
      amount:            record.amount,
      mandatory:         record.mandatory,
      recurringType:     record.recurringType,
      allowInstallments: record.allowInstallments,
      active:            record.active,
      lateFeeConfig:     record.lateFeeConfig,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      if (editing) {
        await feesAPI.updateComponent(editing._id, values);
        message.success('Component updated');
      } else {
        await feesAPI.createComponent(values);
        message.success('Component created');
      }
      setModalOpen(false);
      load();
    } catch (e) {
      if (e.errorFields) return; // validation error
      message.error(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (record) => {
    try {
      await feesAPI.toggleComponent(record._id);
      message.success(`Component ${record.active ? 'deactivated' : 'activated'}`);
      load();
    } catch (e) {
      message.error(e.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      await feesAPI.deleteComponent(id);
      message.success('Component deactivated');
      load();
    } catch (e) {
      message.error(e.message);
    }
  };

  const mandatoryCount = components.filter(c => c.mandatory).length;
  const activeCount    = components.filter(c => c.active).length;
  const totalAmount    = components.filter(c => c.active && c.mandatory).reduce((s, c) => s + c.amount, 0);

  const columns = [
    {
      title: 'Component',
      key: 'name',
      render: (_, r) => (
        <div>
          <Text strong style={{ fontSize: 14 }}>{r.name}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>{r.code} · {r.description || '—'}</Text>
        </div>
      ),
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right',
      render: v => <Text strong style={{ color: '#1B3A5C' }}>₹{(v || 0).toLocaleString('en-IN')}</Text>,
    },
    {
      title: 'Type',
      key: 'recurringType',
      render: (_, r) => (
        <Space direction="vertical" size={2}>
          <Tag color="blue">{(r.recurringType || 'yearly').replace('_', ' ')}</Tag>
          {r.mandatory && <Tag color="red" icon={<CheckCircleOutlined />}>Mandatory</Tag>}
        </Space>
      ),
    },
    {
      title: 'Late Fee',
      key: 'lateFee',
      render: (_, r) => r.lateFeeConfig?.enabled ? (
        <Tag color="orange" icon={<WarningOutlined />}>
          {r.lateFeeConfig.type === 'percent'
            ? `${r.lateFeeConfig.value}% ${r.lateFeeConfig.frequency}`
            : `₹${r.lateFeeConfig.value} ${r.lateFeeConfig.frequency}`}
        </Tag>
      ) : <Tag>None</Tag>,
    },
    {
      title: 'Status',
      key: 'active',
      render: (_, r) => (
        <Tag color={r.active ? 'green' : 'default'}>{r.active ? 'Active' : 'Inactive'}</Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 160,
      render: (_, r) => (
        <Space>
          <Tooltip title="Edit"><Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} /></Tooltip>
          <Tooltip title={r.active ? 'Deactivate' : 'Activate'}>
            <Button size="small" icon={<PoweroffOutlined />}
              type={r.active ? 'default' : 'primary'}
              onClick={() => handleToggle(r)}
            />
          </Tooltip>
          <Popconfirm title="Deactivate this component?" onConfirm={() => handleDelete(r._id)}>
            <Tooltip title="Remove"><Button size="small" danger icon={<DeleteOutlined />} /></Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* Summary Cards */}
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        {[
          { label: 'Total Components', value: components.length, color: '#3B82F6' },
          { label: 'Mandatory',        value: mandatoryCount,    color: '#EF4444' },
          { label: 'Active',           value: activeCount,       color: '#22C55E' },
          { label: 'Base Fee (Mandatory Active)', value: `₹${totalAmount.toLocaleString('en-IN')}`, color: '#1B3A5C' },
        ].map(card => (
          <Col xs={12} sm={6} key={card.label}>
            <Card size="small" style={{ borderRadius: 10, borderTop: `3px solid ${card.color}` }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: card.color }}>{card.value}</div>
              <div style={{ fontSize: 11, color: '#64748B' }}>{card.label}</div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Header + Add Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Text strong style={{ fontSize: 15 }}>Fee Components</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            Mandatory components auto-apply to ALL students. Optional ones are selectable per student.
          </Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} id="btn-add-fee-component">
          Add Component
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={components}
        rowKey="_id"
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: true }}
        size="middle"
        bordered={false}
        rowClassName={r => !r.active ? 'ant-table-row-disabled' : ''}
        style={{ background: '#FFF', borderRadius: 8 }}
      />

      {/* Create / Edit Modal */}
      <Modal
        title={editing ? `Edit: ${editing.name}` : 'Create Fee Component'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        confirmLoading={saving}
        width={600}
        okText={editing ? 'Save Changes' : 'Create'}
        destroyOnClose
      >
        <Form form={form} layout="vertical" size="middle">
          <Row gutter={12}>
            <Col span={16}>
              <Form.Item name="name" label="Component Name" rules={[{ required: true }]}>
                <Input placeholder="e.g. Tuition Fee, Hostel Fee" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="code" label="Code" rules={[{ required: true }]}
                tooltip="Short unique code e.g. TUITION, HOSTEL">
                <Input placeholder="TUITION" style={{ textTransform: 'uppercase' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="Description (optional)">
            <Input placeholder="Brief description" />
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="amount" label="Amount (₹)" rules={[{ required: true }]}>
                <InputNumber min={0} style={{ width: '100%' }} prefix="₹" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="recurringType" label="Recurring Type">
                <Select options={RECURRING_OPTS} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="mandatory" label="Mandatory" valuePropName="checked">
                <Switch checkedChildren="Yes" unCheckedChildren="No" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="allowInstallments" label="Allow Installments" valuePropName="checked">
                <Switch checkedChildren="Yes" unCheckedChildren="No" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="active" label="Active" valuePropName="checked">
                <Switch checkedChildren="Yes" unCheckedChildren="No" />
              </Form.Item>
            </Col>
          </Row>

          <Divider>Late Fee Configuration</Divider>

          <Form.Item name={['lateFeeConfig', 'enabled']} label="Enable Late Fee" valuePropName="checked">
            <Switch onChange={setLateFeeEnabled} />
          </Form.Item>

          {lateFeeEnabled && (
            <Row gutter={12}>
              <Col span={8}>
                <Form.Item name={['lateFeeConfig', 'type']} label="Type">
                  <Select options={LATE_TYPE_OPTS} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name={['lateFeeConfig', 'value']} label="Value">
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name={['lateFeeConfig', 'frequency']} label="Frequency">
                  <Select options={FREQ_OPTS} />
                </Form.Item>
              </Col>
            </Row>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default FeeComponents;
