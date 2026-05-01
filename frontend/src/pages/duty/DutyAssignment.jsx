import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, Tag, message, DatePicker, Space, Card, Row, Col } from 'antd';
import { PlusOutlined, ScheduleOutlined } from '@ant-design/icons';
import { dutyAPI, facultyAPI } from '@/services/api';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

const dutyTypeLabels = {
  hostel: 'Hostel', night_duty: 'Night Duty', class: 'Class',
  sports: 'Sports', exam: 'Exam', other: 'Other',
};
const dutyTypeColors = {
  hostel: 'purple', night_duty: 'volcano', class: 'blue',
  sports: 'green', exam: 'orange', other: 'default',
};
const shiftLabels = {
  morning: 'Morning', afternoon: 'Afternoon', night: 'Night', full_day: 'Full Day',
};

const DutyAssignment = () => {
  const [duties, setDuties] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [dateFilter, setDateFilter] = useState(null);
  const [dutyTypeFilter, setDutyTypeFilter] = useState(undefined);
  const [page, setPage] = useState(1);
  const [form] = Form.useForm();

  // Fetch all duties (paginated) or by date
  const fetchDuties = async () => {
    setLoading(true);
    try {
      if (dateFilter) {
        const res = await dutyAPI.getByDate(dateFilter);
        setDuties(res.data || []);
        setTotal((res.data || []).length);
      } else {
        const res = await dutyAPI.getAll({ page, limit: 20, dutyType: dutyTypeFilter });
        setDuties(res.data?.duties || []);
        setTotal(res.data?.total || 0);
      }
    } catch (e) { message.error(e.message); }
    setLoading(false);
  };

  const fetchFaculty = async () => {
    try {
      const res = await facultyAPI.getAll({ limit: 200 });
      setFaculty(res.data?.faculty || res.data || []);
    } catch {}
  };

  useEffect(() => { fetchFaculty(); }, []);
  useEffect(() => { fetchDuties(); }, [page, dateFilter, dutyTypeFilter]);

  const handleAssign = async (values) => {
    try {
      await dutyAPI.assign({
        ...values,
        date: values.date.toISOString(),
      });
      message.success('Duty assigned');
      form.resetFields();
      setModal(false);
      fetchDuties();
    } catch (e) { message.error(e.message); }
  };

  const columns = [
    {
      title: 'Faculty', key: 'faculty',
      render: (_, r) => r.facultyId?.name || 'N/A',
    },
    {
      title: 'Employee ID', key: 'empId',
      render: (_, r) => r.facultyId?.employeeId || '-',
    },
    {
      title: 'Duty Type', dataIndex: 'dutyType', key: 'dutyType',
      render: t => <Tag color={dutyTypeColors[t]}>{dutyTypeLabels[t] || t}</Tag>,
    },
    {
      title: 'Shift', dataIndex: 'shift', key: 'shift',
      render: s => shiftLabels[s] || s || '-',
    },
    {
      title: 'Date', dataIndex: 'date',
      render: d => dayjs(d).format('DD/MM/YYYY'),
      sorter: (a, b) => new Date(a.date) - new Date(b.date),
    },
    { title: 'Notes', dataIndex: 'notes', ellipsis: true, render: v => v || '-' },
    { title: 'Assigned By', key: 'assignedBy', render: (_, r) => r.assignedBy?.name || '-' },
  ];

  // Count by duty type for summary
  const typeCounts = {};
  duties.forEach(d => {
    typeCounts[d.dutyType] = (typeCounts[d.dutyType] || 0) + 1;
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}><ScheduleOutlined /> Staff Duty Assignment</h2>
          <p style={{ color: '#888', margin: 0 }}>Assign and track staff/warden duties</p>
        </div>
        <Space>
          <DatePicker
            placeholder="Filter by date"
            allowClear
            onChange={(d) => {
              setDateFilter(d ? d.format('YYYY-MM-DD') : null);
              setPage(1);
            }}
          />
          <Select placeholder="Duty type" allowClear style={{ width: 150 }}
            onChange={v => { setDutyTypeFilter(v); setDateFilter(null); setPage(1); }}>
            {Object.entries(dutyTypeLabels).map(([k, v]) => (
              <Option key={k} value={k}>{v}</Option>
            ))}
          </Select>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModal(true)}>Assign Duty</Button>
        </Space>
      </div>

      {/* Quick summary cards */}
      {dateFilter && duties.length > 0 && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          {Object.entries(typeCounts).map(([type, count]) => (
            <Col key={type} span={4}>
              <Card size="small">
                <Tag color={dutyTypeColors[type]}>{dutyTypeLabels[type] || type}</Tag>
                <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>{count}</div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Table columns={columns} dataSource={duties} rowKey="_id" loading={loading}
        pagination={dateFilter ? false : { current: page, total, pageSize: 20, onChange: p => setPage(p) }}
        scroll={{ x: 900 }}
      />

      {/* Assign Duty Modal */}
      <Modal title="Assign Duty" open={modal} onCancel={() => setModal(false)} onOk={() => form.submit()} destroyOnHidden>
        <Form form={form} onFinish={handleAssign} layout="vertical">
          <Form.Item name="facultyId" label="Faculty Member" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="children" placeholder="Select faculty">
              {faculty.map(f => (
                <Option key={f._id} value={f._id}>{f.name} ({f.employeeId})</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="dutyType" label="Duty Type" rules={[{ required: true }]}>
            <Select placeholder="Select duty type">
              {Object.entries(dutyTypeLabels).map(([k, v]) => (
                <Option key={k} value={k}>{v}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="shift" label="Shift" initialValue="full_day">
            <Select>
              {Object.entries(shiftLabels).map(([k, v]) => (
                <Option key={k} value={k}>{v}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="date" label="Date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="notes" label="Notes"><TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DutyAssignment;
