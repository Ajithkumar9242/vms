import React, { useEffect, useState, useCallback } from 'react';
import {
  Table, Typography, Button, Space, App, Empty, Modal, Form,
  Input, Select, Row, Col, Tag, Avatar,
} from 'antd';
import { PlusOutlined, LinkOutlined, UserOutlined } from '@ant-design/icons';
import { parentAPI, studentAPI } from '@/services/api';
import FileUpload from '@/components/common/FileUpload';
import useAuthStore from '@/store/authStore';

const { Title, Text } = Typography;

const Parents = () => {
  const { message } = App.useApp();
  const userRole = useAuthStore((s) => s.user?.role);
  // Accountant is read-only — cannot add, edit, or link parents
  const canWrite = !['accountant'].includes(userRole);

  const [parents, setParents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [selectedParent, setSelectedParent] = useState(null);
  const [students, setStudents] = useState([]);
  const [linkStudentId, setLinkStudentId] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [createForm] = Form.useForm();

  const fetchParents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await parentAPI.getAll({ page, limit: 20 });
      // Backend: ApiResponse.success → { success, data: { parents, total } }
      // or ApiResponse.paginated → { success, data: [...], pagination }
      const envelope = res?.data ?? {};
      const list  = Array.isArray(envelope?.parents) ? envelope.parents
                  : Array.isArray(envelope?.data)    ? envelope.data
                  : Array.isArray(envelope)          ? envelope
                  : [];
      const count = envelope?.total ?? envelope?.pagination?.total ?? list.length;
      setParents(list);
      setTotal(count);
    } catch (err) {
      message.error(err.message || 'Failed to load parents');
    } finally {
      setLoading(false);
    }
  }, [page, message]);

  const fetchStudents = useCallback(async () => {
    try {
      const res = await studentAPI.getAll({ limit: 200 });
      const envelope = res?.data ?? {};
      const list = Array.isArray(envelope?.data)     ? envelope.data
                 : Array.isArray(envelope?.students) ? envelope.students
                 : Array.isArray(envelope)            ? envelope
                 : [];
      setStudents(list);
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => { fetchParents(); }, [fetchParents]);
  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  const handleCreate = async (values) => {
    try {
      await parentAPI.create({ ...values, ...(photoUrl ? { photo: photoUrl } : {}) });
      message.success('Parent created successfully');
      setCreateOpen(false);
      setPhotoUrl(null);
      createForm.resetFields();
      fetchParents();
    } catch (err) {
      message.error(err.message || 'Failed to create parent');
    }
  };

  const handleLink = async () => {
    if (!linkStudentId) return message.warning('Select a student first');
    try {
      await parentAPI.linkStudent(selectedParent._id, linkStudentId);
      message.success('Student linked successfully');
      setLinkOpen(false);
      setLinkStudentId(null);
      fetchParents();
    } catch (err) {
      message.error(err.message || 'Failed to link student');
    }
  };

  const columns = [
    {
      title: 'Name', dataIndex: 'name', key: 'name', width: 180,
      render: (name, record) => (
        <Space>
          {record.photo
            ? <img src={record.photo} alt={name} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
            : <Avatar size={32} icon={<UserOutlined />} style={{ background: '#1B3A5C' }} />}
          {name}
        </Space>
      ),
    },
    { title: 'Phone', dataIndex: 'phone', key: 'phone', width: 140 },
    { title: 'Email', dataIndex: 'email', key: 'email', width: 200, render: (v) => v || '—' },
    {
      title: 'Linked Students',
      dataIndex: 'linkedStudents',
      key: 'linkedStudents',
      width: 250,
      render: (studs) => studs?.length > 0
        ? studs.map((s) => <Tag key={s._id} color="blue" style={{ marginBottom: 2 }}>{s.name} ({s.rollNo})</Tag>)
        : <Text type="secondary">No students linked</Text>,
    },
    ...(canWrite ? [{
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Button
          size="small"
          icon={<LinkOutlined />}
          onClick={() => {
            setSelectedParent(record);
            setLinkStudentId(null);
            setLinkOpen(true);
          }}
        >
          Link
        </Button>
      ),
    }] : []),
  ];

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={3} className="page-title" style={{ margin: 0 }}>Parents</Title>
          <Text className="page-subtitle">Manage parents and student linkages</Text>
        </div>
        {canWrite && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)} id="create-parent-btn">
            Add Parent
          </Button>
        )}
      </div>

      <Table
        columns={columns}
        dataSource={parents}
        rowKey="_id"
        loading={loading}
        pagination={{ current: page, total, pageSize: 20, onChange: setPage, showTotal: (t) => `Total ${t} parents` }}
        scroll={{ x: 900 }}
        size="middle"
        style={{ background: '#FFF', borderRadius: 8 }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No parents found" /> }}
      />

      {/* Create Parent Modal — write roles only */}
      {canWrite && (
        <Modal
          title="Add New Parent"
          open={createOpen}
          onCancel={() => { setCreateOpen(false); setPhotoUrl(null); createForm.resetFields(); }}
          onOk={() => createForm.submit()}
          okText="Create"
          okButtonProps={{ disabled: photoUploading }}
          destroyOnHidden
        >
          <Form form={createForm} layout="vertical" onFinish={handleCreate}>
            <Form.Item label="Profile Photo">
              <FileUpload
                folder="parents"
                accept="image/*"
                value={photoUrl}
                onChange={setPhotoUrl}
                onUploading={setPhotoUploading}
                label="Upload Photo"
              />
            </Form.Item>
            <Form.Item name="name" label="Full Name" rules={[{ required: true, message: 'Name is required' }]}>
              <Input placeholder="Parent name" />
            </Form.Item>
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="phone" label="Phone" rules={[{ required: true, message: 'Phone is required' }]}>
                  <Input placeholder="Phone number" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="email" label="Email">
                  <Input placeholder="email@domain.com" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="occupation" label="Occupation">
              <Input placeholder="e.g. Engineer" />
            </Form.Item>
            <Form.Item name="address" label="Address">
              <Input.TextArea rows={2} placeholder="Home address" />
            </Form.Item>
          </Form>
        </Modal>
      )}

      {/* Link Student Modal — write roles only */}
      {canWrite && (
        <Modal
          title={`Link Student — ${selectedParent?.name || ''}`}
          open={linkOpen}
          onCancel={() => { setLinkOpen(false); setLinkStudentId(null); }}
          onOk={handleLink}
          okText="Link Student"
          destroyOnHidden
        >
          <Typography.Paragraph type="secondary">
            Select a student to link to this parent.
          </Typography.Paragraph>
          <Select
            style={{ width: '100%' }}
            placeholder="Search and select student"
            showSearch
            filterOption={(input, option) => option.label.toLowerCase().includes(input.toLowerCase())}
            options={students.map((s) => ({ label: `${s.name} (${s.rollNo})`, value: s._id }))}
            value={linkStudentId}
            onChange={setLinkStudentId}
          />
        </Modal>
      )}
    </div>
  );
};

export default Parents;
