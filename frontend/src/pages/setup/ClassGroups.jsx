import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, Popconfirm, message, Typography, Space } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { setupAPI, schoolAPI } from '@/services/api';

const { Title } = Typography;

const ClassGroups = () => {
  const [data, setData] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState({ open: false, record: null });
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    setupAPI.getClassGroups()
      .then((res) => setData(res?.data || []))
      .catch((e) => message.error(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    schoolAPI.getClasses()
      .then((res) => setClasses(res?.data || []))
      .catch((e) => message.error(e.message));
    schoolAPI.getSections()
      .then((res) => setSections(res?.data || []))
      .catch((e) => message.error(e.message));
  }, []);

  const openModal = (record = null) => {
    setModal({ open: true, record });
    if (record) {
      form.setFieldsValue({
        name: record.name,
        classId: record.classId?._id || record.classId,
        sectionId: record.sectionId?._id || record.sectionId,
      });
    } else {
      form.resetFields();
    }
  };

  const onFinish = async (values) => {
    setSaving(true);
    try {
      if (modal.record) {
        await setupAPI.updateClassGroup(modal.record._id, values);
        message.success('Class Group updated');
      } else {
        await setupAPI.createClassGroup(values);
        message.success('Class Group created');
      }
      setModal({ open: false, record: null });
      load();
    } catch (e) { message.error(e.message); } finally { setSaving(false); }
  };

  const onDelete = async (id) => {
    try {
      await setupAPI.deleteClassGroup(id);
      message.success('Deleted');
      load();
    } catch (e) { message.error(e.message); }
  };

  const cols = [
    { title: 'Group Name', dataIndex: 'name' },
    { title: 'Class', render: (_, r) => r.classId?.name || '-' },
    { title: 'Section', render: (_, r) => r.sectionId?.name || '-' },
    { title: 'Class Teacher', render: (_, r) => r.classTeacherId?.name || '-' },
    {
      title: '', key: 'act', width: 90,
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openModal(r)} />
          <Popconfirm title="Delete this group?" onConfirm={() => onDelete(r._id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>🗂️ Class Groups</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>New Group</Button>
      </div>
      <Table rowKey="_id" columns={cols} dataSource={data} loading={loading} pagination={false} />

      <Modal
        title={modal.record ? 'Edit Class Group' : 'New Class Group'}
        open={modal.open}
        onCancel={() => setModal({ open: false, record: null })}
        footer={null}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={onFinish} style={{ marginTop: 16 }}>
          <Form.Item label="Group Name (e.g. 5A, V-B)" name="name" rules={[{ required: true }]}>
            <Input placeholder="e.g. 5A" />
          </Form.Item>
          <Form.Item label="Class" name="classId" rules={[{ required: true }]}>
            <Select>
              {classes.map((c) => <Select.Option key={c._id} value={c._id}>{c.name}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item label="Section" name="sectionId" rules={[{ required: true }]}>
            <Select>
              {sections.map((s) => <Select.Option key={s._id} value={s._id}>{s.name}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={saving} block>
              {modal.record ? 'Update' : 'Create'}
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ClassGroups;
