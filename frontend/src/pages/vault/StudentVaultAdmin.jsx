import React, { useEffect, useState, useCallback } from 'react';
import {
  Table, Button, Space, App, Modal, Form, Input, Switch, Select,
  Upload, Typography, Row, Col, Tag, Popconfirm, Card,
} from 'antd';
import { UploadOutlined, DeleteOutlined, ReloadOutlined, DownloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { vaultAPI, studentAPI } from '@/services/api';

const { Title, Text } = Typography;

const StudentVaultAdmin = () => {
  const { message } = App.useApp();
  const [students, setStudents] = useState([]);
  const [studentId, setStudentId] = useState(null);
  const [files, setFiles] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [fileObj, setFileObj] = useState(null);
  const [form] = Form.useForm();

  // Load student list
  useEffect(() => {
    studentAPI.getAll({ limit: 200 })
      .then(res => setStudents(res.data?.students || res.data || []))
      .catch(() => { });
  }, []);

  const loadFiles = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    try {
      const [filesRes, reqRes] = await Promise.all([
        vaultAPI.getStudentFiles(studentId),
        vaultAPI.getRequests({ studentId }),
      ]);
      setFiles(filesRes.data || []);
      setRequests(reqRes.data || []);
    } catch (e) { message.error(e.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, [studentId, message]);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const handleUpload = async (values) => {
    if (!fileObj) { message.error('Please select a file'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', fileObj);
      fd.append('title', values.title);
      fd.append('description', values.description || '');
      if (values.catalogItemId) fd.append('catalogItemId', values.catalogItemId);
      if (values.requestId) fd.append('requestId', values.requestId);
      fd.append('visibleToParent', values.visibleToParent ? 'true' : 'false');
      fd.append('requiresApprovedRequest', values.requiresApprovedRequest ? 'true' : 'false');
      if (values.issueDate) fd.append('issueDate', values.issueDate);

      const res = await vaultAPI.uploadFile(studentId, fd);
      message.success(`File uploaded — ID: ${res.data?._id}`);
      setUploadOpen(false);
      form.resetFields();
      setFileObj(null);
      loadFiles();
    } catch (e) { message.error(e.message || 'Upload failed'); }
    finally { setUploading(false); }
  };

  const handleDelete = async (fileId) => {
    try {
      await vaultAPI.deleteFile(fileId);
      message.success('File deleted');
      loadFiles();
    } catch (e) { message.error(e.message || 'Delete failed'); }
  };

  const columns = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 't',
      render: t => <Text strong>{t}</Text>,
    },

    // ✅ NEW FILE ID COLUMN
    {
      title: 'File ID',
      dataIndex: '_id',
      key: 'id',
      width: 240,
      render: (id) => (
        <Space>
          <code style={{ fontSize: 11 }}>{id}</code>

          <Button
            size="small"
            onClick={async () => {
              await navigator.clipboard.writeText(id);
              message.success('File ID copied');
            }}
          >
            Copy
          </Button>
        </Space>
      ),
    },

    {
      title: 'Type',
      dataIndex: 'mimeType',
      key: 'm',
      width: 90,
      render: v => (
        <Tag>
          {v?.split('/')[1]?.toUpperCase() || '—'}
        </Tag>
      ),
    },

    {
      title: 'Size',
      dataIndex: 'fileSize',
      key: 'sz',
      width: 80,
      render: v => v ? `${(v / 1024).toFixed(1)} KB` : '—',
    },

    {
      title: 'Visible',
      dataIndex: 'visibleToParent',
      key: 'vp',
      width: 70,
      render: v => (
        <Tag color={v ? 'green' : 'default'}>
          {v ? 'Yes' : 'No'}
        </Tag>
      ),
    },

    {
      title: 'Req #',
      key: 'req',
      width: 120,
      render: (_, r) => r.requestId?.requestNumber || '—',
    },

    {
      title: 'Uploaded',
      key: 'up',
      width: 100,
      render: (_, r) => dayjs(r.createdAt).format('DD MMM YY'),
    },

    {
      title: 'Actions',
      key: 'act',
      width: 120,
      render: (_, r) => (
        <Space>
          <Button
            size="small"
            icon={<DownloadOutlined />}
            href={vaultAPI.getDownloadUrl(r._id)}
            target="_blank"
          >
            Download
          </Button>

          <Popconfirm
            title="Delete this file?"
            onConfirm={() => handleDelete(r._id)}
            okType="danger"
          >
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>🗄️ Student Vault</Title>
        <Space>
          <Select
            showSearch optionFilterProp="label" placeholder="Select student"
            style={{ width: 240 }}
            value={studentId}
            onChange={setStudentId}
            options={students.map(s => ({ label: `${s.name} (${s.rollNo})`, value: s._id }))}
          />
          <Button icon={<ReloadOutlined />} onClick={loadFiles} disabled={!studentId}>Refresh</Button>
          <Button type="primary" icon={<UploadOutlined />} onClick={() => setUploadOpen(true)} disabled={!studentId}>Upload File</Button>
        </Space>
      </Row>

      {studentId && (
        <Card size="small" style={{ marginBottom: 8, background: '#F8FAFC', borderRadius: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            After uploading, copy the File ID and paste it in the <strong>Fulfill Request</strong> modal in the Requests Queue.
          </Text>
        </Card>
      )}

      <Table columns={columns} dataSource={files} rowKey="_id" loading={loading} size="middle" locale={{ emptyText: studentId ? 'No files uploaded for this student' : 'Select a student first' }} scroll={{ x: 700 }} />

      <Modal title="Upload File to Vault" open={uploadOpen} onCancel={() => { setUploadOpen(false); form.resetFields(); setFileObj(null); }} footer={null} width={520} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={handleUpload} style={{ marginTop: 12 }}>
          <Form.Item name="title" label="Title" rules={[{ required: true }]}>
            <Input placeholder="e.g. Bonafide Certificate - 2025" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label="File" required>
            <Upload beforeUpload={(f) => { setFileObj(f); return false; }} maxCount={1} accept=".pdf,.jpg,.jpeg,.png,.webp">
              <Button icon={<UploadOutlined />}>Select File (PDF/Image, max 10MB)</Button>
            </Upload>
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="requestId" label="Link to Request (optional)">
                <Select allowClear placeholder="Select request" options={requests.map(r => ({ label: `${r.requestNumber} - ${r.catalogItemId?.name}`, value: r._id }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="issueDate" label="Issue Date (optional)">
                <Input type="date" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="visibleToParent" label="Visible to Parent" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="requiresApprovedRequest" label="Requires Approved Request" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => { setUploadOpen(false); form.resetFields(); setFileObj(null); }}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={uploading}>Upload</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default StudentVaultAdmin;
