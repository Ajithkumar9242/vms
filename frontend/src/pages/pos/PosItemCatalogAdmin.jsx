import React, { useEffect, useState, useCallback } from 'react';
import {
  Table, Button, Space, App, Modal, Form, Input, InputNumber,
  Switch, Select, Tag, Popconfirm, Typography, Row, Col,
} from 'antd';
import { PlusOutlined, EditOutlined, PoweroffOutlined } from '@ant-design/icons';
import { posAPI } from '@/services/api';

const { Title, Text } = Typography;

const CATEGORY_OPTS = [
  { label: 'Certificate', value: 'Certificate' },
  { label: 'Uniform',     value: 'Uniform' },
  { label: 'Stationery',  value: 'Stationery' },
  { label: 'Other',       value: 'Other' },
];

const PosItemCatalogAdmin = () => {
  const { message } = App.useApp();
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [open, setOpen]       = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await posAPI.getCatalog();
      setItems(res.data || []);
    } catch (e) { message.error(e.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const openModal = (item = null) => {
    setEditing(item);
    form.setFieldsValue(item ? { ...item } : { category: 'Other', taxPercent: 0, active: true, requiresStudent: true, price: 0 });
    setOpen(true);
  };

  const handleSave = async (values) => {
    setSaving(true);
    try {
      if (editing) await posAPI.updateItem(editing._id, values);
      else         await posAPI.createItem(values);
      message.success(editing ? 'Item updated' : 'Item created');
      setOpen(false);
      load();
    } catch (e) { message.error(e.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleToggle = async (id) => {
    try {
      await posAPI.toggleItem(id);
      message.success('Status toggled');
      load();
    } catch (e) { message.error(e.message || 'Failed'); }
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'n', render: t => <Text strong>{t}</Text> },
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 90, render: v => v ? <Tag>{v}</Tag> : '—' },
    { title: 'Category', dataIndex: 'category', key: 'cat', width: 100 },
    { title: 'Price (₹)', dataIndex: 'price', key: 'p', width: 100, align: 'right', render: v => `₹${v}` },
    { title: 'Tax %', dataIndex: 'taxPercent', key: 't', width: 70, align: 'right', render: v => `${v}%` },
    { title: 'Needs Student', dataIndex: 'requiresStudent', key: 'rs', width: 110, render: v => <Tag>{v ? 'Yes' : 'No'}</Tag> },
    { title: 'Status', dataIndex: 'active', key: 'a', width: 80, render: v => <Tag color={v ? 'green' : 'default'}>{v ? 'Active' : 'Off'}</Tag> },
    {
      title: 'Actions', key: 'act', width: 140,
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openModal(r)}>Edit</Button>
          <Popconfirm title={`${r.active ? 'Deactivate' : 'Activate'}?`} onConfirm={() => handleToggle(r._id)} okText="Yes">
            <Button size="small" icon={<PoweroffOutlined />}>{r.active ? 'Off' : 'On'}</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>🏪 POS Item Catalog</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>Add Item</Button>
      </Row>

      <Table columns={columns} dataSource={items} rowKey="_id" loading={loading} size="middle" scroll={{ x: 700 }} />

      <Modal title={editing ? 'Edit POS Item' : 'New POS Item'} open={open} onCancel={() => setOpen(false)} footer={null} width={500} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={handleSave} style={{ marginTop: 12 }}>
          <Row gutter={12}>
            <Col span={14}>
              <Form.Item name="name" label="Item Name" rules={[{ required: true }]}>
                <Input placeholder="e.g. Uniform Shirt" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="sku" label="SKU (optional)">
                <Input placeholder="e.g. UNIF-001" style={{ textTransform: 'uppercase' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="price" label="Price (₹)" rules={[{ required: true }]}>
                <InputNumber min={0} style={{ width: '100%' }} prefix="₹" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="taxPercent" label="Tax %">
                <InputNumber min={0} max={100} style={{ width: '100%' }} suffix="%" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="category" label="Category" rules={[{ required: true }]}>
                <Select options={CATEGORY_OPTS} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="requiresStudent" label="Requires Student" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="active" label="Active" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={saving}>Save</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PosItemCatalogAdmin;
