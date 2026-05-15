import React, { useEffect, useState, useCallback } from 'react';
import {
  Table, Button, Avatar, Tag, Space, Typography, App, Empty, Input,
  Modal, Form, Row, Col,
} from 'antd';
import {
  PlusOutlined, EditOutlined, SearchOutlined, UserSwitchOutlined,
} from '@ant-design/icons';
import { facultyAPI } from '@/services/api';
import FileUpload from '@/components/common/FileUpload';
import useAuthStore from '@/store/authStore';

const { Title, Text } = Typography;

const AdminFaculty = () => {
  const { message } = App.useApp();
  const userRole  = useAuthStore((s) => s.user?.role);
  // Accountant is read-only — cannot add or edit faculty
  const canWrite  = !['accountant'].includes(userRole);
  const [faculty, setFaculty]     = useState([]);
  const [loading, setLoading]     = useState(false);
  const [search, setSearch]       = useState('');
  const [page, setPage]           = useState(1);
  const [total, setTotal]         = useState(0);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [saving, setSaving]       = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [form] = Form.useForm();

  // ─── Fetch ────────────────────────────────────────────────
  const fetchFaculty = useCallback(async () => {
    setLoading(true);
    try {
      const res = await facultyAPI.getAll({ page, limit: 20, search: search || undefined });
      // ApiResponse.paginated: { success, data: [...], pagination }
      const envelope = res?.data ?? {};
      const list = Array.isArray(envelope?.data)    ? envelope.data
                 : Array.isArray(envelope?.faculty) ? envelope.faculty
                 : Array.isArray(envelope)          ? envelope
                 : [];
      const t = envelope?.pagination?.total ?? envelope?.total ?? list.length;
      setFaculty(list);
      setTotal(t);
    } catch (err) {
      message.error(err?.message || 'Failed to load faculty');
    } finally {
      setLoading(false);
    }
  }, [page, search, message]);

  useEffect(() => { fetchFaculty(); }, [fetchFaculty]);

  // ─── Open create modal ────────────────────────────────────
  const openCreate = () => {
    setEditRecord(null);
    setAvatarUrl(null);
    form.resetFields();
    setModalOpen(true);
  };

  // ─── Open edit modal ──────────────────────────────────────
  const openEdit = (record) => {
    setEditRecord(record);
    setAvatarUrl(record.avatar || null);
    form.setFieldsValue({
      name:        record.name,
      email:       record.email,
      phone:       record.phone,
      employeeId:  record.employeeId,
      designation: record.designation,
      department:  record.department,
    });
    setModalOpen(true);
  };

  // ─── Submit ───────────────────────────────────────────────
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = { ...values, avatar: avatarUrl || null };

      if (editRecord) {
        await facultyAPI.update(editRecord._id, payload);
        message.success('Faculty updated successfully');
      } else {
        await facultyAPI.create(payload);
        message.success('Faculty created successfully');
      }

      setModalOpen(false);
      form.resetFields();
      setAvatarUrl(null);
      setEditRecord(null);
      fetchFaculty();
    } catch (err) {
      if (err?.errorFields) return; // validation error — stay open
      message.error(err?.message || 'Operation failed');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setModalOpen(false);
    form.resetFields();
    setAvatarUrl(null);
    setEditRecord(null);
  };

  // ─── Columns ──────────────────────────────────────────────
  const columns = [
    {
      title: '',
      key: 'avatar',
      width: 56,
      render: (_, r) =>
        r.avatar ? (
          <Avatar src={r.avatar} size={38} />
        ) : (
          <Avatar size={38} style={{ background: 'var(--color-primary-dark)', fontWeight: 700, fontSize: 16 }}>
            {r.name?.charAt(0)?.toUpperCase() || '?'}
          </Avatar>
        ),
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (v) => <Text strong>{v}</Text>,
    },
    {
      title: 'Employee ID',
      dataIndex: 'employeeId',
      key: 'employeeId',
      render: (v) => <Text code>{v || '—'}</Text>,
    },
    { title: 'Email',       dataIndex: 'email',       key: 'email',       render: (v) => v || '—' },
    { title: 'Phone',       dataIndex: 'phone',       key: 'phone',       render: (v) => v || '—' },
    { title: 'Department',  dataIndex: 'department',  key: 'department',  render: (v) => v || '—' },
    { title: 'Designation', dataIndex: 'designation', key: 'designation', render: (v) => v || '—' },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'status',
      width: 100,
      render: (v) =>
        v !== false
          ? <Tag color="success">Active</Tag>
          : <Tag color="error">Inactive</Tag>,
    },
    ...(canWrite ? [{
      title: 'Actions',
      key: 'actions',
      width: 90,
      render: (_, r) => (
        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>
          Edit
        </Button>
      ),
    }] : []),
  ];

  // ─── Render ───────────────────────────────────────────────
  return (
    <div className="page-container">
      {/* Header */}
      <div
        className="page-header"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}
      >
        <div>
          <Title level={3} className="page-title" style={{ margin: 0 }}>
            <UserSwitchOutlined style={{ marginRight: 8, color: 'var(--color-primary-dark)' }} />
            Faculty Management
          </Title>
          <Text className="page-subtitle" type="secondary">
            View and manage all faculty members
          </Text>
        </div>
        {canWrite && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} id="add-faculty-btn">
            Add Faculty
          </Button>
        )}
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <Input
          placeholder="Search by name, email or department…"
          prefix={<SearchOutlined style={{ color: '#94A3B8' }} />}
          allowClear
          style={{ maxWidth: 360 }}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          id="faculty-search-input"
        />
      </div>

      {/* Table */}
      <Table
        columns={columns}
        dataSource={faculty}
        rowKey="_id"
        loading={loading}
        pagination={{
          current: page,
          pageSize: 20,
          total,
          onChange: setPage,
          showTotal: (t) => `Total ${t} faculty`,
        }}
        scroll={{ x: 960 }}
        size="middle"
        style={{ background: '#fff', borderRadius: 10 }}
        locale={{
          emptyText: (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No faculty members found" />
          ),
        }}
      />

      {/* Create / Edit Modal */}
      {canWrite && (
      <Modal
        title={editRecord ? 'Edit Faculty' : 'Add Faculty'}
        open={modalOpen}
        onCancel={handleCancel}
        onOk={handleSubmit}
        okText={editRecord ? 'Update' : 'Create'}
        confirmLoading={saving}
        okButtonProps={{ disabled: uploading }}
        width={560}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          {/* Photo upload */}
          <Form.Item label="Profile Photo">
            <FileUpload
              folder="faculty"
              accept="image/*"
              value={avatarUrl}
              onChange={setAvatarUrl}
              onUploading={setUploading}
              label={avatarUrl ? 'Change Photo' : 'Upload Photo'}
            />
          </Form.Item>

          {/* Name + Employee ID */}
          <Row gutter={12}>
            <Col span={14}>
              <Form.Item name="name" label="Full Name" rules={[{ required: true, message: 'Name is required' }]}>
                <Input placeholder="e.g. Priya Sharma" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="employeeId" label="Employee ID">
                <Input placeholder="EMP-001" />
              </Form.Item>
            </Col>
          </Row>

          {/* Email + Phone */}
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="email"
                label="Email"
                rules={[
                  { required: true, message: 'Email is required' },
                  { type: 'email', message: 'Enter a valid email' },
                ]}
              >
                <Input placeholder="faculty@school.com" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone" label="Phone" rules={[{ required: true, message: 'Phone is required' }]}>
                <Input placeholder="+91 9876543210" />
              </Form.Item>
            </Col>
          </Row>

          {/* Department + Designation */}
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="department" label="Department">
                <Input placeholder="e.g. Science" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="designation" label="Designation">
                <Input placeholder="e.g. Senior Teacher" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
      )} {/* end canWrite */}
    </div>
  );
};

export default AdminFaculty;
