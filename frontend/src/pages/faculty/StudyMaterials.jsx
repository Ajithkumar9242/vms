import React, { useEffect, useState, useCallback } from 'react';
import {
  Table, Button, Modal, Form, Input, Select, Tag, Space,
  App, Upload, Typography, Tooltip, Popconfirm, Segmented,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, DownloadOutlined,
  FilePdfOutlined, VideoCameraOutlined, AudioOutlined,
  LinkOutlined, FileImageOutlined, FileOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { materialAPI, subjectAPI } from '@/services/api';
import useAuthStore from '@/store/authStore';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

const TYPE_ICON = {
  pdf: <FilePdfOutlined style={{ color: '#DC2626', fontSize: 18 }} />,
  video: <VideoCameraOutlined style={{ color: '#7C3AED', fontSize: 18 }} />,
  audio: <AudioOutlined style={{ color: '#0891B2', fontSize: 18 }} />,
  image: <FileImageOutlined style={{ color: '#059669', fontSize: 18 }} />,
  link: <LinkOutlined style={{ color: '#2563EB', fontSize: 18 }} />,
  other: <FileOutlined style={{ color: '#64748B', fontSize: 18 }} />,
};

const TYPE_COLOR = {
  pdf: 'red', video: 'purple', audio: 'cyan', image: 'green', link: 'blue', other: 'default',
};

const StudyMaterials = () => {
  const { message } = App.useApp();
  const user = useAuthStore((s) => s.user);
  const isFaculty = ['faculty', 'admin', 'super_admin'].includes(user?.role);

  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterClass, setFilterClass] = useState(null);
  const [filterSub, setFilterSub] = useState(null);
  const [filterType, setFilterType] = useState(null);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Modal
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);

  useEffect(() => {
    import('@/services/api').then(({ schoolAPI, facultyDashboardAPI }) => {
      if (isFaculty && user?.role === 'faculty') {
        facultyDashboardAPI.getDashboard().then((r) => {
          const cl = r?.data?.faculty?.assignedClasses || [];
          setClasses(cl.map((c) => ({ value: c._id, label: c.name })));
        }).catch(() => { });
      } else {
        schoolAPI.getClasses().then((r) => {
          const list = r?.data?.classes || r?.data || [];
          setClasses(list.map((c) => ({ value: c._id, label: c.name })));
        }).catch(() => { });
      }
    });
  }, []);

  useEffect(() => {
    if (filterClass) {
      subjectAPI.getAll({ classId: filterClass }).then((r) => {
        const list = r?.data?.subjects || r?.data || [];
        setSubjects(list.map((s) => ({ value: s._id, label: s.name })));
      }).catch(() => { });
    }
  }, [filterClass]);

  const fetchMaterials = useCallback(() => {
    setLoading(true);
    const params = { page, limit: 15 };
    if (filterClass) params.classId = filterClass;
    if (filterSub) params.subjectId = filterSub;
    if (filterType) params.type = filterType;
    materialAPI.getAll(params).then((r) => {
      const d = r?.data || {};
      setMaterials(Array.isArray(d) ? d : d.materials || []);
      setTotal(d.total || 0);
    }).catch(() => message.error('Failed to load materials'))
      .finally(() => setLoading(false));
  }, [page, filterClass, filterSub, filterType]);

  useEffect(() => { fetchMaterials(); }, [fetchMaterials]);

  const handleUpload = async ({ file }) => {
    if (!file) return;
    setUploading(true);
    try {
      const { uploadAPI } = await import('@/services/api');
      const res = await uploadAPI.upload(file);
      const url = res?.data?.url || res?.url;
      setUploadedFile({ fileUrl: url, fileName: file.name, mimeType: file.type, size: file.size });
      form.setFieldValue('fileUrl', url);
      message.success('File uploaded');
    } catch (e) { message.error('Upload failed: ' + e.message); }
    finally { setUploading(false); }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = {
        ...values,
        ...(uploadedFile || {}),
      };
      await materialAPI.create(payload);
      message.success('Material added');
      setOpen(false);
      form.resetFields();
      setUploadedFile(null);
      fetchMaterials();
    } catch (e) { if (e?.message) message.error(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    try {
      await materialAPI.remove(id);
      message.success('Deleted');
      fetchMaterials();
    } catch (e) { message.error(e.message || 'Delete failed'); }
  };

  const columns = [
    {
      title: '', key: 'icon', width: 40,
      render: (_, r) => TYPE_ICON[r.type] || TYPE_ICON.other,
    },
    { title: 'Title', dataIndex: 'title', key: 'title' },
    { title: 'Type', dataIndex: 'type', key: 'type', render: (v) => <Tag color={TYPE_COLOR[v]}>{v}</Tag> },
    { title: 'Class', key: 'class', render: (_, r) => r.classId?.name || '—' },
    { title: 'Subject', key: 'subject', render: (_, r) => r.subjectId?.name || '—' },
    { title: 'By', key: 'by', render: (_, r) => r.uploadedBy?.name || '—' },
    { title: 'Date', key: 'date', render: (_, r) => dayjs(r.createdAt).format('DD MMM YYYY') },
    {
      title: 'Actions', key: 'actions',
      render: (_, r) => (
        <Space>
          {r.fileUrl && (
            <Tooltip title="Open/Download">
              <Button icon={<DownloadOutlined />} size="small"
                onClick={() => window.open(r.fileUrl, '_blank')} />
            </Tooltip>
          )}
          {isFaculty && (
            <Popconfirm title="Delete this material?" onConfirm={() => handleDelete(r._id)} okText="Yes">
              <Button icon={<DeleteOutlined />} size="small" danger />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const watchType = Form.useWatch('type', form);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>
          <FilePdfOutlined style={{ marginRight: 8 }} />Study Materials
        </Title>
        {isFaculty && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setUploadedFile(null); setOpen(true); }} id="add-material-btn">
            Upload Material
          </Button>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <Select placeholder="Class" allowClear style={{ width: 160 }}
          options={classes} onChange={(v) => { setFilterClass(v); setPage(1); }} id="material-class-filter" />
        <Select placeholder="Subject" allowClear style={{ width: 180 }}
          options={subjects} onChange={(v) => { setFilterSub(v); setPage(1); }} disabled={!filterClass} />
        <Select placeholder="Type" allowClear style={{ width: 130 }}
          onChange={(v) => { setFilterType(v); setPage(1); }}
          options={['pdf', 'video', 'audio', 'image', 'link', 'other'].map((t) => ({ value: t, label: t.toUpperCase() }))}
          id="material-type-filter"
        />
      </div>

      <Table
        dataSource={materials} columns={columns} rowKey="_id"
        loading={loading}
        pagination={{ current: page, pageSize: 15, total, onChange: setPage }}
        style={{ borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
      />

      {/* Upload Modal */}
      <Modal
        open={open}
        title="Upload Study Material"
        onCancel={() => setOpen(false)}
        onOk={handleSave}
        confirmLoading={saving}
        okText="Save"
        width={520}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item name="title" label="Title" rules={[{ required: true }]}>
            <Input placeholder="Material title" id="material-title-input" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <TextArea rows={2} placeholder="Optional description..." />
          </Form.Item>
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item name="classId" label="Class" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Select placeholder="Class" options={classes}
                onChange={(v) => {
                  form.setFieldValue('subjectId', undefined);
                  subjectAPI.getAll({ classId: v }).then((r) => {
                    setSubjects((r?.data?.subjects || r?.data || []).map((s) => ({ value: s._id, label: s.name })));
                  }).catch(() => { });
                }}
                id="material-class-select"
              />
            </Form.Item>
            <Form.Item name="subjectId" label="Subject" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Select placeholder="Subject" options={subjects} id="material-subject-select" />
            </Form.Item>
          </div>
          <Form.Item name="type" label="Type" rules={[{ required: true }]}>
            <Segmented
              options={['pdf', 'video', 'audio', 'image', 'link', 'other'].map((t) => ({ label: t.toUpperCase(), value: t }))}
            />
          </Form.Item>

          {watchType === 'link' ? (
            <Form.Item name="fileUrl" label="URL" rules={[{ required: true }]}>
              <Input prefix={<LinkOutlined />} placeholder="https://..." />
            </Form.Item>
          ) : (
            <Form.Item label="File">
              <Upload customRequest={handleUpload} showUploadList={false} maxCount={1} disabled={uploading}>
                <Button icon={<UploadOutlined />} loading={uploading}>
                  {uploadedFile ? uploadedFile.fileName : 'Choose File'}
                </Button>
              </Upload>
              {uploadedFile && (
                <Text type="success" style={{ marginLeft: 8, fontSize: 12 }}>✓ {uploadedFile.fileName}</Text>
              )}
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default StudyMaterials;
