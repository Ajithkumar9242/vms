import React, { useEffect, useState, useCallback } from 'react';
import {
  Table, Button, Space, App, Modal, Form, Input, InputNumber,
  Switch, Select, Tag, Popconfirm, Typography, Row, Col,
} from 'antd';
import { PlusOutlined, EditOutlined, PoweroffOutlined } from '@ant-design/icons';
import { vaultAPI } from '@/services/api';

const { Title, Text } = Typography;

const CATEGORY_OPTS = [
  { label: 'Certificate', value: 'Certificate' },
  { label: 'Marks',       value: 'Marks' },
  { label: 'Other',       value: 'Other' },
];

const DocumentCatalogAdmin = () => {
  const { message } = App.useApp();
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [open, setOpen]         = useState(false);
  const [editing, setEditing]   = useState(null);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await vaultAPI.getCatalog();
      setItems(res.data || []);
    } catch (e) { message.error(e.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const openModal = (item = null) => {
    setEditing(item);
    form.setFieldsValue(item ? { ...item } : { category: 'Certificate', requiresApproval: true, maxCopies: 1, active: true, price: 0 });
    setOpen(true);
  };

  const handleSave = async (values) => {
    setSaving(true);
    try {
      if (editing) await vaultAPI.updateCatalogItem(editing._id, values);
      else         await vaultAPI.createCatalogItem(values);
      message.success(editing ? 'Item updated' : 'Item created');
      setOpen(false);
      load();
    } catch (e) { message.error(e.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleToggle = async (id) => {
    try {
      await vaultAPI.toggleCatalogItem(id);
      message.success('Status toggled');
      load();
    } catch (e) { message.error(e.message || 'Failed'); }
  };

  const columns = [
    { title: 'Code', dataIndex: 'code', key: 'code', width: 90, render: v => <Tag>{v}</Tag> },
    { title: 'Name', dataIndex: 'name', key: 'name', render: t => <Text strong>{t}</Text> },
    { title: 'Category', dataIndex: 'category', key: 'category', width: 100 },
    { title: 'Price (₹)', dataIndex: 'price', key: 'price', width: 100, align: 'right', render: v => `₹${v}` },
    { title: 'Max Copies', dataIndex: 'maxCopies', key: 'maxCopies', width: 90, align: 'center' },
    { title: 'Needs Approval', dataIndex: 'requiresApproval', key: 'ra', width: 120, render: v => v ? <Tag color="orange">Yes</Tag> : <Tag>No</Tag> },
    { title: 'Status', dataIndex: 'active', key: 'active', width: 80, render: v => <Tag color={v ? 'green' : 'default'}>{v ? 'Active' : 'Inactive'}</Tag> },
    {
      title: 'Actions', key: 'actions', width: 140,
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openModal(r)}>Edit</Button>
          <Popconfirm title={`${r.active ? 'Deactivate' : 'Activate'} this item?`} onConfirm={() => handleToggle(r._id)} okText="Yes">
            <Button size="small" icon={<PoweroffOutlined />}>{r.active ? 'Deactivate' : 'Activate'}</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>📋 Document Catalog</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>Add Item</Button>
      </Row>

      <Table columns={columns} dataSource={items} rowKey="_id" loading={loading} size="middle" bordered={false} scroll={{ x: 700 }} />

      <Modal title={editing ? 'Edit Catalog Item' : 'New Catalog Item'} open={open} onCancel={() => setOpen(false)} footer={null} width={520} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={handleSave} style={{ marginTop: 12 }}>
          <Row gutter={12}>
            <Col span={16}>
              <Form.Item name="name" label="Document Name" rules={[{ required: true }]}>
                <Input placeholder="e.g. Study Certificate" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="code" label="Code" rules={[{ required: true }]}>
                <Input placeholder="e.g. SC" style={{ textTransform: 'uppercase' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="price" label="Price (₹)" rules={[{ required: true }]}>
                <InputNumber min={0} style={{ width: '100%' }} prefix="₹" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="category" label="Category" rules={[{ required: true }]}>
                <Select options={CATEGORY_OPTS} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="maxCopies" label="Max Copies">
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="requiresApproval" label="Requires Admin Approval" valuePropName="checked">
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

export default DocumentCatalogAdmin;
