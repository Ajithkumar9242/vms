import React, { useEffect, useState } from 'react';
import {
  Table, Button, Modal, Form, Input, Select,
  Popconfirm, message, Typography, Space, Tag,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined } from '@ant-design/icons';
import { setupAPI, schoolAPI, facultyAPI } from '@/services/api';

const { Title, Text } = Typography;

const extractList = (res) => {
  if (!res) return [];

  // Direct array
  if (Array.isArray(res)) return res;

  // Standard { data: [...] }
  if (Array.isArray(res.data)) return res.data;

  // 🔥 THIS FIX (your case)
  if (res.data && Array.isArray(res.data.faculty)) return res.data.faculty;

  if (res.data && Array.isArray(res.data.classes)) return res.data.classes;
  if (res.data && Array.isArray(res.data.sections)) return res.data.sections;

  return [];
};
const ClassGroups = () => {
  const [data, setData] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState({ open: false, record: null });
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  // Sections filtered by selected class
  const [filteredSections, setFilteredSections] = useState([]);

  const load = () => {
    setLoading(true);
    setupAPI.getClassGroups()
      .then((res) => setData(extractList(res)))
      .catch((e) => message.error(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // Load reference data in parallel
    Promise.all([
      schoolAPI.getClasses({ limit: 200 }),
      schoolAPI.getSections({ limit: 500 }),
      facultyAPI.getAll({ limit: 200 }),
    ])
      .then(([cls, sec, fac]) => {
        setClasses(extractList(cls));
        setSections(extractList(sec));
        setFaculty(extractList(fac));
      })
      .catch((e) => message.error(e.message));
  }, []);

  const handleClassChange = (classId) => {
    const filtered = sections.filter(
      (s) => (s.classId?._id || s.classId) === classId
    );
    setFilteredSections(filtered);
    form.setFieldValue('sectionId', undefined);
  };

  const openModal = (record = null) => {
    setModal({ open: true, record });
    if (record) {
      const classId = record.classId?._id || record.classId;
      const filtered = sections.filter(
        (s) => (s.classId?._id || s.classId) === classId
      );
      setFilteredSections(filtered);
      form.setFieldsValue({
        name: record.name,
        classId,
        sectionId: record.sectionId?._id || record.sectionId,
        teacherId: record.teacherId?._id || record.classTeacherId?._id || null,
      });
    } else {
      setFilteredSections([]);
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
    } catch (e) {
      message.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id) => {
    try {
      await setupAPI.deleteClassGroup(id);
      message.success('Deleted');
      load();
    } catch (e) {
      message.error(e.message);
    }
  };

  const cols = [
    {
      title: 'Group Name',
      dataIndex: 'name',
      render: (v) => <Text strong>{v}</Text>,
    },
    {
      title: 'Class',
      render: (_, r) => r.classId?.name || '—',
    },
    {
      title: 'Section',
      render: (_, r) => r.sectionId?.name
        ? <Tag color="orange">{r.sectionId.name}</Tag>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Class Teacher',
      render: (_, r) => {
        const teacher = r.teacherId || r.classTeacherId;
        if (!teacher) return <Text type="secondary">Not assigned</Text>;
        return (
          <Space>
            <UserOutlined style={{ color: 'var(--color-primary)' }} />
            <span>{teacher.name || teacher}</span>
            {teacher.employeeId && (
              <Text type="secondary">({teacher.employeeId})</Text>
            )}
          </Space>
        );
      },
    },
    {
      title: '',
      key: 'act',
      width: 100,
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
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
          New Group
        </Button>
      </div>

      <Table
        rowKey="_id"
        columns={cols}
        dataSource={data}
        loading={loading}
        pagination={false}
        scroll={{ x: 600 }}
        size="middle"
      />

      <Modal
        title={modal.record ? 'Edit Class Group' : 'New Class Group'}
        open={modal.open}
        onCancel={() => { setModal({ open: false, record: null }); form.resetFields(); }}
        footer={null}
        destroyOnHidden
        width={480}
      >
        <Form form={form} layout="vertical" onFinish={onFinish} style={{ marginTop: 16 }}>
          <Form.Item
            label="Group Name (e.g. 5A, V-B)"
            name="name"
            rules={[{ required: true, message: 'Name is required' }]}
          >
            <Input placeholder="e.g. 5A" />
          </Form.Item>

          <Form.Item
            label="Class"
            name="classId"
            rules={[{ required: true, message: 'Class is required' }]}
          >
            <Select
              placeholder="Select class"
              onChange={handleClassChange}
              disabled={!!modal.record}
            >
              {classes.map((c) => (
                <Select.Option key={c._id} value={c._id}>{c.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="Section"
            name="sectionId"
            rules={[{ required: true, message: 'Section is required' }]}
            extra={filteredSections.length === 0 ? 'Select a class first' : undefined}
          >
            <Select
              placeholder="Select section"
              disabled={filteredSections.length === 0}
            >
              {filteredSections.map((s) => (
                <Select.Option key={s._id} value={s._id}>{s.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="Class Teacher (optional)"
            name="teacherId"
            extra="Only faculty members can be assigned"
          >
            <Select
              allowClear
              placeholder="Select faculty"
              showSearch
              optionFilterProp="children"
            >
              {faculty.map((f) => (
                <Select.Option key={f._id} value={f._id}>
                  {f.name}
                  {f.employeeId && <Text type="secondary"> · {f.employeeId}</Text>}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => { setModal({ open: false, record: null }); form.resetFields(); }}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit" loading={saving}>
                {modal.record ? 'Update' : 'Create'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ClassGroups;
