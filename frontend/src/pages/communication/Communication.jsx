import React, { useEffect, useState, useCallback } from 'react';
import {
  Table, Typography, Button, App, Empty, Modal, Form,
  Input, Select, Tag,
} from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { communicationAPI, schoolAPI } from '@/services/api';
import dayjs from 'dayjs';

import useAuthStore from '@/store/authStore';

const { Title, Text } = Typography;

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

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await communicationAPI.getAll({ page, limit: 20 });
      setMessages(res.data.messages);
      setTotal(res.data.total);
    } catch (err) {
      message.error(err.message);
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

  const handleSend = async (values) => {
    try {
      await communicationAPI.send(values);
      message.success('Message sent successfully');
      setSendOpen(false);
      sendForm.resetFields();
      setTargetType('all');
      fetchMessages();
    } catch (err) {
      message.error(err.message);
    }
  };

  const targetTypeColors = { all: 'purple', class: 'blue', student: 'green' };

  const columns = [
    { title: 'Title', dataIndex: 'title', key: 'title', width: 200 },
    {
      title: 'Content',
      dataIndex: 'content',
      key: 'content',
      width: 300,
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
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={3} className="page-title" style={{ margin: 0 }}>Communication</Title>
          <Text className="page-subtitle">Send messages and announcements</Text>
        </div>
        {canWrite && (
          <Button type="primary" icon={<SendOutlined />} onClick={() => setSendOpen(true)} id="send-message-btn">
            Send Message
          </Button>
        )}
      </div>

      <Table
        columns={columns}
        dataSource={messages}
        rowKey="_id"
        loading={loading}
        pagination={{ current: page, total, pageSize: 20, onChange: setPage, showTotal: (t) => `Total ${t} messages` }}
        scroll={{ x: 900 }}
        size="middle"
        style={{ background: '#FFF', borderRadius: 8 }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No messages sent yet" /> }}
      />

      {/* Send Message Modal */}
      <Modal
        title="Send Message"
        open={sendOpen}
        onCancel={() => { setSendOpen(false); sendForm.resetFields(); setTargetType('all'); }}
        onOk={() => sendForm.submit()}
        okText="Send"
        destroyOnHidden
        width={520}
      >
        <Form form={sendForm} layout="vertical" onFinish={handleSend} initialValues={{ targetType: 'all' }}>
          <Form.Item name="title" label="Title" rules={[{ required: true, message: 'Title is required' }]}>
            <Input placeholder="Message title" />
          </Form.Item>
          <Form.Item name="content" label="Content" rules={[{ required: true, message: 'Content is required' }]}>
            <Input.TextArea rows={4} placeholder="Write your message..." maxLength={2000} showCount />
          </Form.Item>
          <Form.Item name="targetType" label="Send To" rules={[{ required: true }]}>
            <Select
              options={[
                { label: 'All', value: 'all' },
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
    </div>
  );
};

export default Communication;
