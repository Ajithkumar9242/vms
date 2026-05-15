import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, message, Typography, Space } from 'antd';
import { PlusOutlined, EditOutlined } from '@ant-design/icons';
import { setupAPI, schoolAPI } from '@/services/api';
import api from '@/services/api';

const { Title } = Typography;

// ─── ClassGroups tab ──────────────────────────────────────────
const ClassGroupsTab = ({ classes, sections }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    setupAPI.getClassGroups()
      .then((res) => setData(res?.data || []))
      .catch((e) => message.error(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const onFinish = async (values) => {
    setSaving(true);
    try {
      await setupAPI.createClassGroup(values);
      message.success('Class Group created');
      setModal(false);
      form.resetFields();
      load();
    } catch (e) { message.error(e.message); } finally { setSaving(false); }
  };

  const cols = [
    { title: 'Name', dataIndex: 'name' },
    { title: 'Class', render: (_, r) => r.classId?.name },
    { title: 'Section', render: (_, r) => r.sectionId?.name },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setModal(true)}>New Group</Button>
      </div>
      <Table rowKey="_id" columns={cols} dataSource={data} loading={loading} pagination={false} size="small" />
      <Modal title="New Class Group" open={modal} onCancel={() => setModal(false)} footer={null} destroyOnHidden>
        <Form form={form} layout="vertical" onFinish={onFinish} style={{ marginTop: 16 }}>
          <Form.Item label="Group Name (e.g. 5A)" name="name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item label="Class" name="classId" rules={[{ required: true }]}>
            <Select>{classes.map((c) => <Select.Option key={c._id} value={c._id}>{c.name}</Select.Option>)}</Select>
          </Form.Item>
          <Form.Item label="Section" name="sectionId" rules={[{ required: true }]}>
            <Select>{sections.map((s) => <Select.Option key={s._id} value={s._id}>{s.name}</Select.Option>)}</Select>
          </Form.Item>
          <Form.Item><Button type="primary" htmlType="submit" loading={saving} block>Create</Button></Form.Item>
        </Form>
      </Modal>
    </>
  );
};

// ─── Main Classes page ────────────────────────────────────────
const Classes = () => {
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('classes');
  const [modal, setModal] = useState({ open: false, record: null });
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([schoolAPI.getClasses(), schoolAPI.getSections()])
      .then(([cr, sr]) => {
        setClasses(cr?.data || []);
        setSections(sr?.data || []);
      })
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
        // Classes don't have a PUT endpoint yet — notify user
        message.info('Class editing is managed via the School Setup API.');
      } else {
        await api.post('/school/classes', values);
        message.success('Class created');
        load();
      }
      setModal({ open: false, record: null });
    } catch (e) { message.error(e.message); } finally { setSaving(false); }
  };

  const classCols = [
    { title: 'Name', dataIndex: 'name' },
    { title: 'Code', dataIndex: 'code' },
    { title: 'Order', dataIndex: 'order' },
    { title: '', key: 'act', width: 60, render: (_, r) => <Button size="small" icon={<EditOutlined />} onClick={() => openModal(r)} /> },
  ];

  const tabStyle = (key) => ({
    padding: '6px 16px', cursor: 'pointer', fontWeight: tab === key ? 600 : 400,
    borderBottom: tab === key ? '2px solid var(--color-secondary)' : '2px solid transparent',
    color: tab === key ? 'var(--color-secondary)' : '#666',
  });

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>📚 Classes & Groups</Title>
        {tab === 'classes' && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>New Class</Button>
        )}
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid #f0f0f0', marginBottom: 16 }}>
        <span style={tabStyle('classes')} onClick={() => setTab('classes')}>Classes</span>
        <span style={tabStyle('groups')} onClick={() => setTab('groups')}>Class Groups</span>
      </div>

      {tab === 'classes' && (
        <Table rowKey="_id" columns={classCols} dataSource={classes} loading={loading} pagination={false} />
      )}
      {tab === 'groups' && <ClassGroupsTab classes={classes} sections={sections} />}

      <Modal
        title={modal.record ? 'Edit Class' : 'New Class'}
        open={modal.open}
        onCancel={() => setModal({ open: false, record: null })}
        footer={null}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={onFinish} style={{ marginTop: 16 }}>
          <Form.Item label="Class Name" name="name" rules={[{ required: true }]}><Input placeholder="e.g. Class 5" /></Form.Item>
          <Form.Item label="Code" name="code" rules={[{ required: true }]}><Input placeholder="e.g. CLS5" /></Form.Item>
          <Form.Item label="Order" name="order"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item label="Description" name="description"><Input /></Form.Item>
          <Form.Item><Button type="primary" htmlType="submit" loading={saving} block>Save</Button></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Classes;
