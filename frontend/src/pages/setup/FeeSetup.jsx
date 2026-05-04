import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, InputNumber,
  Select, Tabs, Tag, message, Typography, Space, Switch,
  DatePicker, Row, Col, Alert, Badge, Tooltip,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  ThunderboltOutlined, OrderedListOutlined,
} from '@ant-design/icons';
import { setupAPI, schoolAPI } from '@/services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

// ─── Helper ───────────────────────────────────────────────────
const extractList = (res) => {
  if (!res) return [];
  if (Array.isArray(res))      return res;
  if (Array.isArray(res.data)) return res.data;
  return [];
};

const STATUS_COLOR = { pending: 'default', partial: 'orange', paid: 'green' };

// ═════════════════════════════════════════════════════════════
//  FEE GROUPS TAB
// ═════════════════════════════════════════════════════════════
const FeeGroupsTab = () => {
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [modal,   setModal]   = useState({ open: false, record: null });
  const [form]                = Form.useForm();
  const [saving,  setSaving]  = useState(false);

  const load = () => {
    setLoading(true);
    setupAPI.getFeeGroups()
      .then((res) => setData(extractList(res)))
      .catch((e) => message.error(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openModal = (record = null) => {
    setModal({ open: true, record });
    if (record) form.setFieldsValue(record); else form.resetFields();
  };

  const onFinish = async (values) => {
    setSaving(true);
    try {
      if (modal.record) {
        await setupAPI.updateFeeGroup(modal.record._id, values);
        message.success('Fee Group updated');
      } else {
        await setupAPI.createFeeGroup(values);
        message.success('Fee Group created');
      }
      setModal({ open: false, record: null });
      load();
    } catch (e) { message.error(e.message); }
    finally { setSaving(false); }
  };

  const cols = [
    { title: 'Name',        dataIndex: 'name' },
    { title: 'Description', dataIndex: 'description', render: (v) => v || '—' },
    {
      title: 'Status', dataIndex: 'isActive',
      render: (v) => <Tag color={v ? 'green' : 'red'}>{v ? 'Active' : 'Inactive'}</Tag>,
    },
    {
      title: '', key: 'act', width: 60,
      render: (_, r) => <Button size="small" icon={<EditOutlined />} onClick={() => openModal(r)} />,
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => openModal()}>
          New Fee Group
        </Button>
      </div>
      <Table rowKey="_id" columns={cols} dataSource={data} loading={loading} pagination={false} size="small" />
      <Modal
        title={modal.record ? 'Edit Fee Group' : 'New Fee Group'}
        open={modal.open}
        onCancel={() => setModal({ open: false, record: null })}
        footer={null}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={onFinish} style={{ marginTop: 16 }}>
          <Form.Item label="Name" name="name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input placeholder="e.g. Tuition / Transport" />
          </Form.Item>
          <Form.Item label="Description" name="description">
            <Input />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={saving} block>Save</Button>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

// ═════════════════════════════════════════════════════════════
//  FEE STRUCTURE TAB
// ═════════════════════════════════════════════════════════════
const FeeStructureTab = ({ classes, feeGroups, years }) => {
  const [data,       setData]       = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [modal,      setModal]      = useState({ open: false, record: null });
  const [form]                      = Form.useForm();
  const [saving,     setSaving]     = useState(false);
  const [autoSplit,  setAutoSplit]  = useState(false);
  const [totalAmt,   setTotalAmt]   = useState(0);
  const [manualSum,  setManualSum]  = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    setupAPI.getFeeStructures()
      .then((res) => setData(extractList(res)))
      .catch((e) => message.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const openModal = (record = null) => {
    setAutoSplit(false);
    setTotalAmt(0);
    setManualSum(0);
    setModal({ open: true, record });
    form.resetFields();
    if (record) {
      form.setFieldsValue({
        classId:      record.classId?._id || record.classId,
        academicYearId: record.academicYearId,
        feeGroupId:   record.feeGroupId?._id || record.feeGroupId,
        totalAmount:  record.totalAmount,
        installments: record.installments?.map((inst) => ({
          name:    inst.name,
          amount:  inst.amount,
          dueDate: inst.dueDate ? dayjs(inst.dueDate) : null,
        })) || [],
      });
      setTotalAmt(record.totalAmount || 0);
    }
  };

  // Live sum calculation for manual installments
  const onValuesChange = (_, allValues) => {
    if (!autoSplit && allValues.installments) {
      const sum = (allValues.installments || []).reduce(
        (acc, inst) => acc + (inst?.amount || 0), 0
      );
      setManualSum(sum);
    }
    if (allValues.totalAmount !== undefined) setTotalAmt(allValues.totalAmount || 0);
  };

  const onFinish = async (values) => {
    const payload = {
      classId:       values.classId,
      academicYearId: values.academicYearId,
      feeGroupId:    values.feeGroupId || null,
      totalAmount:   values.totalAmount,
    };

    if (autoSplit) {
      payload.installmentCount = values.installmentCount;
      payload.startDate        = values.startDate?.toISOString();
      payload.frequency        = values.frequency || 'monthly';
    } else {
      if (values.installments?.length) {
        payload.installments = values.installments.map((inst) => ({
          name:    inst.name,
          amount:  inst.amount,
          dueDate: inst.dueDate?.toISOString ? inst.dueDate.toISOString() : inst.dueDate,
        }));
      }
    }

    setSaving(true);
    try {
      await setupAPI.saveFeeStructure(payload);
      message.success('Fee structure saved');
      setModal({ open: false, record: null });
      form.resetFields();
      load();
    } catch (e) { message.error(e.message); }
    finally { setSaving(false); }
  };

  // ─── Table columns ─────────────────────────────────────────
  const cols = [
    {
      title: 'Class',
      render: (_, r) => <Text strong>{r.classId?.name || '—'}</Text>,
    },
    {
      title: 'Fee Group',
      render: (_, r) => r.feeGroupId?.name
        ? <Tag color="purple">{r.feeGroupId.name}</Tag>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Total Amount',
      dataIndex: 'totalAmount',
      render: (v) => <Text strong>₹{v?.toLocaleString()}</Text>,
    },
    {
      title: 'Installments',
      render: (_, r) => {
        const count = r.installments?.length || 0;
        if (!count) return <Text type="secondary">None</Text>;
        return (
          <Space size={4} wrap>
            {r.installments.map((inst) => (
              <Tooltip
                key={inst._id}
                title={`Due: ${inst.dueDate ? new Date(inst.dueDate).toLocaleDateString() : '—'} | Paid: ₹${inst.paidAmount || 0}`}
              >
                <Tag color={STATUS_COLOR[inst.status] || 'default'}>
                  {inst.name}: ₹{inst.amount}
                </Tag>
              </Tooltip>
            ))}
          </Space>
        );
      },
    },
    {
      title: '',
      width: 60,
      render: (_, r) => (
        <Button size="small" icon={<EditOutlined />} onClick={() => openModal(r)} />
      ),
    },
  ];

  const sumOk       = autoSplit || !form.getFieldValue('installments')?.length || Math.abs(manualSum - totalAmt) <= 1;
  const sumDiff     = manualSum - totalAmt;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => openModal()}>
          New Structure
        </Button>
      </div>
      <Table
        rowKey="_id"
        columns={cols}
        dataSource={data}
        loading={loading}
        pagination={false}
        size="small"
        scroll={{ x: 700 }}
      />

      <Modal
        title={modal.record ? 'Edit Fee Structure' : 'New Fee Structure'}
        open={modal.open}
        onCancel={() => { setModal({ open: false, record: null }); form.resetFields(); }}
        footer={null}
        destroyOnHidden
        width={640}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          onValuesChange={onValuesChange}
          style={{ marginTop: 16 }}
        >
          {/* ── Base fields ── */}
          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item label="Class" name="classId" rules={[{ required: true }]}>
                <Select placeholder="Select class">
                  {classes.map((c) => (
                    <Select.Option key={c._id} value={c._id}>{c.name}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="Academic Year" name="academicYearId">
                <Select allowClear placeholder="Auto (active year)">
                  {years.map((y) => (
                    <Select.Option key={y._id} value={y._id}>
                      {y.name}{y.isActive ? ' ✓' : ''}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item label="Fee Group (optional)" name="feeGroupId">
                <Select allowClear placeholder="Select fee group">
                  {feeGroups.length === 0
                    ? <Select.Option disabled value="">No groups — create one in Fee Groups tab</Select.Option>
                    : feeGroups.map((g) => (
                        <Select.Option key={g._id} value={g._id}>{g.name}</Select.Option>
                      ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="Total Amount (₹)" name="totalAmount" rules={[{ required: true }]}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          {/* ── Installment mode toggle ── */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: '#f0f2f5', borderRadius: 8, padding: '10px 14px', marginBottom: 16,
          }}>
            <Switch
              checked={autoSplit}
              onChange={setAutoSplit}
              checkedChildren={<ThunderboltOutlined />}
              unCheckedChildren={<OrderedListOutlined />}
            />
            <Text strong>{autoSplit ? '⚡ Auto Generate Installments' : '📋 Manual Installments'}</Text>
          </div>

          {/* ── AUTO SPLIT ── */}
          {autoSplit && (
            <Row gutter={12}>
              <Col xs={24} sm={8}>
                <Form.Item
                  label="No. of Installments"
                  name="installmentCount"
                  rules={[{ required: true, message: 'Required' }]}
                >
                  <InputNumber min={1} max={24} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item
                  label="Start Date"
                  name="startDate"
                  rules={[{ required: true, message: 'Required' }]}
                >
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item label="Frequency" name="frequency" initialValue="monthly">
                  <Select>
                    <Select.Option value="monthly">Monthly</Select.Option>
                    <Select.Option value="quarterly">Quarterly</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
          )}

          {/* ── MANUAL INSTALLMENTS ── */}
          {!autoSplit && (
            <>
              {/* Live sum indicator */}
              {form.getFieldValue('installments')?.length > 0 && (
                <Alert
                  type={sumOk ? 'success' : 'error'}
                  message={
                    sumOk
                      ? `✅ Installments sum: ₹${manualSum} (matches total)`
                      : `⚠️ Sum ₹${manualSum} ≠ Total ₹${totalAmt} (difference: ₹${Math.abs(sumDiff)})`
                  }
                  style={{ marginBottom: 12 }}
                />
              )}

              <Form.List name="installments">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map(({ key, name, ...rest }) => (
                      <Card
                        key={key}
                        size="small"
                        style={{ marginBottom: 8, background: '#fafafa' }}
                        extra={
                          <Button
                            danger
                            size="small"
                            icon={<DeleteOutlined />}
                            onClick={() => remove(name)}
                          />
                        }
                      >
                        <Row gutter={10}>
                          <Col xs={24} sm={10}>
                            <Form.Item
                              {...rest}
                              name={[name, 'name']}
                              label="Installment Name"
                              rules={[{ required: true, message: 'Required' }]}
                            >
                              <Input placeholder="e.g. Term 1" />
                            </Form.Item>
                          </Col>
                          <Col xs={24} sm={7}>
                            <Form.Item
                              {...rest}
                              name={[name, 'amount']}
                              label="Amount (₹)"
                              rules={[{ required: true, message: 'Required' }]}
                            >
                              <InputNumber min={0} style={{ width: '100%' }} />
                            </Form.Item>
                          </Col>
                          <Col xs={24} sm={7}>
                            <Form.Item
                              {...rest}
                              name={[name, 'dueDate']}
                              label="Due Date"
                              rules={[{ required: true, message: 'Required' }]}
                            >
                              <DatePicker style={{ width: '100%' }} />
                            </Form.Item>
                          </Col>
                        </Row>
                      </Card>
                    ))}
                    <Button
                      type="dashed"
                      onClick={() => add({ name: `Installment ${fields.length + 1}`, amount: 0 })}
                      block
                      icon={<PlusOutlined />}
                      style={{ marginBottom: 12 }}
                    >
                      Add Installment
                    </Button>
                  </>
                )}
              </Form.List>
            </>
          )}

          <Form.Item style={{ marginBottom: 0 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => { setModal({ open: false, record: null }); form.resetFields(); }}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit" loading={saving}>
                Save Structure
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

// ═════════════════════════════════════════════════════════════
//  MAIN FeeSetup PAGE
// ═════════════════════════════════════════════════════════════
const FeeSetup = () => {
  const [classes,   setClasses]   = useState([]);
  const [feeGroups, setFeeGroups] = useState([]);
  const [years,     setYears]     = useState([]);

  useEffect(() => {
    schoolAPI.getClasses({ limit: 200 })
      .then((res) => setClasses(extractList(res)))
      .catch((e) => message.error(e.message));
    setupAPI.getFeeGroups()
      .then((res) => setFeeGroups(extractList(res)))
      .catch((e) => message.error(e.message));
    setupAPI.getAcademicYears()
      .then((res) => setYears(extractList(res)))
      .catch((e) => message.error(e.message));
  }, []);

  const items = [
    { key: 'groups',     label: '🏷️ Fee Groups',     children: <FeeGroupsTab /> },
    {
      key: 'structures', label: '📋 Fee Structures',
      children: <FeeStructureTab classes={classes} feeGroups={feeGroups} years={years} />,
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ marginBottom: 16 }}>💰 Fee Setup</Title>
      <Tabs items={items} />
    </div>
  );
};

export default FeeSetup;
