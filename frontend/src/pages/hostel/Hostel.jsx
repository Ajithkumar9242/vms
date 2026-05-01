import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, Tag, message, Card, Row, Col, Progress } from 'antd';
import { PlusOutlined, HomeOutlined, DeleteOutlined } from '@ant-design/icons';
import { hostelAPI, studentAPI } from '@/services/api';

const { Option } = Select;

const Hostel = () => {
  const [rooms, setRooms] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [roomModal, setRoomModal] = useState(false);
  const [assignModal, setAssignModal] = useState(false);
  const [roomForm] = Form.useForm();
  const [assignForm] = Form.useForm();

  const fetchRooms = async () => {
    setLoading(true);
    try {
      const res = await hostelAPI.getOccupancy();
      setRooms(res.data || []);
    } catch (e) { message.error(e.message); }
    setLoading(false);
  };

  const fetchStudents = async () => {
    try {
      const res = await studentAPI.getAll({ limit: 200 });
      setStudents(res.data || []);
    } catch {}
  };

  useEffect(() => { fetchRooms(); fetchStudents(); }, []);

  const handleCreateRoom = async (values) => {
    try {
      await hostelAPI.createRoom(values);
      message.success('Room created');
      roomForm.resetFields();
      setRoomModal(false);
      fetchRooms();
    } catch (e) { message.error(e.message); }
  };

  const handleAssign = async (values) => {
    try {
      await hostelAPI.assignStudent(values);
      message.success('Student assigned');
      assignForm.resetFields();
      setAssignModal(false);
      fetchRooms();
    } catch (e) { message.error(e.message); }
  };

  const handleRemove = async (studentId) => {
    try {
      await hostelAPI.removeStudent(studentId);
      message.success('Student removed');
      fetchRooms();
    } catch (e) { message.error(e.message); }
  };

  const columns = [
    { title: 'Room No', dataIndex: 'roomNumber', key: 'roomNumber', width: 100 },
    { title: 'Type', dataIndex: 'type', key: 'type', render: t => <Tag color={t === 'boys' ? 'blue' : 'pink'}>{t}</Tag> },
    { title: 'Capacity', dataIndex: 'capacity', key: 'capacity', width: 80 },
    { title: 'Occupied', dataIndex: 'occupiedBeds', key: 'occupiedBeds', width: 80 },
    {
      title: 'Occupancy', key: 'occ', width: 150,
      render: (_, r) => <Progress percent={Math.round((r.occupiedBeds / r.capacity) * 100)} size="small"
        status={r.occupiedBeds >= r.capacity ? 'exception' : 'active'} />,
    },
    {
      title: 'Students', key: 'students',
      render: (_, r) => (r.allocations || []).map(a => (
        <Tag key={a._id} closable onClose={() => handleRemove(a.studentId?._id)}>
          Bed {a.bedNumber}: {a.studentId?.name || 'N/A'}
        </Tag>
      )),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}><HomeOutlined /> Hostel Management</h2>
          <p style={{ color: '#888', margin: 0 }}>Manage rooms and student allocations</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button icon={<PlusOutlined />} onClick={() => setRoomModal(true)}>Add Room</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setAssignModal(true)}>Assign Student</Button>
        </div>
      </div>

      {/* Summary Cards */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small"><b>Total Rooms</b><div style={{ fontSize: 24 }}>{rooms.length}</div></Card>
        </Col>
        <Col span={6}>
          <Card size="small"><b>Total Beds</b><div style={{ fontSize: 24 }}>{rooms.reduce((s, r) => s + r.capacity, 0)}</div></Card>
        </Col>
        <Col span={6}>
          <Card size="small"><b>Occupied</b><div style={{ fontSize: 24 }}>{rooms.reduce((s, r) => s + r.occupiedBeds, 0)}</div></Card>
        </Col>
        <Col span={6}>
          <Card size="small"><b>Available</b><div style={{ fontSize: 24, color: '#52c41a' }}>{rooms.reduce((s, r) => s + (r.capacity - r.occupiedBeds), 0)}</div></Card>
        </Col>
      </Row>

      <Table columns={columns} dataSource={rooms} rowKey="_id" loading={loading} pagination={false} />

      {/* Create Room Modal */}
      <Modal title="Add Room" open={roomModal} onCancel={() => setRoomModal(false)} onOk={() => roomForm.submit()} destroyOnHidden>
        <Form form={roomForm} onFinish={handleCreateRoom} layout="vertical">
          <Form.Item name="roomNumber" label="Room Number" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="capacity" label="Capacity" rules={[{ required: true }]}><InputNumber min={1} max={20} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="type" label="Type" rules={[{ required: true }]}>
            <Select><Option value="boys">Boys</Option><Option value="girls">Girls</Option></Select>
          </Form.Item>
          <Form.Item name="floor" label="Floor"><Input /></Form.Item>
        </Form>
      </Modal>

      {/* Assign Student Modal */}
      <Modal title="Assign Student" open={assignModal} onCancel={() => setAssignModal(false)} onOk={() => assignForm.submit()} destroyOnHidden>
        <Form form={assignForm} onFinish={handleAssign} layout="vertical">
          <Form.Item name="studentId" label="Student" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="children" placeholder="Select student">
              {students.map(s => <Option key={s._id} value={s._id}>{s.name} ({s.rollNo})</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="roomId" label="Room" rules={[{ required: true }]}>
            <Select placeholder="Select room">
              {rooms.filter(r => r.occupiedBeds < r.capacity).map(r => (
                <Option key={r._id} value={r._id}>{r.roomNumber} ({r.type}) — {r.capacity - r.occupiedBeds} free</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="bedNumber" label="Bed Number" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Hostel;
