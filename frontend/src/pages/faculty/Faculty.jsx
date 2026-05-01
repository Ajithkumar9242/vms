import React, { useEffect, useState, useCallback } from 'react';
import {
  Table, Typography, Button, Space, App, Empty, Modal, Form,
  Input, Select, Row, Col, Tag,
} from 'antd';
import { PlusOutlined, TeamOutlined } from '@ant-design/icons';
import { facultyAPI, schoolAPI } from '@/services/api';

const { Title, Text } = Typography;

const Faculty = () => {
  const { message } = App.useApp();
  const [faculty, setFaculty] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const [createForm] = Form.useForm();
  const [assignForm] = Form.useForm();

  const fetchFaculty = useCallback(async () => {
    setLoading(true);
    try {
      const res = await facultyAPI.getAll({ page, limit: 20 });
      setFaculty(res.data.faculty);
      setTotal(res.data.total);
    } catch (err) {
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, message]);

  const fetchMeta = useCallback(async () => {
    try {
      const [clsRes, subRes] = await Promise.all([
        schoolAPI.getClasses({ limit: 50 }),
        schoolAPI.getSubjects({ limit: 50 }),
      ]);
      setClasses(clsRes.data || []);
      setSubjects(subRes.data || []);
    } catch {}
  }, []);

  useEffect(() => { fetchFaculty(); }, [fetchFaculty]);
  useEffect(() => { fetchMeta(); }, [fetchMeta]);

  const handleCreate = async (values) => {
    try {
      await facultyAPI.create(values);
      message.success('Faculty created successfully');
      setCreateOpen(false);
      createForm.resetFields();
      fetchFaculty();
    } catch (err) {
      message.error(err.message);
    }
  };

  const handleAssignClasses = async (values) => {
    try {
      await facultyAPI.assignClasses(selectedFaculty._id, values.classIds);
      message.success('Classes assigned successfully');
      setAssignOpen(false);
      assignForm.resetFields();
      fetchFaculty();
    } catch (err) {
      message.error(err.message);
    }
  };

  const columns = [
    { title: 'Employee ID', dataIndex: 'employeeId', key: 'employeeId', width: 130 },
    { title: 'Name', dataIndex: 'name', key: 'name', width: 180 },
    { title: 'Email', dataIndex: 'email', key: 'email', width: 200 },
    { title: 'Designation', dataIndex: 'designation', key: 'designation', width: 140 },
    {
      title: 'Subjects',
      dataIndex: 'subjects',
      key: 'subjects',
      width: 200,
      render: (subs) => subs?.map((s) => (
        <Tag key={s._id} color="blue" style={{ marginBottom: 2 }}>{s.name}</Tag>
      )) || '—',
    },
    {
      title: 'Classes',
      dataIndex: 'assignedClasses',
      key: 'assignedClasses',
      width: 200,
      render: (cls) => cls?.map((c) => (
        <Tag key={c._id} color="green" style={{ marginBottom: 2 }}>{c.name}</Tag>
      )) || '—',
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (v) => <Tag color={v ? 'green' : 'red'}>{v ? 'Active' : 'Inactive'}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 140,
      render: (_, record) => (
        <Button
          size="small"
          icon={<TeamOutlined />}
          onClick={() => {
            setSelectedFaculty(record);
            assignForm.setFieldsValue({ classIds: record.assignedClasses?.map((c) => c._id) || [] });
            setAssignOpen(true);
          }}
        >
          Assign
        </Button>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={3} className="page-title" style={{ margin: 0 }}>Faculty</Title>
          <Text className="page-subtitle">Manage faculty members and assignments</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)} id="create-faculty-btn">
          Add Faculty
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={faculty}
        rowKey="_id"
        loading={loading}
        pagination={{ current: page, total, pageSize: 20, onChange: setPage, showTotal: (t) => `Total ${t} faculty` }}
        scroll={{ x: 1100 }}
        size="middle"
        style={{ background: '#FFF', borderRadius: 8 }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No faculty found" /> }}
      />

      {/* Create Faculty Modal */}
      <Modal
        title="Add New Faculty"
        open={createOpen}
        onCancel={() => { setCreateOpen(false); createForm.resetFields(); }}
        onOk={() => createForm.submit()}
        okText="Create"
        destroyOnHidden
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="Full Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input placeholder="Enter faculty name" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="email" label="Email">
                <Input placeholder="email@school.com" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone" label="Phone">
                <Input placeholder="Phone number" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="designation" label="Designation">
                <Input placeholder="e.g. Professor" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="department" label="Department">
                <Input placeholder="e.g. Science" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="subjects" label="Subjects">
            <Select
              mode="multiple"
              placeholder="Select subjects"
              options={subjects.map((s) => ({ label: s.name, value: s._id }))}
              allowClear
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Assign Classes Modal */}
      <Modal
        title={`Assign Classes — ${selectedFaculty?.name || ''}`}
        open={assignOpen}
        onCancel={() => { setAssignOpen(false); assignForm.resetFields(); }}
        onOk={() => assignForm.submit()}
        okText="Save"
        destroyOnHidden
      >
        <Form form={assignForm} layout="vertical" onFinish={handleAssignClasses}>
          <Form.Item name="classIds" label="Assigned Classes">
            <Select
              mode="multiple"
              placeholder="Select classes"
              options={classes.map((c) => ({ label: c.name, value: c._id }))}
              allowClear
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Faculty;
