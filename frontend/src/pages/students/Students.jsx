import React, { useEffect, useState, useCallback } from 'react';
import {
  Table, Typography, Input, Select, Row, Col, App, Empty,
  Button, Modal, Form, DatePicker, Tag, Drawer, Tabs, Descriptions, Spin,
  Statistic, Card, List, Badge, Avatar,
} from 'antd';
import {
  SearchOutlined, PlusOutlined, EyeOutlined,
  DollarOutlined, CalendarOutlined, BookOutlined, UserOutlined,
} from '@ant-design/icons';
import { studentAPI, schoolAPI, feesAPI, attendanceAPI, examAPI } from '@/services/api';
import StatusTag from '@/components/common/StatusTag';
import FileUpload from '@/components/common/FileUpload';
import useAuthStore from '@/store/authStore';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const Students = () => {
  const { message } = App.useApp();
  const userRole = useAuthStore((s) => s.user?.role);
  // Accountant is read-only — cannot add/edit/delete students
  const canWrite = !['accountant'].includes(userRole);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [filters, setFilters] = useState({ search: '', classId: undefined });

  // ─── New Student Modal ────────────────────────────────────
  const [modal, setModal] = useState(false);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [modalClassId, setModalClassId] = useState(null);
  const [filteredSections, setFilteredSections] = useState([]);
  const [profileDrawer, setProfileDrawer] = useState({ open: false, student: null });

  // ─── Fetch students ───────────────────────────────────────
  const fetchStudents = useCallback(async (page = 1, pageSize = 20) => {
    setLoading(true);
    try {
      const params = { page, limit: pageSize };
      if (filters.search) params.search = filters.search;
      if (filters.classId) params.classId = filters.classId;

      const res = await studentAPI.getAll(params);

      // Backend returns: { success, data: [...], pagination: { total, page, limit } }
      // Axios wraps in res.data, so:
      //   res.data         = { success, data: [...], pagination: {...} }
      //   res.data.data    = the students array (primary path)
      //   res.data.students = legacy shape (fallback)
      const envelope = res?.data ?? {};
      const list =
        (Array.isArray(envelope?.data) ? envelope.data : null) ??
        (Array.isArray(envelope?.students) ? envelope.students : null) ??
        (Array.isArray(envelope) ? envelope : null) ??
        [];

      setStudents(list);

      const pag = envelope?.pagination ?? {};
      setPagination({
        current: pag.page ?? page,
        pageSize: pag.limit ?? pageSize,
        total: pag.total ?? list.length,
      });
    } catch (err) {
      message.error(err.message || 'Failed to load students');
    } finally {
      setLoading(false);
    }
  }, [filters, message]);


  // ─── Load classes + sections ──────────────────────────────
  useEffect(() => {
    schoolAPI.getClasses({ limit: 50 })
      .then((res) => {
        // ApiResponse.paginated: { success, data: [...], pagination }
        const envelope = res?.data ?? {};
        const list = Array.isArray(envelope?.data) ? envelope.data
          : Array.isArray(envelope) ? envelope
            : [];
        setClasses(list);
      });

    schoolAPI.getSections()
      .then((res) => {
        const envelope = res?.data ?? {};

        const list =
          Array.isArray(envelope?.data) ? envelope.data :
            Array.isArray(envelope) ? envelope :
              [];

        setSections(list);
      });
  }, []);
  useEffect(() => {
    fetchStudents(1, pagination.pageSize);
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── When class changes in modal, filter sections ─────────
  const handleModalClassChange = (classId) => {
    setModalClassId(classId);
    form.setFieldValue('sectionId', undefined);
    setFilteredSections(sections.filter((s) => s.classId === classId || s.classId?._id === classId || s.classId?.toString() === classId));
  };

  // ─── Create student ───────────────────────────────────────
  const onFinish = async (values) => {
    setSaving(true);
    try {
      const payload = {
        ...values,
        dateOfBirth: values.dateOfBirth?.toISOString(),
        ...(avatarUrl ? { avatar: avatarUrl } : {}),
      };
      await studentAPI.create(payload);
      message.success('Student created successfully');
      setModal(false);
      form.resetFields();
      setAvatarUrl(null);
      setModalClassId(null);
      setFilteredSections([]);
      fetchStudents(1, pagination.pageSize);
    } catch (err) {
      message.error(err.message || 'Failed to create student');
    } finally {
      setSaving(false);
    }
  };

  // ─── Table columns ────────────────────────────────────────
  const columns = [
    {
      title: '#', key: 'idx', width: 52, fixed: 'left',
      render: (_, __, idx) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {(pagination.current - 1) * pagination.pageSize + idx + 1}
        </Text>
      ),
    },
    {
      title: 'Student',
      key: 'name',
      width: 200,
      fixed: 'left',
      ellipsis: true,
      render: (_, s) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar
            size={32}
            src={s.avatar || s.photo || s.profilePhoto || null}
            style={{ background: 'var(--color-secondary)', flexShrink: 0, fontSize: 13, fontWeight: 600 }}
          >
            {(s.name || '—')[0].toUpperCase()}
          </Avatar>
          <div style={{ minWidth: 0 }}>
            <Text strong ellipsis style={{ display: 'block', maxWidth: 140 }}>{s.name || '—'}</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {s.admissionNo || s.admissionNumber || s.rollNo || '—'}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Admission No',
      key: 'admissionNo',
      width: 130,
      render: (_, s) => s.admissionNo || s.admissionNumber || '—',
    },
    {
      title: 'Register No',
      key: 'registerNo',
      width: 130,
      render: (_, s) => s.registerNo || s.rollNo || '—',
    },
    {
      title: 'Class',
      key: 'class',
      width: 110,
      ellipsis: true,
      render: (_, s) => s.classId?.name || s.className || '—',
    },
    {
      title: 'Section',
      key: 'section',
      width: 90,
      ellipsis: true,
      render: (_, s) => s.sectionId?.name || s.sectionName || '—',
    },
    {
      title: 'Parent',
      key: 'parent',
      width: 160,
      ellipsis: true,
      render: (_, s) => (
        <div>
          <Text ellipsis style={{ display: 'block', maxWidth: 150 }}>{s.parentName || '—'}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{s.parentPhone || ''}</Text>
        </div>
      ),
    },
    {
      title: 'Status', dataIndex: 'isActive', key: 'status', width: 90,
      render: (isActive) => <StatusTag status={isActive !== false ? 'active' : 'inactive'} />,
    },
    {
      title: 'Actions', key: 'actions', width: 90, fixed: 'right',
      render: (_, record) => (
        <Button
          size="small"
          icon={<EyeOutlined />}
          onClick={() => setProfileDrawer({ open: true, student: record })}
          id={`view-profile-${record._id}`}
        >
          Profile
        </Button>
      ),
    },
  ];

  const handleTableChange = (pag) => fetchStudents(pag.current, pag.pageSize);

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Title level={4} className="page-title" style={{ margin: 0 }}>Students</Title>
          <Text type="secondary">Manage enrolled students</Text>
        </div>
        {canWrite && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModal(true)} id="new-student-btn">
            New Student
          </Button>
        )}
      </div>

      {/* Filters */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={8}>
          <Input
            placeholder="Search by name or roll no..."
            prefix={<SearchOutlined style={{ color: '#94A3B8' }} />}
            allowClear
            value={filters.search}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            id="student-search"
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Select
            placeholder="Filter by class"
            allowClear
            style={{ width: '100%' }}
            value={filters.classId}
            onChange={(val) => setFilters((prev) => ({ ...prev, classId: val }))}
            options={classes.map((c) => ({ label: c.name, value: c._id }))}
            id="student-class-filter"
          />
        </Col>
      </Row>

      {/* Table */}
      <Table
        columns={columns}
        dataSource={students}
        rowKey="_id"
        loading={loading}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          showTotal: (total) => `Total ${total} students`,
        }}
        onChange={handleTableChange}
        scroll={{ x: 1100 }}
        sticky
        size="middle"
        bordered={false}
        style={{ background: '#FFF', borderRadius: 8 }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No students found" /> }}
      />

      {/* New Student Modal — write roles only */}
      {canWrite && (
        <Modal
          title="Add New Student"
          open={modal}
          onCancel={() => { setModal(false); form.resetFields(); setAvatarUrl(null); setModalClassId(null); setFilteredSections([]); }}
          footer={null}
          width={560}
          destroyOnHidden
        >
          <Form form={form} layout="vertical" onFinish={onFinish} style={{ marginTop: 16 }}>
            {/* Profile photo */}
            <Form.Item label="Profile Photo">
              <FileUpload
                folder="students"
                accept="image/*"
                value={avatarUrl}
                onChange={setAvatarUrl}
                onUploading={setUploading}
                label="Upload Photo"
              />
            </Form.Item>
            <Row gutter={12}>
              <Col span={14}>
                <Form.Item label="Full Name" name="name" rules={[{ required: true }]}>
                  <Input placeholder="Student full name" />
                </Form.Item>
              </Col>
              <Col span={10}>
                <Form.Item label="Gender" name="gender" rules={[{ required: true }]}>
                  <Select>
                    <Select.Option value="male">Male</Select.Option>
                    <Select.Option value="female">Female</Select.Option>
                    <Select.Option value="other">Other</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={12}>
              <Col span={12}>
                <Form.Item label="Date of Birth" name="dateOfBirth" rules={[{ required: true }]}>
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Blood Group" name="bloodGroup">
                  <Input placeholder="e.g. A+" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={12}>
              <Col span={12}>
                <Form.Item label="Admission No" name="admissionNo">
                  <Input placeholder="Optional; auto if empty" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Register No" name="registerNo">
                  <Input placeholder="Optional; auto if empty" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={12}>
              <Col span={12}>
                <Form.Item label="Class" name="classId" rules={[{ required: true }]}>
                  <Select
                    placeholder="Select class"
                    onChange={handleModalClassChange}
                    options={classes.map((c) => ({ label: c.name, value: c._id }))}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Section" name="sectionId">
                  <Select
                    placeholder="Select section"
                    allowClear
                    disabled={!modalClassId}
                    options={filteredSections.map((s) => ({ label: s.name, value: s._id }))}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item label="Parent / Guardian Name" name="parentName" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item label="Parent Phone" name="parentPhone" rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Parent Email" name="parentEmail" rules={[{ type: 'email', message: 'Invalid email' }]}>
                  <Input />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item label="Address" name="address">
              <Input.TextArea rows={2} />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" htmlType="submit" loading={saving} disabled={uploading} block>
                {uploading ? 'Uploading...' : 'Create Student'}
              </Button>
            </Form.Item>
          </Form>
        </Modal>
      )} {/* end canWrite */}

      {/* Student Profile Drawer */}
      <StudentProfileDrawer
        student={profileDrawer.student}
        open={profileDrawer.open}
        onClose={() => setProfileDrawer({ open: false, student: null })}
      />
    </div>
  );
};

// ─── Student Profile Drawer (tabbed) ──────────────────────────
const StudentProfileDrawer = ({ student, open, onClose }) => {
  const [feeData, setFeeData] = useState(null);
  const [attendData, setAttendData] = useState(null);
  const [examData, setExamData] = useState(null);
  const [loading, setLoading] = useState({});

  const load = async (key, fn, setter) => {
    setLoading((p) => ({ ...p, [key]: true }));
    try {
      const res = await fn();
      setter(res?.data || res);
    } catch (e) {
      console.error(key, e);
      setter(null);
    } finally {
      setLoading((p) => ({ ...p, [key]: false }));
    }
  };

  useEffect(() => {
    if (!open || !student) return;

    load('fees', () => feesAPI.getStudentFees(student._id), setFeeData);
    load('attend', () => attendanceAPI.getReport({
      classId: student.classId?._id || student.classId,
      studentId: student._id,
    }), setAttendData);
    load('exams', () => examAPI.getStudentResults(student._id), setExamData);

  }, [open, student]);

  if (!student) return null;
  // FEES
  const feeSummary = feeData?.summary || feeData?.data?.summary || {};
  const feePayments = feeData?.payments || feeData?.data?.payments || [];

  // ATTENDANCE
  const body = attendData?.data || {};

  const row = Array.isArray(body.report) ? body.report[0] : null;

  const attendStats = row
    ? {
      total: row.totalDays ?? 0,
      present: row.totalPresent ?? 0,
      absent: row.totalAbsent ?? 0,
      percentage: row.percentage ?? 0,
    }
    : {
      total: 0,
      present: 0,
      absent: 0,
      percentage: 0,
    };

  // EXAMS
  const examList = Array.isArray(examData)
    ? examData
    : examData?.results || [];

  const tabs = [
    {
      key: 'overview',
      label: <><UserOutlined /> Overview</>,
      children: (
        <>
          {/* Avatar */}
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            {(student.avatar || student.photo || student.profilePhoto) ? (
              <img
                src={student.avatar || student.photo || student.profilePhoto}
                alt={student.name}
                style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid #E2E8F0' }}
              />
            ) : (
              <Avatar size={80} icon={<UserOutlined />} style={{ background: 'var(--color-primary-dark)', fontSize: 32 }} />
            )}
            <div style={{ marginTop: 6, fontWeight: 600 }}>{student.name}</div>
          </div>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Admission No">{student.admissionNo || student.admissionNumber || '—'}</Descriptions.Item>
            <Descriptions.Item label="Register No">{student.registerNo || '—'}</Descriptions.Item>
            <Descriptions.Item label="Roll No">{student.rollNo || '—'}</Descriptions.Item>
            <Descriptions.Item label="Class">{student.classId?.name || '—'}</Descriptions.Item>
            <Descriptions.Item label="Section">{student.sectionId?.name || '—'}</Descriptions.Item>
            <Descriptions.Item label="Gender">{student.gender || '—'}</Descriptions.Item>
            <Descriptions.Item label="Date of Birth">
              {student.dateOfBirth ? dayjs(student.dateOfBirth).format('DD MMM YYYY') : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Parent">{student.parentName || '—'}</Descriptions.Item>
            <Descriptions.Item label="Parent Phone">{student.parentPhone || '—'}</Descriptions.Item>
            <Descriptions.Item label="Blood Group">{student.bloodGroup || '—'}</Descriptions.Item>
          </Descriptions>
        </>
      ),
    },
    {
      key: 'fees',
      label: <><DollarOutlined /> Fees</>,
      children: loading.fees ? <Spin /> : feeData ? (
        <>
          <Row gutter={12} style={{ marginBottom: 16 }}>
            {[
              { label: 'Total Fee', value: `₹${(feeSummary?.totalFee || 0).toLocaleString('en-IN')}`, color: 'var(--color-primary-dark)' },
              { label: 'Paid', value: `₹${(feeSummary?.totalPaid || 0).toLocaleString('en-IN')}`, color: '#22C55E' },
              { label: 'Due', value: `₹${(feeSummary?.totalDue || 0).toLocaleString('en-IN')}`, color: '#EF4444' },
            ].map((s) => (
              <Col key={s.label} span={8}>
                <Card size="small" bordered={false} style={{ background: '#F8FAFC', borderRadius: 8 }}>
                  <Statistic title={<span style={{ fontSize: 11 }}>{s.label}</span>} value={s.value}
                    valueStyle={{ fontSize: 14, fontWeight: 700, color: s.color }} />
                </Card>
              </Col>
            ))}
          </Row>
          <List
            size="small"
            dataSource={feePayments || []}
            renderItem={(p) => (
              <List.Item>
                <span style={{ fontWeight: 500 }}>{p.receiptNumber}</span>
                <span style={{ color: '#22C55E', marginLeft: 'auto' }}>₹{p.amount}</span>
                <Tag style={{ marginLeft: 8 }}>{p.paymentMode}</Tag>
              </List.Item>
            )}
            locale={{ emptyDescription: 'No payments yet' }}
          />
        </>
      ) : <Empty description="Fee data unavailable" />,
    },
    {
      key: 'attendance',
      label: <><CalendarOutlined /> Attendance</>,
      children: loading.attend ? <Spin /> : Object.keys(attendStats).length ? (
        <Row gutter={12}>
          {[
            { label: 'Total Days', value: attendStats.total || 0, color: 'var(--color-primary-dark)' },
            { label: 'Present', value: attendStats.present || 0, color: '#22C55E' },
            { label: 'Absent', value: attendStats.absent || 0, color: '#EF4444' },
            { label: 'Avg %', value: `${attendStats.percentage || 0}%`, color: 'var(--color-secondary)' },
          ].map((s) => (
            <Col key={s.label} span={12} style={{ marginBottom: 8 }}>
              <Card size="small" bordered={false} style={{ background: '#F8FAFC', borderRadius: 8 }}>
                <Statistic
                  title={<span style={{ fontSize: 11 }}>{s.label}</span>}
                  value={s.value}
                  valueStyle={{ fontSize: 16, fontWeight: 700, color: s.color }}
                />
              </Card>
            </Col>
          ))}
        </Row>
      ) : <Empty description="Attendance data unavailable" />
    },
    {
      key: 'exams',
      label: <><BookOutlined /> Exams</>,

      children: loading.exams ? <Spin /> : examList.length ? (
        <List
          size="small"
          dataSource={examList}
          renderItem={(r) => (
            <List.Item>
              <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600 }}>
                    {r.exam?.examName || r.exam?.name || 'Exam'}
                  </span>

                  <Badge
                    status={r.result === 'Pass' ? 'success' : 'error'}
                    text={
                      <span
                        style={{
                          fontWeight: 600,
                          color: r.result === 'Pass' ? '#22C55E' : '#EF4444'
                        }}
                      >
                        {r.result}
                      </span>
                    }
                  />
                </div>

                <span style={{ fontSize: 11, color: '#64748B' }}>
                  Total: {r.totalObtained || r.total || 0} | Grade: {r.grade || '—'}
                </span>
              </div>
            </List.Item>
          )}
        />
      ) : <Empty description="No exam results yet" />,
    },
  ];

  return (
    <Drawer
      title={<><UserOutlined /> {student.name}</>}
      open={open}
      onClose={onClose}
      width={500}
    >
      <Tabs items={tabs} defaultActiveKey="overview" />
    </Drawer>
  );
};

export default Students;
