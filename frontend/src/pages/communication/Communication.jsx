import React, { useEffect, useState, useCallback } from 'react';
import {
  Table, Typography, Button, App, Empty, Modal, Form,
  Input, Select, Tag, Upload, Space, Card, List, Progress, Tooltip, Divider,
} from 'antd';
import {
  SendOutlined, UploadOutlined, PaperClipOutlined, DeleteOutlined,
  FilePdfOutlined, FileImageOutlined, FileTextOutlined,
  PlayCircleOutlined, CustomerServiceOutlined, DownloadOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import api, { communicationAPI, schoolAPI } from '@/services/api';
import dayjs from 'dayjs';
import useAuthStore from '@/store/authStore';

const { Title, Text, Paragraph } = Typography;

const Communication = () => {
  const { message } = App.useApp();
  const { user } = useAuthStore();
  const canWrite = user?.role !== 'visitor';

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const [sendOpen, setSendOpen] = useState(false);
  const [classes, setClasses] = useState([]);
  const [sendForm] = Form.useForm();
  const [targetType, setTargetType] = useState('all');

  // Attachment lists
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);

  // Message details modal
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await communicationAPI.getAll({ page, limit: 20 });
      setMessages(res.data.messages || res.messages || []);
      setTotal(res.data.total || res.total || 0);
    } catch (err) {
      message.error(err.message || 'Failed to fetch messages');
    } finally {
      setLoading(false);
    }
  }, [page, message]);

  const fetchClasses = useCallback(async () => {
    try {
      const res = await schoolAPI.getClasses({ limit: 50 });
      setClasses(res.data || []);
    } catch {}
  }, []);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);
  useEffect(() => { fetchClasses(); }, [fetchClasses]);

  // Handle custom upload to Cloudinary
  const handleUpload = async (options) => {
    const { file, onSuccess, onError, onProgress } = options;
    const formData = new FormData();
    formData.append('file', file);
    setUploading(true);

    try {
      const res = await api.post('/upload?folder=materials', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: ({ total, loaded }) => {
          onProgress({ percent: Math.round((loaded / total) * 100) });
        }
      });

      const uploadData = res.data?.data || res.data;
      const url = uploadData?.url;
      const publicId = uploadData?.publicId;

      if (!url) throw new Error('Upload returned empty URL');

      const newAttachment = {
        url,
        publicId,
        originalName: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        uploadedAt: new Date(),
      };

      setAttachments((prev) => [...prev, newAttachment]);
      onSuccess(newAttachment);
      message.success(`${file.name} uploaded successfully`);
    } catch (err) {
      onError(err);
      message.error(err.message || 'File upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAttachment = (indexToRemove) => {
    setAttachments((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSend = async (values) => {
    try {
      const payload = {
        ...values,
        attachments,
      };
      await communicationAPI.send(payload);
      message.success('Announcement broadcasted successfully');
      setSendOpen(false);
      sendForm.resetFields();
      setAttachments([]);
      setTargetType('all');
      fetchMessages();
    } catch (err) {
      message.error(err.message || 'Failed to send message');
    }
  };

  const targetTypeColors = { all: 'purple', class: 'blue', student: 'green', faculty: 'orange' };

  // Helper to resolve suitable icon for mimeTypes
  const getAttachmentIcon = (mimeType) => {
    if (!mimeType) return <FileTextOutlined style={{ fontSize: 24, color: '#64748b' }} />;
    if (mimeType.includes('pdf')) return <FilePdfOutlined style={{ fontSize: 24, color: '#ef4444' }} />;
    if (mimeType.includes('image')) return <FileImageOutlined style={{ fontSize: 24, color: '#3b82f6' }} />;
    if (mimeType.includes('audio')) return <CustomerServiceOutlined style={{ fontSize: 24, color: '#eab308' }} />;
    if (mimeType.includes('video')) return <PlayCircleOutlined style={{ fontSize: 24, color: '#10b981' }} />;
    return <FileTextOutlined style={{ fontSize: 24, color: '#64748b' }} />;
  };

  // Helper to format bytes
  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const columns = [
    { title: 'Title', dataIndex: 'title', key: 'title', width: 220 },
    {
      title: 'Content',
      dataIndex: 'content',
      key: 'content',
      width: 320,
      ellipsis: true,
    },
    {
      title: 'Target',
      dataIndex: 'targetType',
      key: 'targetType',
      width: 100,
      render: (v) => <Tag color={targetTypeColors[v] || 'default'}>{v?.toUpperCase()}</Tag>,
    },
    {
      title: 'Attachments',
      dataIndex: 'attachments',
      key: 'attachments',
      width: 130,
      render: (attachmentsList) => {
        const count = attachmentsList?.length || 0;
        if (!count) return <Text type="secondary">—</Text>;
        return <Tag color="orange" icon={<PaperClipOutlined />}>{count} File{count > 1 ? 's' : ''}</Tag>;
      }
    },
    {
      title: 'Sent By',
      dataIndex: 'sentBy',
      key: 'sentBy',
      width: 150,
      render: (v) => v?.name || '—',
    },
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (v) => dayjs(v).format('DD MMM YYYY, HH:mm'),
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={3} className="page-title" style={{ margin: 0 }}>Communication Hub</Title>
          <Text className="page-subtitle">Send circulars, announcements, and files to parents and students</Text>
        </div>
        {canWrite && (
          <Button type="primary" icon={<SendOutlined />} onClick={() => setSendOpen(true)} id="send-message-btn">
            Send Announcement
          </Button>
        )}
      </div>

      <Table
        columns={columns}
        dataSource={messages}
        rowKey="_id"
        loading={loading}
        pagination={{ current: page, total, pageSize: 20, onChange: setPage, showTotal: (t) => `Total ${t} messages` }}
        scroll={{ x: 1000 }}
        size="middle"
        style={{ background: '#FFF', borderRadius: 8, cursor: 'pointer' }}
        onRow={(record) => ({
          onClick: () => {
            setSelectedMessage(record);
            setDetailsOpen(true);
          }
        })}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No messages sent yet" /> }}
      />

      {/* Send Message Modal */}
      <Modal
        title="Send Announcement"
        open={sendOpen}
        onCancel={() => { setSendOpen(false); sendForm.resetFields(); setAttachments([]); setTargetType('all'); }}
        onOk={() => sendForm.submit()}
        okText="Broadcast"
        destroyOnClose
        width={560}
      >
        <Form form={sendForm} layout="vertical" onFinish={handleSend} initialValues={{ targetType: 'all' }}>
          <Form.Item name="title" label="Title / Subject" rules={[{ required: true, message: 'Title is required' }]}>
            <Input placeholder="e.g. Annual Day Circular 2026" />
          </Form.Item>
          <Form.Item name="content" label="Message Body" rules={[{ required: true, message: 'Content is required' }]}>
            <Input.TextArea rows={5} placeholder="Write announcement details..." maxLength={2000} showCount />
          </Form.Item>
          
          {/* File Upload Section */}
          <div style={{ marginBottom: 20 }}>
            <Text style={{ fontWeight: 600, display: 'block', marginBottom: 8 }}>Attachments (PDFs, Images, Audio, Video)</Text>
            <Upload
              customRequest={handleUpload}
              showUploadList={false}
              multiple
              disabled={uploading}
            >
              <Button icon={<UploadOutlined />} loading={uploading}>Upload Attachment</Button>
            </Upload>

            {attachments.length > 0 && (
              <List
                size="small"
                style={{ marginTop: 12, border: '1px solid #f1f5f9', borderRadius: 6, background: '#f8fafc' }}
                dataSource={attachments}
                renderItem={(item, index) => (
                  <List.Item
                    actions={[
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleRemoveAttachment(index)}
                      />
                    ]}
                  >
                    <List.Item.Meta
                      avatar={getAttachmentIcon(item.mimeType)}
                      title={<Text style={{ fontSize: 13 }} ellipsis>{item.originalName}</Text>}
                      description={<Text type="secondary" style={{ fontSize: 11 }}>{formatBytes(item.size)}</Text>}
                    />
                  </List.Item>
                )}
              />
            )}
          </div>

          <Form.Item name="targetType" label="Target Audience" rules={[{ required: true }]}>
            <Select
              options={[
                { label: 'All Parents', value: 'all' },
                { label: 'All Faculty', value: 'faculty' },
                { label: 'Specific Class', value: 'class' },
                { label: 'Specific Student', value: 'student' },
              ]}
              onChange={(v) => setTargetType(v)}
            />
          </Form.Item>
          {targetType === 'class' && (
            <Form.Item name="targetId" label="Select Class" rules={[{ required: true, message: 'Class is required' }]}>
              <Select
                placeholder="Select class"
                options={classes.map((c) => ({ label: c.name, value: c._id }))}
              />
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* Details View Modal */}
      <Modal
        title="Announcement Details"
        open={detailsOpen}
        onCancel={() => { setDetailsOpen(false); setSelectedMessage(null); }}
        footer={null}
        width={600}
        destroyOnClose
      >
        {selectedMessage && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Title level={4} style={{ margin: '0 0 6px 0' }}>{selectedMessage.title}</Title>
              <Space wrap>
                <Tag color={targetTypeColors[selectedMessage.targetType] || 'default'}>
                  {selectedMessage.targetType?.toUpperCase()}
                </Tag>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Sent by: {selectedMessage.sentBy?.name || 'School Admin'} · {dayjs(selectedMessage.createdAt).format('DD MMMM YYYY, HH:mm')}
                </Text>
              </Space>
            </div>
            
            <Divider style={{ margin: '12px 0' }} />

            <div style={{ minHeight: 120, padding: '4px 0' }}>
              <Paragraph style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.6, color: '#1e293b' }}>
                {selectedMessage.content}
              </Paragraph>
            </div>

            {selectedMessage.attachments && selectedMessage.attachments.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <Divider orientation="left" style={{ margin: '12px 0', fontSize: 13 }}>
                  <PaperClipOutlined /> Attachments ({selectedMessage.attachments.length})
                </Divider>

                <List
                  grid={{ gutter: 12, xs: 1, sm: 2 }}
                  dataSource={selectedMessage.attachments}
                  renderItem={(item) => {
                    const isImage = item.mimeType?.includes('image');
                    const isAudio = item.mimeType?.includes('audio');
                    const isVideo = item.mimeType?.includes('video');

                    return (
                      <List.Item>
                        <Card
                          hoverable
                          size="small"
                          style={{ borderRadius: 6, border: '1px solid #e2e8f0', background: '#f8fafc' }}
                          bodyStyle={{ padding: 10 }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            {getAttachmentIcon(item.mimeType)}
                            <div style={{ overflow: 'hidden', flex: 1 }}>
                              <Text strong style={{ fontSize: 12, display: 'block' }} ellipsis>
                                {item.originalName}
                              </Text>
                              <Text type="secondary" style={{ fontSize: 10 }}>
                                {formatBytes(item.size)}
                              </Text>
                            </div>
                          </div>

                          {/* Image Thumbnail */}
                          {isImage && (
                            <div style={{ textAlign: 'center', marginBottom: 8, background: '#fff', borderRadius: 4, padding: 4, border: '1px solid #e2e8f0' }}>
                              <img src={item.url} alt={item.originalName} style={{ maxHeight: 90, maxWidth: '100%', objectFit: 'contain' }} />
                            </div>
                          )}

                          {/* Audio Player */}
                          {isAudio && (
                            <div style={{ marginBottom: 8 }}>
                              <audio src={item.url} controls style={{ width: '100%', height: 32 }} />
                            </div>
                          )}

                          {/* Video Player */}
                          {isVideo && (
                            <div style={{ marginBottom: 8 }}>
                              <video src={item.url} controls style={{ width: '100%', borderRadius: 4, maxHeight: 110, background: '#000' }} />
                            </div>
                          )}

                          <Space style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                            <Tooltip title="View original">
                              <Button
                                size="small"
                                icon={<EyeOutlined />}
                                onClick={() => window.open(item.url, '_blank')}
                              />
                            </Tooltip>
                            <Tooltip title="Download">
                              <Button
                                size="small"
                                type="primary"
                                icon={<DownloadOutlined />}
                                onClick={() => {
                                  const a = document.createElement('a');
                                  a.href = item.url;
                                  a.download = item.originalName;
                                  document.body.appendChild(a);
                                  a.click();
                                  document.body.removeChild(a);
                                }}
                              />
                            </Tooltip>
                          </Space>
                        </Card>
                      </List.Item>
                    );
                  }}
                />
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Communication;
