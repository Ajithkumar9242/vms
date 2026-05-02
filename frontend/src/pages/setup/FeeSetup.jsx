import React, { useEffect, useState } from 'react';
import { Card, Table, Button, Modal, Form, Input, InputNumber, Select, Tabs, Tag, message, Typography } from 'antd';
import { PlusOutlined, EditOutlined } from '@ant-design/icons';
import { setupAPI, schoolAPI } from '@/services/api';

const { Title } = Typography;

// ─── Fee Groups tab ───────────────────────────────────────────
const FeeGroupsTab = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState({ open: false, record: null });
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    setupAPI.getFeeGroups()
      .then((res) => setData(res?.data || []))
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
      if (modal.record) { await setupAPI.updateFeeGroup(modal.record._id, values); message.success('Updated'); }
      else { await setupAPI.createFeeGroup(values); message.success('Created'); }
      setModal({ open: false, record: null });
      load();
    } catch (e) { message.error(e.message); } finally { setSaving(false); }
  };

  const cols = [
    { title: 'Name', dataIndex: 'name' },
    { title: 'Description', dataIndex: 'description' },
    { title: 'Status', dataIndex: 'isActive', render: (v) => <Tag color={v ? 'green' : 'red'}>{v ? 'Active' : 'Inactive'}</Tag> },
    { title: '', key: 'act', width: 60, render: (_, r) => <Button size="small" icon={<EditOutlined />} onClick={() => openModal(r)} /> },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => openModal()}>New Fee Group</Button>
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
          <Form.Item label="Name" name="name" rules={[{ required: true }]}><Input placeholder="e.g. Tuition / Transport" /></Form.Item>
          <Form.Item label="Description" name="description"><Input /></Form.Item>
          <Form.Item><Button type="primary" htmlType="submit" loading={saving} block>Save</Button></Form.Item>
        </Form>
      </Modal>
    </>
  );
};

// ─── Fee Structures tab ───────────────────────────────────────
const FeeStructureTab = ({ classes, feeGroups, years }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    setupAPI.getFeeStructures()
      .then((res) => setData(res?.data || []))
      .catch((e) => message.error(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const onFinish = async (values) => {
    setSaving(true);
    try {
      await setupAPI.saveFeeStructure(values);
      message.success('Fee structure saved');
      setModal(false);
      form.resetFields();
      load();
    } catch (e) { message.error(e.message); } finally { setSaving(false); }
  };

  const cols = [
    { title: 'Class', render: (_, r) => r.classId?.name },
    { title: 'Total Amount', dataIndex: 'totalAmount', render: (v) => `₹${v?.toLocaleString()}` },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setModal(true)}>New Structure</Button>
      </div>
      <Table rowKey="_id" columns={cols} dataSource={data} loading={loading} pagination={false} size="small" />
      <Modal
        title="Fee Structure"
        open={modal}
        onCancel={() => setModal(false)}
        footer={null}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={onFinish} style={{ marginTop: 16 }}>
          <Form.Item label="Academic Year" name="academicYearId">
            <Select allowClear placeholder="Auto (active year)">
              {years.map((y) => <Select.Option key={y._id} value={y._id}>{y.name}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item label="Class" name="classId" rules={[{ required: true }]}>
            <Select>{classes.map((c) => <Select.Option key={c._id} value={c._id}>{c.name}</Select.Option>)}</Select>
          </Form.Item>
          <Form.Item label="Fee Group" name="feeGroupId">
            <Select allowClear placeholder="Optional">
              {feeGroups.map((g) => <Select.Option key={g._id} value={g._id}>{g.name}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item label="Total Amount (₹)" name="totalAmount" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item><Button type="primary" htmlType="submit" loading={saving} block>Save</Button></Form.Item>
        </Form>
      </Modal>
    </>
  );
};

// ─── Main FeeSetup page ───────────────────────────────────────
const FeeSetup = () => {
  const [classes, setClasses] = useState([]);
  const [feeGroups, setFeeGroups] = useState([]);
  const [years, setYears] = useState([]);

  useEffect(() => {
    schoolAPI.getClasses()
      .then((res) => setClasses(res?.data || []))
      .catch((e) => message.error(e.message));
    setupAPI.getFeeGroups()
      .then((res) => setFeeGroups(res?.data || []))
      .catch((e) => message.error(e.message));
    setupAPI.getAcademicYears()
      .then((res) => setYears(res?.data || []))
      .catch((e) => message.error(e.message));
  }, []);

  const items = [
    { key: 'groups', label: 'Fee Groups', children: <FeeGroupsTab /> },
    {
      key: 'structures',
      label: 'Fee Structures',
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
