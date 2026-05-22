import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, Tag, message, Space, DatePicker } from 'antd';
import { PlusOutlined, WarningOutlined, EditOutlined } from '@ant-design/icons';
import { incidentAPI, studentAPI } from '@/services/api';
import dayjs from 'dayjs';

import useAuthStore from '@/store/authStore';

const { Option } = Select;
const { TextArea } = Input;

const severityColors = { low: 'blue', medium: 'orange', high: 'red' };
const typeLabels = {
  fight: 'Fight', misconduct: 'Misconduct', bullying: 'Bullying',
  property_damage: 'Property Damage', truancy: 'Truancy', other: 'Other',
};

const Incidents = () => {
  const { user } = useAuthStore();
  const canWrite = user?.role !== 'visitor';
  const [incidents, setIncidents] = useState([]);
  const [students, setStudents] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [actionModal, setActionModal] = useState(null);
  const [typeFilter, setTypeFilter] = useState(undefined);
  const [page, setPage] = useState(1);
  const [form] = Form.useForm();
  const [actionForm] = Form.useForm();

  const fetchIncidents = async () => {
    setLoading(true);
    try {
      const res = await incidentAPI.getAll({ page, limit: 20, type: typeFilter });
      setIncidents(res.data?.incidents || []);
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
  useEffect(() => { fetchIncidents(); }, [page, typeFilter]);

  const handleCreate = async (values) => {
    try {
      await incidentAPI.create({
        ...values,
        date: values.date ? values.date.toISOString() : undefined,
      });
      message.success('Incident reported');
      form.resetFields();
      setModal(false);
      fetchIncidents();
    } catch (e) { message.error(e.message); }
  };

  const handleUpdateAction = async (values) => {
    try {
      await incidentAPI.updateAction(actionModal._id, values.actionTaken);
      message.success('Action updated');
      actionForm.resetFields();
      setActionModal(null);
      fetchIncidents();
    } catch (e) { message.error(e.message); }
  };

  const columns = [
    { title: 'Student', key: 'student', render: (_, r) => r.studentId?.name || 'N/A' },
    { title: 'Roll No', key: 'roll', render: (_, r) => r.studentId?.rollNo },
    {
      title: 'Type', dataIndex: 'type', key: 'type',
      render: t => <Tag>{typeLabels[t] || t}</Tag>,
    },
    {
      title: 'Severity', dataIndex: 'severity', key: 'severity',
      render: s => <Tag color={severityColors[s]}>{(s || '').toUpperCase()}</Tag>,
    },
    { title: 'Description', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: 'Action Taken', dataIndex: 'actionTaken', key: 'actionTaken',
      render: v => v || <span style={{ color: '#999' }}>—</span>,
      ellipsis: true,
    },
    { title: 'Date', dataIndex: 'date', render: d => dayjs(d).format('DD/MM/YYYY') },
    { title: 'Reported By', key: 'reporter', render: (_, r) => r.reportedBy?.name || '-' },
    ...(canWrite ? [{
      title: 'Action', key: 'actions', width: 80,
      render: (_, r) => (
        <Button size="small" icon={<EditOutlined />} onClick={() => {
          setActionModal(r);
          actionForm.setFieldsValue({ actionTaken: r.actionTaken || '' });
        }}>
          Update
        </Button>
      ),
    }] : []),
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}><WarningOutlined /> Discipline / Incidents</h2>
          <p style={{ color: '#888', margin: 0 }}>Track and manage student discipline incidents</p>
        </div>
        <Space>
          <Select placeholder="Filter type" allowClear style={{ width: 160 }}
            onChange={v => { setTypeFilter(v); setPage(1); }}>
            {Object.entries(typeLabels).map(([k, v]) => (
              <Option key={k} value={k}>{v}</Option>
            ))}
          </Select>
          {canWrite && <Button type="primary" icon={<PlusOutlined />} onClick={() => setModal(true)}>Report Incident</Button>}
        </Space>
      </div>

      <Table columns={columns} dataSource={incidents} rowKey="_id" loading={loading}
        pagination={{ current: page, total, pageSize: 20, onChange: p => setPage(p) }}
        scroll={{ x: 1000 }}
      />

      {/* Create Incident Modal */}
      <Modal title="Report Incident" open={modal} onCancel={() => setModal(false)} onOk={() => form.submit()} destroyOnHidden>
        <Form form={form} onFinish={handleCreate} layout="vertical">
          <Form.Item name="studentId" label="Student" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="children" placeholder="Select student">
              {students.map(s => <Option key={s._id} value={s._id}>{s.name} ({s.rollNo})</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="type" label="Incident Type" rules={[{ required: true }]}>
            <Select placeholder="Select type">
              {Object.entries(typeLabels).map(([k, v]) => (
                <Option key={k} value={k}>{v}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="severity" label="Severity" initialValue="medium">
            <Select>
              <Option value="low">Low</Option>
              <Option value="medium">Medium</Option>
              <Option value="high">High</Option>
            </Select>
          </Form.Item>
          <Form.Item name="description" label="Description" rules={[{ required: true }]}>
            <TextArea rows={3} placeholder="Describe the incident in detail" />
          </Form.Item>
          <Form.Item name="date" label="Date"><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="actionTaken" label="Action Taken (optional)"><TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      {/* Update Action Modal */}
      <Modal title="Update Action Taken" open={!!actionModal} onCancel={() => setActionModal(null)}
        onOk={() => actionForm.submit()} destroyOnHidden>
        <p style={{ marginBottom: 8 }}>
          <strong>Student:</strong> {actionModal?.studentId?.name} &nbsp;|&nbsp;
          <strong>Type:</strong> {typeLabels[actionModal?.type] || actionModal?.type}
        </p>
        <p style={{ color: '#666', marginBottom: 16 }}>{actionModal?.description}</p>
        <Form form={actionForm} onFinish={handleUpdateAction} layout="vertical">
          <Form.Item name="actionTaken" label="Action Taken" rules={[{ required: true }]}>
            <TextArea rows={3} placeholder="e.g., Warning issued, Parent meeting scheduled" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Incidents;
