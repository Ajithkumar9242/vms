import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Popconfirm, message, Typography, Space } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { setupAPI } from '@/services/api';

const { Title } = Typography;

const GradeSetup = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState({ open: false, record: null });
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    setupAPI.getGradeConfigs().then((res) => setData(res?.data || [])).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openModal = (record = null) => {
    setModal({ open: true, record });
    if (record) form.setFieldsValue(record); else form.resetFields();
  };

  const onFinish = async (values) => {
    setSaving(true);
    try {
      if (modal.record) { await setupAPI.updateGradeConfig(modal.record._id, values); message.success('Updated'); }
      else { await setupAPI.createGradeConfig(values); message.success('Created'); }
      setModal({ open: false, record: null }); load();
    } catch (e) { message.error(e.message); } finally { setSaving(false); }
  };

  const onDelete = async (id) => {
    try { await setupAPI.deleteGradeConfig(id); message.success('Deleted'); load(); }
    catch (e) { message.error(e.message); }
  };

  const cols = [
    { title: 'Grade', dataIndex: 'name', width: 100 },
    { title: 'Min Marks (%)', dataIndex: 'minMarks' },
    { title: 'Max Marks (%)', dataIndex: 'maxMarks' },
    { title: 'Remarks', dataIndex: 'remarks' },
    { title: '', key: 'act', width: 90, render: (_, r) => (
      <Space>
        <Button size="small" icon={<EditOutlined />} onClick={() => openModal(r)} />
        <Popconfirm title="Delete?" onConfirm={() => onDelete(r._id)}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </Space>
    ) },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>🏆 Grade System</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>Add Grade</Button>
      </div>
      <Table rowKey="_id" columns={cols} dataSource={data} loading={loading} pagination={false} />

      <Modal title={modal.record ? 'Edit Grade' : 'New Grade'} open={modal.open} onCancel={() => setModal({ open: false, record: null })} footer={null} destroyOnHidden>
        <Form form={form} layout="vertical" onFinish={onFinish} style={{ marginTop: 16 }}>
          <Form.Item label="Grade Name (e.g. A+)" name="name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item label="Min Marks (%)" name="minMarks" rules={[{ required: true }]}><InputNumber min={0} max={100} style={{ width: '100%' }} /></Form.Item>
          <Form.Item label="Max Marks (%)" name="maxMarks" rules={[{ required: true }]}><InputNumber min={0} max={100} style={{ width: '100%' }} /></Form.Item>
          <Form.Item label="Remarks" name="remarks"><Input placeholder="e.g. Outstanding" /></Form.Item>
          <Form.Item><Button type="primary" htmlType="submit" loading={saving} block>Save</Button></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default GradeSetup;
