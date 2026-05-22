import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, Tag, message, Switch, DatePicker } from 'antd';
import { PlusOutlined, MedicineBoxOutlined } from '@ant-design/icons';
import { healthAPI, studentAPI } from '@/services/api';
import dayjs from 'dayjs';

import useAuthStore from '@/store/authStore';

const { Option } = Select;
const { TextArea } = Input;

const HealthRecords = () => {
  const { user } = useAuthStore();
  const canWrite = user?.role !== 'visitor';
  const [records, setRecords] = useState([]);
  const [students, setStudents] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [page, setPage] = useState(1);
  const [form] = Form.useForm();

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await healthAPI.getAll({ page, limit: 20 });
      setRecords(res.data?.records || []);
      setTotal(res.data?.total || 0);
    } catch (e) { message.error(e.message); }
    setLoading(false);
  };

  const fetchStudents = async () => {
    try {
      const res = await studentAPI.getAll({ limit: 200 });
      setStudents(res.data || []);
    } catch {}
  };

  useEffect(() => { fetchStudents(); }, []);
  useEffect(() => { fetchRecords(); }, [page]);

  const handleCreate = async (values) => {
    try {
      await healthAPI.create({
        ...values,
        date: values.date ? values.date.toISOString() : undefined,
      });
      message.success('Health record added');
      form.resetFields();
      setModal(false);
      fetchRecords();
    } catch (e) { message.error(e.message); }
  };

  const columns = [
    { title: 'Student', key: 'student', render: (_, r) => r.studentId?.name || 'N/A' },
    { title: 'Roll No', key: 'roll', render: (_, r) => r.studentId?.rollNo },
    { title: 'Issue', dataIndex: 'issue', key: 'issue' },
    { title: 'Medication', dataIndex: 'medication', key: 'medication', render: v => v || '-' },
    { title: 'Doctor Visit', dataIndex: 'doctorVisit', key: 'doctorVisit', render: v => v ? <Tag color="red">Yes</Tag> : <Tag>No</Tag> },
    { title: 'Date', dataIndex: 'date', render: d => dayjs(d).format('DD/MM/YYYY') },
    { title: 'Notes', dataIndex: 'notes', ellipsis: true, render: v => v || '-' },
    { title: 'Reported By', key: 'reporter', render: (_, r) => r.reportedBy?.name || '-' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}><MedicineBoxOutlined /> Health Records</h2>
          <p style={{ color: '#888', margin: 0 }}>Track student health issues and medical logs</p>
        </div>
        {canWrite && <Button type="primary" icon={<PlusOutlined />} onClick={() => setModal(true)}>Add Record</Button>}
      </div>

      <Table columns={columns} dataSource={records} rowKey="_id" loading={loading}
        pagination={{ current: page, total, pageSize: 20, onChange: p => setPage(p) }} />

      <Modal title="Add Health Record" open={modal} onCancel={() => setModal(false)} onOk={() => form.submit()} destroyOnHidden>
        <Form form={form} onFinish={handleCreate} layout="vertical">
          <Form.Item name="studentId" label="Student" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="children" placeholder="Select student">
              {students.map(s => <Option key={s._id} value={s._id}>{s.name} ({s.rollNo})</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="issue" label="Issue" rules={[{ required: true }]}><Input placeholder="e.g., Fever, Headache" /></Form.Item>
          <Form.Item name="medication" label="Medication"><Input placeholder="e.g., Paracetamol" /></Form.Item>
          <Form.Item name="doctorVisit" label="Doctor Visit" valuePropName="checked"><Switch /></Form.Item>
          <Form.Item name="date" label="Date"><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="notes" label="Notes"><TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default HealthRecords;
