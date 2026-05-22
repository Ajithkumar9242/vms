import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, DatePicker, Switch, Tag, message, Typography, Space, Alert } from 'antd';
import { PlusOutlined, EditOutlined, CheckCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { setupAPI } from '@/services/api';
import useAuthStore from '@/store/authStore';

const { Title } = Typography;

const AcademicYear = () => {
  const user = useAuthStore((s) => s.user);
  const isVisitor = user?.role === 'visitor';
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState({ open: false, record: null });
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    setupAPI.getAcademicYears()
      .then((res) => setData(res?.data || []))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openModal = (record = null) => {
    setModal({ open: true, record });
    if (record) {
      form.setFieldsValue({
        ...record,
        startDate: record.startDate ? dayjs(record.startDate) : null,
        endDate: record.endDate ? dayjs(record.endDate) : null,
      });
    } else {
      form.resetFields();
    }
  };

  const onFinish = async (values) => {
    setSaving(true);
    try {
      const payload = {
        ...values,
        startDate: values.startDate?.toISOString(),
        endDate: values.endDate?.toISOString(),
      };
      if (modal.record) {
        await setupAPI.updateAcademicYear(modal.record._id, payload);
        message.success('Academic year updated');
      } else {
        await setupAPI.createAcademicYear(payload);
        message.success('Academic year created');
      }
      setModal({ open: false, record: null });
      load();
    } catch (e) {
      message.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name', render: (v, r) => (
      <Space>{v}{r.isActive && <Tag color="green" icon={<CheckCircleOutlined />}>Active</Tag>}</Space>
    ) },
    { title: 'Start', dataIndex: 'startDate', key: 'start', render: (v) => dayjs(v).format('DD MMM YYYY') },
    { title: 'End', dataIndex: 'endDate', key: 'end', render: (v) => dayjs(v).format('DD MMM YYYY') },
    ...(!isVisitor ? [{ title: '', key: 'action', width: 60, render: (_, r) => (
      <Button size="small" icon={<EditOutlined />} onClick={() => openModal(r)} />
    ) }] : []),
  ];

  return (
    <div style={{ padding: 24 }}>
      {isVisitor && (
        <Alert
          type="info"
          showIcon
          message="You are logged in as a visitor. Academic years are read-only."
          style={{ marginBottom: 16 }}
        />
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>📅 Academic Years</Title>
        {!isVisitor && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>New Year</Button>
        )}
      </div>
      <Table rowKey="_id" columns={columns} dataSource={data} loading={loading} pagination={false} />

      <Modal
        title={modal.record ? 'Edit Academic Year' : 'New Academic Year'}
        open={modal.open}
        onCancel={() => setModal({ open: false, record: null })}
        footer={null}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={onFinish} style={{ marginTop: 16 }}>
          <Form.Item label="Name (e.g. 2026-27)" name="name" rules={[{ required: true }]}>
            <Input placeholder="2026-27" />
          </Form.Item>
          <Form.Item label="Start Date" name="startDate" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="End Date" name="endDate" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Set as Active" name="isActive" valuePropName="checked">
            <Switch />
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

export default AcademicYear;
