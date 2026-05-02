import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, DatePicker, Select, Popconfirm, message, Typography, Space } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { setupAPI } from '@/services/api';

const { Title } = Typography;
const { Option } = Select;

const AcademicTerm = () => {
  const [data, setData] = useState([]);
  const [years, setYears] = useState([]);
  const [activeYearId, setActiveYearId] = useState(null);
  const [filterYear, setFilterYear] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState({ open: false, record: null });
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setupAPI.getAcademicYears().then((res) => {
      const ys = res?.data || [];
      setYears(ys);
      const active = ys.find((y) => y.isActive);
      if (active) { setActiveYearId(active._id); setFilterYear(active._id); }
    });
  }, []);

  useEffect(() => {
    if (!filterYear) return;
    setLoading(true);
    setupAPI.getTerms({ academicYearId: filterYear })
      .then((res) => setData(res?.data || []))
      .finally(() => setLoading(false));
  }, [filterYear]);

  const openModal = (record = null) => {
    setModal({ open: true, record });
    form.resetFields();
    if (record) {
      form.setFieldsValue({
        ...record,
        startDate: record.startDate ? dayjs(record.startDate) : null,
        endDate: record.endDate ? dayjs(record.endDate) : null,
      });
    } else {
      form.setFieldValue('academicYearId', filterYear || activeYearId);
    }
  };

  const onFinish = async (values) => {
    setSaving(true);
    try {
      const payload = { ...values, startDate: values.startDate?.toISOString(), endDate: values.endDate?.toISOString() };
      if (modal.record) {
        await setupAPI.updateTerm(modal.record._id, payload);
        message.success('Term updated');
      } else {
        await setupAPI.createTerm(payload);
        message.success('Term created');
      }
      setModal({ open: false, record: null });
      setFilterYear((p) => p); // re-trigger load
    } catch (e) { message.error(e.message); } finally { setSaving(false); }
  };

  const deleteTerm = async (id) => {
    try { await setupAPI.deleteTerm(id); message.success('Term deleted'); setFilterYear((p) => p); }
    catch (e) { message.error(e.message); }
  };

  const columns = [
    { title: 'Name', dataIndex: 'name' },
    { title: 'Start', dataIndex: 'startDate', render: (v) => dayjs(v).format('DD MMM YYYY') },
    { title: 'End', dataIndex: 'endDate', render: (v) => dayjs(v).format('DD MMM YYYY') },
    { title: '', key: 'action', width: 90, render: (_, r) => (
      <Space>
        <Button size="small" icon={<EditOutlined />} onClick={() => openModal(r)} />
        <Popconfirm title="Delete this term?" onConfirm={() => deleteTerm(r._id)}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </Space>
    ) },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>📆 Academic Terms</Title>
        <Space>
          <Select value={filterYear} onChange={setFilterYear} style={{ width: 160 }} placeholder="Select Year">
            {years.map((y) => <Option key={y._id} value={y._id}>{y.name}</Option>)}
          </Select>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>New Term</Button>
        </Space>
      </div>
      <Table rowKey="_id" columns={columns} dataSource={data} loading={loading} pagination={false} />
      <Modal title={modal.record ? 'Edit Term' : 'New Term'} open={modal.open} onCancel={() => setModal({ open: false, record: null })} footer={null} destroyOnHidden>
        <Form form={form} layout="vertical" onFinish={onFinish} style={{ marginTop: 16 }}>
          <Form.Item label="Academic Year" name="academicYearId" rules={[{ required: true }]}>
            <Select>{years.map((y) => <Option key={y._id} value={y._id}>{y.name}</Option>)}</Select>
          </Form.Item>
          <Form.Item label="Term Name" name="name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Term 1 / Mid Term / Final" />
          </Form.Item>
          <Form.Item label="Start Date" name="startDate" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="End Date" name="endDate" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={saving} block>Save</Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AcademicTerm;
