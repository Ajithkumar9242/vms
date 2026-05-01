import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, Tag, message, DatePicker, Space, Popconfirm } from 'antd';
import { PlusOutlined, CheckOutlined, CloseOutlined, ExportOutlined, ImportOutlined } from '@ant-design/icons';
import { leaveAPI, studentAPI } from '@/services/api';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

const statusColors = { pending: 'orange', approved: 'green', rejected: 'red' };

const LeaveRequests = () => {
  const [leaves, setLeaves] = useState([]);
  const [students, setStudents] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [page, setPage] = useState(1);
  const [form] = Form.useForm();

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const res = await leaveAPI.getAll({ page, limit: 20, status: statusFilter });
      setLeaves(res.data?.leaves || []);
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
  useEffect(() => { fetchLeaves(); }, [page, statusFilter]);

  const handleCreate = async (values) => {
    try {
      await leaveAPI.create({
        ...values,
        fromDate: values.fromDate.toISOString(),
        toDate: values.toDate.toISOString(),
      });
      message.success('Leave request created');
      form.resetFields();
      setModal(false);
      fetchLeaves();
    } catch (e) { message.error(e.message); }
  };

  const handleApprove = async (id) => {
    try { await leaveAPI.approve(id); message.success('Approved'); fetchLeaves(); }
    catch (e) { message.error(e.message); }
  };

  const handleReject = async (id) => {
    try { await leaveAPI.reject(id); message.success('Rejected'); fetchLeaves(); }
    catch (e) { message.error(e.message); }
  };

  const handleMarkOut = async (id) => {
    try { await leaveAPI.markOut(id); message.success('Marked Out'); fetchLeaves(); }
    catch (e) { message.error(e.message); }
  };

  const handleMarkIn = async (id) => {
    try { await leaveAPI.markIn(id); message.success('Marked In'); fetchLeaves(); }
    catch (e) { message.error(e.message); }
  };

  const columns = [
    { title: 'Student', key: 'student', render: (_, r) => r.studentId?.name || 'N/A' },
    { title: 'Roll No', key: 'roll', render: (_, r) => r.studentId?.rollNo },
    { title: 'From', dataIndex: 'fromDate', render: d => dayjs(d).format('DD/MM/YYYY') },
    { title: 'To', dataIndex: 'toDate', render: d => dayjs(d).format('DD/MM/YYYY') },
    { title: 'Reason', dataIndex: 'reason', ellipsis: true },
    { title: 'Status', dataIndex: 'status', render: s => <Tag color={statusColors[s]}>{s.toUpperCase()}</Tag> },
    {
      title: 'Gate', key: 'gate', width: 160,
      render: (_, r) => {
        if (r.status !== 'approved') return '-';
        return (
          <Space size={4}>
            {!r.outTime && <Button size="small" icon={<ExportOutlined />} onClick={() => handleMarkOut(r._id)}>Out</Button>}
            {r.outTime && !r.inTime && <Button size="small" icon={<ImportOutlined />} onClick={() => handleMarkIn(r._id)}>In</Button>}
            {r.outTime && <Tag color="volcano">{dayjs(r.outTime).format('HH:mm')}</Tag>}
            {r.inTime && <Tag color="cyan">{dayjs(r.inTime).format('HH:mm')}</Tag>}
          </Space>
        );
      },
    },
    {
      title: 'Action', key: 'action', width: 120,
      render: (_, r) => r.status === 'pending' && (
        <Space size={4}>
          <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => handleApprove(r._id)} />
          <Button size="small" danger icon={<CloseOutlined />} onClick={() => handleReject(r._id)} />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>Leave / Gate Pass</h2>
          <p style={{ color: '#888', margin: 0 }}>Manage student leave requests and gate passes</p>
        </div>
        <Space>
          <Select placeholder="Filter status" allowClear style={{ width: 150 }} onChange={v => { setStatusFilter(v); setPage(1); }}>
            <Option value="pending">Pending</Option>
            <Option value="approved">Approved</Option>
            <Option value="rejected">Rejected</Option>
          </Select>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModal(true)}>New Request</Button>
        </Space>
      </div>

      <Table columns={columns} dataSource={leaves} rowKey="_id" loading={loading}
        pagination={{ current: page, total, pageSize: 20, onChange: p => setPage(p) }} />

      <Modal title="New Leave Request" open={modal} onCancel={() => setModal(false)} onOk={() => form.submit()} destroyOnHidden>
        <Form form={form} onFinish={handleCreate} layout="vertical">
          <Form.Item name="studentId" label="Student" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="children" placeholder="Select student">
              {students.map(s => <Option key={s._id} value={s._id}>{s.name} ({s.rollNo})</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="fromDate" label="From Date" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="toDate" label="To Date" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="reason" label="Reason" rules={[{ required: true }]}><TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default LeaveRequests;
