import React, { useEffect, useState, useCallback } from 'react';
import {
  Table, Button, Modal, Form, Input, Select, Switch, Tag,
  Space, Typography, Tooltip, Popconfirm, message, Badge,
  Row, Col, Card,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  PoweroffOutlined, SearchOutlined, BookOutlined,
} from '@ant-design/icons';
import { subjectAPI } from '@/services/api';
import { schoolAPI } from '@/services/api';

const { Title, Text } = Typography;

const TYPE_COLOR = {
  theory:    'blue',
  practical: 'green',
  elective:  'orange',
};

// ─── Small helper: detect API pagination shape ───────────────
const extractList = (res) => {
  if (!res) return [];
  if (Array.isArray(res))         return res;
  if (Array.isArray(res.data))    return res.data;
  return [];
};

const Subjects = () => {
  const [subjects,     setSubjects]     = useState([]);
  const [classes,      setClasses]      = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [modalOpen,    setModalOpen]    = useState(false);
  const [editRecord,   setEditRecord]   = useState(null);   // null = create mode
  const [filterClass,  setFilterClass]  = useState(undefined);
  const [filterType,   setFilterType]   = useState(undefined);
  const [filterActive, setFilterActive] = useState(undefined); // undefined = all
  const [search,       setSearch]       = useState('');
  const [form] = Form.useForm();

  // ─── Load classes once ──────────────────────────────────────
  useEffect(() => {
    schoolAPI
      .getClasses({ limit: 200 })
      .then((res) => setClasses(extractList(res)))
      .catch(() => {});
  }, []);

  // ─── Load subjects ───────────────────────────────────────────
  const load = useCallback(() => {
    setLoading(true);
    subjectAPI
      .getAll({
        classId:  filterClass,
        type:     filterType,
        isActive: filterActive,
        search:   search || undefined,
        limit:    200,
      })
      .then((res) => setSubjects(extractList(res)))
      .catch((e) => message.error(e.message))
      .finally(() => setLoading(false));
  }, [filterClass, filterType, filterActive, search]);

  useEffect(() => { load(); }, [load]);

  // ─── Open modal ──────────────────────────────────────────────
  const openCreate = () => {
    setEditRecord(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (record) => {
    setEditRecord(record);
    form.setFieldsValue({
      name:       record.name,
      code:       record.code,
      type:       record.type,
      classId:    record.classId?._id || record.classId || undefined,
      isOptional: record.isOptional,
    });
    setModalOpen(true);
  };

  // ─── Submit ──────────────────────────────────────────────────
  const onFinish = async (values) => {
    setSaving(true);
    try {
      if (editRecord) {
        await subjectAPI.update(editRecord._id, values);
        message.success('Subject updated');
      } else {
        await subjectAPI.create(values);
        message.success('Subject created');
      }
      setModalOpen(false);
      form.resetFields();
      load();
    } catch (e) {
      message.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  // ─── Toggle active ───────────────────────────────────────────
  const handleToggle = async (record) => {
    try {
      await subjectAPI.toggle(record._id);
      message.success(`Subject ${record.isActive ? 'deactivated' : 'activated'}`);
      load();
    } catch (e) {
      message.error(e.message);
    }
  };

  // ─── Soft delete ────────────────────────────────────────────
  const handleDelete = async (record) => {
    try {
      await subjectAPI.remove(record._id);
      message.success('Subject deactivated');
      load();
    } catch (e) {
      message.error(e.message);
    }
  };

  // ─── Stats ──────────────────────────────────────────────────
  const totalActive   = subjects.filter((s) => s.isActive).length;
  const totalInactive = subjects.length - totalActive;

  // ─── Table columns ───────────────────────────────────────────
  const columns = [
    {
      title: 'Subject',
      dataIndex: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (name, r) => (
        <Space direction="vertical" size={0}>
          <Text strong>{name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>Code: {r.code}</Text>
        </Space>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      render: (t) => (
        <Tag color={TYPE_COLOR[t] || 'default'} style={{ textTransform: 'capitalize' }}>
          {t}
        </Tag>
      ),
    },
    {
      title: 'Class',
      dataIndex: 'classId',
      render: (cls) => cls?.name ? <Tag color="orange">{cls.name}</Tag> : <Text type="secondary">Global</Text>,
    },
    {
      title: 'Optional',
      dataIndex: 'isOptional',
      render: (v) => v ? <Tag color="purple">Optional</Tag> : <Tag>Core</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      render: (active) => (
        <Badge status={active ? 'success' : 'error'} text={active ? 'Active' : 'Inactive'} />
      ),
    },
    {
      title: 'Actions',
      width: 160,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Edit">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEdit(record)}
            />
          </Tooltip>

          <Tooltip title={record.isActive ? 'Deactivate' : 'Activate'}>
            <Button
              size="small"
              icon={<PoweroffOutlined />}
              type={record.isActive ? 'default' : 'primary'}
              onClick={() => handleToggle(record)}
            />
          </Tooltip>

          <Popconfirm
            title="Deactivate this subject?"
            description="It will be hidden from active lists."
            onConfirm={() => handleDelete(record)}
            okText="Yes"
            cancelText="No"
            disabled={!record.isActive}
          >
            <Tooltip title="Remove (deactivate)">
              <Button
                size="small"
                icon={<DeleteOutlined />}
                danger
                disabled={!record.isActive}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* ── Page Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            <BookOutlined style={{ marginRight: 8, color: 'var(--color-secondary)' }} />
            Subjects
          </Title>
          <Text type="secondary">Manage all school subjects — assign to classes, toggle status</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          New Subject
        </Button>
      </div>

      {/* ── Stats Cards ── */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={6}>
          <Card size="small" styles={{ body: { padding: '12px 16px' } }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Total</Text>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{subjects.length}</div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" styles={{ body: { padding: '12px 16px' } }}>
            <Text type="secondary" style={{ fontSize: 12, color: '#16A34A' }}>Active</Text>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#16A34A' }}>{totalActive}</div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" styles={{ body: { padding: '12px 16px' } }}>
            <Text type="secondary" style={{ fontSize: 12, color: '#DC2626' }}>Inactive</Text>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#DC2626' }}>{totalInactive}</div>
          </Card>
        </Col>
      </Row>

      {/* ── Filters ── */}
      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8} md={6}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Search name or code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
          />
        </Col>
        <Col xs={24} sm={8} md={5}>
          <Select
            allowClear
            placeholder="Filter by class"
            style={{ width: '100%' }}
            value={filterClass}
            onChange={setFilterClass}
          >
            {classes.map((c) => (
              <Select.Option key={c._id} value={c._id}>{c.name}</Select.Option>
            ))}
          </Select>
        </Col>
        <Col xs={24} sm={8} md={5}>
          <Select
            allowClear
            placeholder="Filter by type"
            style={{ width: '100%' }}
            value={filterType}
            onChange={setFilterType}
          >
            <Select.Option value="theory">Theory</Select.Option>
            <Select.Option value="practical">Practical</Select.Option>
            <Select.Option value="elective">Elective</Select.Option>
          </Select>
        </Col>
        <Col xs={24} sm={8} md={5}>
          <Select
            allowClear
            placeholder="Status"
            style={{ width: '100%' }}
            value={filterActive}
            onChange={setFilterActive}
          >
            <Select.Option value="true">Active</Select.Option>
            <Select.Option value="false">Inactive</Select.Option>
          </Select>
        </Col>
      </Row>

      {/* ── Table ── */}
      <Table
        rowKey="_id"
        columns={columns}
        dataSource={subjects}
        loading={loading}
        pagination={{ pageSize: 20, showTotal: (t) => `${t} subjects` }}
        scroll={{ x: 700 }}
        size="middle"
        rowClassName={(r) => (!r.isActive ? 'opacity-60' : '')}
      />

      {/* ── Create / Edit Modal ── */}
      <Modal
        title={editRecord ? `Edit Subject — ${editRecord.name}` : 'New Subject'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        footer={null}
        destroyOnHidden
        width={520}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          style={{ marginTop: 16 }}
          initialValues={{ type: 'theory', isOptional: false }}
        >
          <Row gutter={12}>
            <Col xs={24} sm={14}>
              <Form.Item
                label="Subject Name"
                name="name"
                rules={[
                  { required: true, message: 'Name is required' },
                  { max: 100, message: 'Max 100 characters' },
                ]}
              >
                <Input placeholder="e.g. Mathematics" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={10}>
              <Form.Item
                label="Subject Code"
                name="code"
                rules={[
                  { required: true, message: 'Code is required' },
                  { max: 20, message: 'Max 20 characters' },
                ]}
              >
                <Input
                  placeholder="e.g. MATH"
                  style={{ textTransform: 'uppercase' }}
                  onChange={(e) =>
                    form.setFieldValue('code', e.target.value.toUpperCase())
                  }
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Type" name="type" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="theory">Theory</Select.Option>
              <Select.Option value="practical">Practical</Select.Option>
              <Select.Option value="elective">Elective</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item label="Assign to Class (optional)" name="classId">
            <Select allowClear placeholder="Leave blank for all classes">
              {classes.map((c) => (
                <Select.Option key={c._id} value={c._id}>{c.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label="Optional Subject?" name="isOptional" valuePropName="checked">
            <Switch checkedChildren="Optional" unCheckedChildren="Core" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => { setModalOpen(false); form.resetFields(); }}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit" loading={saving}>
                {editRecord ? 'Save Changes' : 'Create Subject'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Subjects;
