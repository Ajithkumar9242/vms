import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, message, Typography, Alert } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import useAuthStore from '@/store/authStore';
import { schoolAPI } from '@/services/api';
import api from '@/services/api';

const { Title } = Typography;

const Sections = () => {
  const user = useAuthStore((s) => s.user);
  const isVisitor = user?.role === 'visitor';
  const [sections, setSections] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterClass, setFilterClass] = useState(null);
  const [modal, setModal] = useState(false);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    schoolAPI.getClasses()
      .then((res) => setClasses(res?.data || []))
      .catch((e) => message.error(e.message));
  }, []);

  useEffect(() => {
    setLoading(true);
    schoolAPI.getSections(filterClass ? { classId: filterClass } : undefined)
      .then((res) => setSections(res?.data || []))
      .catch((e) => message.error(e.message))
      .finally(() => setLoading(false));
  }, [filterClass]);

  const onFinish = async (values) => {
    setSaving(true);
    try {
      await api.post('/school/sections', values);
      message.success('Section created');
      setModal(false);
      form.resetFields();
      // Re-trigger sections load
      setLoading(true);
      schoolAPI.getSections(filterClass ? { classId: filterClass } : undefined)
        .then((res) => setSections(res?.data || []))
        .catch((e) => message.error(e.message))
        .finally(() => setLoading(false));
    } catch (e) { message.error(e.message); } finally { setSaving(false); }
  };

  const cols = [
    { title: 'Section', dataIndex: 'name' },
    { title: 'Class', render: (_, r) => r.classId?.name || classes.find((c) => c._id === r.classId)?.name || '-' },
    { title: 'Capacity', dataIndex: 'capacity' },
  ];

  return (
    <div style={{ padding: 24 }}>
      {isVisitor && (
        <Alert
          type="info"
          showIcon
          message="You are logged in as a visitor. Sections are read-only."
          style={{ marginBottom: 16 }}
        />
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>🔷 Sections</Title>
        <div style={{ display: 'flex', gap: 8 }}>
          <Select
            allowClear
            placeholder="Filter by class"
            style={{ width: 160 }}
            onChange={setFilterClass}
            value={filterClass}
          >
            {classes.map((c) => <Select.Option key={c._id} value={c._id}>{c.name}</Select.Option>)}
          </Select>
          {!isVisitor && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModal(true)}>New Section</Button>
          )}
        </div>
      </div>
      <Table rowKey="_id" columns={cols} dataSource={sections} loading={loading} pagination={false} />
      <Modal title="New Section" open={modal} onCancel={() => setModal(false)} footer={null} destroyOnHidden>
        <Form form={form} layout="vertical" onFinish={onFinish} style={{ marginTop: 16 }}>
          <Form.Item label="Class" name="classId" rules={[{ required: true }]}>
            <Select>{classes.map((c) => <Select.Option key={c._id} value={c._id}>{c.name}</Select.Option>)}</Select>
          </Form.Item>
          <Form.Item label="Section Name (e.g. A)" name="name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item label="Capacity" name="capacity">
            <InputNumber min={1} defaultValue={40} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item><Button type="primary" htmlType="submit" loading={saving} block>Create</Button></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Sections;
