import React, { useEffect, useState, useCallback } from 'react';
import {
  Table, Typography, Input, Select, Row, Col, App, Empty,
  Button, Modal, Form, DatePicker, Tag, Drawer, Tabs, Descriptions, Spin,
  Statistic, Card, List, Badge, Avatar,
  Divider,
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

// ─── normalizeUrl helper ─────────────────────────────────────
const normalizeUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  const baseUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
  return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
};

// ─── Student Profile Drawer (tabbed) ──────────────────────────
const StudentProfileDrawer = ({ student, open, onClose }) => {
  const [profileData, setProfileData] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    if (!open || !student) return;
    setProfileData(null);
    setProfileLoading(true);
    studentAPI.getProfile(student._id)
      .then(res => {
        const d = res?.data?.data || res?.data || {};
        setProfileData(d);
      })
      .catch(e => console.error('[Profile]', e))
      .finally(() => setProfileLoading(false));
  }, [open, student]);

  if (!student) return null;

  const displayStudent = profileData?.student || student;
  const admission     = profileData?.admission || {};
  const fees          = profileData?.fees || {};
  const feeSummary    = fees.summary || {};
  const installments  = fees.installments || [];
  const payments      = fees.payments || [];
  const attendance    = profileData?.attendance || {};
  const attSummary    = attendance.summary || {};
  const monthly       = attendance.monthly || [];
  const exams         = profileData?.exams || {};
  const examResults   = exams.results || [];

  const STATUS_COLOR = { Paid: 'green', paid: 'green', Partial: 'orange', partial: 'orange', Overdue: 'red', overdue: 'red', unpaid: 'default', Pending: 'default' };
  const INST_STATUS_COLOR = { paid: 'green', partial: 'orange', overdue: 'red', pending: 'default' };

  const tabs = [
    {
      key: 'overview',
      label: <><UserOutlined /> Overview</>,
      children: (
        <>
          {/* Avatar */}
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            {(displayStudent.avatar || displayStudent.photo || displayStudent.profilePhoto || admission?.studentPhoto) ? (
              <img
                src={normalizeUrl(displayStudent.avatar || displayStudent.photo || displayStudent.profilePhoto || admission?.studentPhoto)}
                alt={displayStudent.name}
                style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid #E2E8F0' }}
              />
            ) : (
              <Avatar size={80} icon={<UserOutlined />} style={{ background: 'var(--color-primary-dark)', fontSize: 32 }} />
            )}
            <div style={{ marginTop: 6, fontWeight: 600 }}>{displayStudent.name}</div>
          </div>
          <Divider style={{ margin: '8px 0' }}>Academic & Admission</Divider>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Admission No">{displayStudent.admissionNo || displayStudent.admissionNumber || admission?.admissionNo || '—'}</Descriptions.Item>
            <Descriptions.Item label="Roll No">{displayStudent.rollNo || admission?.rollNo || '—'}</Descriptions.Item>
            <Descriptions.Item label="Class">{displayStudent.classId?.name || '—'}</Descriptions.Item>
            <Descriptions.Item label="Section">{displayStudent.sectionId?.name || '—'}</Descriptions.Item>
            <Descriptions.Item label="Boarding Mode">{admission?.boardingType || admission?.mode || '—'}</Descriptions.Item>
            <Descriptions.Item label="Second Lang">{admission?.secondLanguage || '—'}</Descriptions.Item>
          </Descriptions>

          <Divider style={{ margin: '8px 0' }}>Student Details</Divider>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Gender">{displayStudent.gender || '—'}</Descriptions.Item>
            <Descriptions.Item label="Date of Birth">
              {displayStudent.dateOfBirth ? dayjs(displayStudent.dateOfBirth).format('DD MMM YYYY') : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Place of Birth">{admission?.placeOfBirth || '—'}</Descriptions.Item>
            <Descriptions.Item label="Nationality">{admission?.nationality || '—'}</Descriptions.Item>
            <Descriptions.Item label="Religion / Caste">{[admission?.religion, admission?.caste].filter(Boolean).join(' / ') || '—'}</Descriptions.Item>
            <Descriptions.Item label="Category">{admission?.category || '—'}</Descriptions.Item>
            <Descriptions.Item label="Mother Tongue">{admission?.motherTongue || '—'}</Descriptions.Item>
            <Descriptions.Item label="Aadhaar">{admission?.aadhaarNo || '—'}</Descriptions.Item>
          </Descriptions>

          <Divider style={{ margin: '8px 0' }}>Parent / Guardian</Divider>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Primary Name">{displayStudent.parentName || '—'}</Descriptions.Item>
            <Descriptions.Item label="Primary Phone">{displayStudent.parentPhone || '—'}</Descriptions.Item>
            <Descriptions.Item label="Father">{admission?.father?.name || '—'}</Descriptions.Item>
            <Descriptions.Item label="Mother">{admission?.mother?.name || '—'}</Descriptions.Item>
          </Descriptions>

          {admission?.previousSchool && (
            <>
              <Divider style={{ margin: '8px 0' }}>Previous School</Divider>
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="School Name">{admission.previousSchool}</Descriptions.Item>
                <Descriptions.Item label="Board">{admission.previousBoard || '—'}</Descriptions.Item>
                <Descriptions.Item label="TC No">{admission.tcNumber || '—'}</Descriptions.Item>
                <Descriptions.Item label="SATS / PEN">{[admission.satsNumber, admission.penNumber].filter(Boolean).join(' / ') || '—'}</Descriptions.Item>
              </Descriptions>
            </>
          )}

          <Divider style={{ margin: '8px 0' }}>Medical</Divider>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Blood Group">{admission?.bloodGroup || displayStudent.bloodGroup || '—'}</Descriptions.Item>
            <Descriptions.Item label="Allergies">{admission?.allergies || '—'}</Descriptions.Item>
            <Descriptions.Item label="SEN">{admission?.senType ? `${admission.senType} (${admission.senSupportLevel})` : '—'}</Descriptions.Item>
          </Descriptions>
        </>
      ),
    },
    // ─── FEES TAB ─────────────────────────────────────────────
    {
      key: 'fees',
      label: <><DollarOutlined /> Fees</>,
      children: profileLoading ? <div style={{ textAlign: 'center', padding: 32 }}><Spin /></div> : profileData ? (
        <>
          {/* Summary Cards */}
          <Row gutter={12} style={{ marginBottom: 16 }}>
            {[
              { label: 'Total Fee',  value: feeSummary.totalFee  || feeSummary.netFee   || 0, color: 'var(--color-primary-dark)' },
              { label: 'Paid',       value: feeSummary.totalPaid || feeSummary.paidAmount || 0, color: '#22C55E' },
              { label: 'Due',        value: feeSummary.totalDue  || feeSummary.dueAmount  || 0, color: '#EF4444' },
            ].map(s => (
              <Col key={s.label} span={8}>
                <Card size="small" bordered={false} style={{ background: '#F8FAFC', borderRadius: 8 }}>
                  <Statistic
                    title={<span style={{ fontSize: 11 }}>{s.label}</span>}
                    value={`₹${Number(s.value).toLocaleString('en-IN')}`}
                    valueStyle={{ fontSize: 13, fontWeight: 700, color: s.color }}
                  />
                </Card>
              </Col>
            ))}
          </Row>

          {/* Invoice meta */}
          {fees.invoice && (
            <div style={{ padding: '8px 12px', background: '#F1F5F9', borderRadius: 8, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>Invoice #{fees.invoice.invoiceNumber}</Text>
                <Tag color={STATUS_COLOR[fees.invoice.status] || 'default'}>
                  {(fees.invoice.status || 'N/A').toUpperCase()}
                </Tag>
              </div>
              {fees.invoice.nextDueDate && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Next Due:</Text>
                  <Text strong style={{ fontSize: 12 }}>{dayjs(fees.invoice.nextDueDate).format('DD MMM YYYY')}</Text>
                </div>
              )}
              {(feeSummary.penaltyAmount > 0) && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Penalty:</Text>
                  <Text strong style={{ fontSize: 12, color: '#EF4444' }}>₹{feeSummary.penaltyAmount.toLocaleString('en-IN')}</Text>
                </div>
              )}
            </div>
          )}

          {/* Payment Schedule */}
          {installments.length > 0 && (
            <>
              <Divider style={{ margin: '8px 0', fontSize: 12 }}>Payment Schedule</Divider>
              {installments.map((inst, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #F1F5F9' }}>
                  <div>
                    <Text style={{ fontSize: 12, fontWeight: 500 }}>{inst.label || `Installment ${inst.installmentNo || i + 1}`}</Text>
                    {inst.dueDate && <div style={{ fontSize: 11, color: '#94A3B8' }}>{dayjs(inst.dueDate).format('DD MMM YYYY')}</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12 }}>₹{(inst.amount || 0).toLocaleString('en-IN')}</div>
                    <Tag color={INST_STATUS_COLOR[inst.status] || 'default'} style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px' }}>
                      {(inst.status || 'pending').toUpperCase()}
                    </Tag>
                    {inst.balanceAmount > 0 && inst.status !== 'paid' && (
                      <div style={{ fontSize: 10, color: '#EF4444' }}>Due: ₹{inst.balanceAmount.toLocaleString('en-IN')}</div>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Payments / Receipts */}
          {payments.length > 0 ? (
            <>
              <Divider style={{ margin: '8px 0', fontSize: 12 }}>Payment Receipts</Divider>
              <List
                size="small"
                dataSource={payments}
                renderItem={p => (
                  <List.Item>
                    <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <Text style={{ fontSize: 12, fontWeight: 500 }}>#{p.receiptNumber}</Text>
                        <div style={{ fontSize: 11, color: '#64748B' }}>{p.paidAt ? dayjs(p.paidAt).format('DD MMM YYYY') : '—'} · {p.paymentMode || '—'}</div>
                      </div>
                      <Text strong style={{ color: '#22C55E', fontSize: 13 }}>₹{(p.amount || 0).toLocaleString('en-IN')}</Text>
                    </div>
                  </List.Item>
                )}
                locale={{ emptyDescription: 'No payments yet' }}
              />
            </>
          ) : fees.invoice ? (
            <Empty description="No payments recorded yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <Empty description="No fee invoice generated" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </>
      ) : <Empty description="Fee data unavailable" />,
    },
    // ─── ATTENDANCE TAB ───────────────────────────────────────
    {
      key: 'attendance',
      label: <><CalendarOutlined /> Attendance</>,
      children: profileLoading ? <div style={{ textAlign: 'center', padding: 32 }}><Spin /></div> : (
        <>
          <Row gutter={12} style={{ marginBottom: 12 }}>
            {[
              { label: 'Conducted', value: attSummary.totalConducted || 0, color: 'var(--color-primary-dark)' },
              { label: 'Attended',  value: attSummary.totalAttended  || 0, color: '#22C55E' },
              { label: 'Absent',    value: attSummary.totalAbsent    || 0, color: '#EF4444' },
              { label: 'Attendance %', value: `${attSummary.percentage || 0}%`, color: attSummary.percentage >= 75 ? '#22C55E' : '#EF4444' },
            ].map(s => (
              <Col key={s.label} span={12} style={{ marginBottom: 8 }}>
                <Card size="small" bordered={false} style={{ background: '#F8FAFC', borderRadius: 8 }}>
                  <Statistic
                    title={<span style={{ fontSize: 11 }}>{s.label}</span>}
                    value={s.value}
                    valueStyle={{ fontSize: 15, fontWeight: 700, color: s.color }}
                  />
                </Card>
              </Col>
            ))}
          </Row>

          {/* Monthly breakdown */}
          {monthly.length > 0 && (
            <>
              <Divider style={{ margin: '8px 0', fontSize: 12 }}>Monthly Breakdown</Divider>
              {monthly.map((m, i) => {
                const pct = m.conducted > 0 ? Math.round((m.attended / m.conducted) * 100) : 0;
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid #F8FAFC' }}>
                    <Text style={{ fontSize: 12 }}>{m.monthKey}</Text>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Text style={{ fontSize: 11, color: '#64748B' }}>{m.attended}/{m.conducted}</Text>
                      <Tag color={pct >= 75 ? 'green' : pct >= 50 ? 'orange' : 'red'} style={{ fontSize: 10, padding: '0 4px', margin: 0 }}>
                        {pct}%
                      </Tag>
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {!attSummary.totalConducted && !profileLoading && (
            <Empty description="No attendance records found" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </>
      ),
    },
    // ─── EXAMS TAB (marks-card style) ────────────────────────
    {
      key: 'exams',
      label: <><BookOutlined /> Exams</>,
      children: profileLoading ? <div style={{ textAlign: 'center', padding: 32 }}><Spin /></div> : examResults.length ? (
        <>
          {exams.marksCard?.overall && (
            <div style={{ background: '#FFF7ED', border: '1px solid #FFEDD5', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <Text style={{ fontSize: 11, color: '#9A3412' }}>Overall Performance</Text>
              <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                <Statistic title={<span style={{ fontSize: 10 }}>Total</span>}
                  value={`${exams.marksCard.overall.totalObtained}/${exams.marksCard.overall.totalMax}`}
                  valueStyle={{ fontSize: 14, fontWeight: 700, color: '#EA580C' }} />
                <Statistic title={<span style={{ fontSize: 10 }}>Overall %</span>}
                  value={`${exams.marksCard.overall.percentage}%`}
                  valueStyle={{ fontSize: 14, fontWeight: 700, color: '#EA580C' }} />
              </div>
            </div>
          )}
          {examResults.map((r, idx) => {
            const resultColor = r.result === 'Pass' ? '#22C55E' : r.result === 'Fail' ? '#EF4444' : '#64748B';
            return (
              <Card
                key={idx}
                size="small"
                style={{ marginBottom: 10, borderRadius: 8 }}
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, fontWeight: 600 }}>{r.exam?.examName || r.exam?.name || 'Exam'}</Text>
                    <span style={{ display: 'flex', gap: 6 }}>
                      <Tag style={{ fontWeight: 600, margin: 0 }}>{r.grade || '—'}</Tag>
                      <Tag color={resultColor === '#22C55E' ? 'green' : resultColor === '#EF4444' ? 'red' : 'default'} style={{ margin: 0 }}>
                        {r.result}
                      </Tag>
                    </span>
                  </div>
                }
              >
                <div style={{ display: 'flex', gap: 16, marginBottom: r.subjects?.length ? 8 : 0 }}>
                  <Text style={{ fontSize: 12, color: '#64748B' }}>
                    Total: <strong style={{ color: '#1E293B' }}>{r.totalObtained}/{r.totalMax}</strong>
                  </Text>
                  <Text style={{ fontSize: 12, color: '#64748B' }}>
                    Score: <strong style={{ color: '#1E293B' }}>{r.percentage}%</strong>
                  </Text>
                </div>
                {r.subjects?.length > 0 && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC' }}>
                        {['Subject', 'Max', 'Marks', 'Grade'].map(h => (
                          <th key={h} style={{ padding: '3px 6px', textAlign: 'left', color: '#64748B', fontWeight: 600, borderBottom: '1px solid #E2E8F0' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {r.subjects.map((s, si) => (
                        <tr key={si} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '3px 6px' }}>{s.subject?.name || '—'}</td>
                          <td style={{ padding: '3px 6px' }}>{s.maxMarks}</td>
                          <td style={{ padding: '3px 6px', fontWeight: 600, color: s.passed ? '#22C55E' : '#EF4444' }}>{s.marksObtained}</td>
                          <td style={{ padding: '3px 6px' }}>{s.grade}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
            );
          })}
        </>
      ) : <Empty description="No exam results yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
    },
  ];

  return (
    <Drawer
      title={<><UserOutlined /> {student.name}</>}
      open={open}
      onClose={onClose}
      width={500}
    >
      {profileLoading && !profileData ? (
        <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>
      ) : (
        <Tabs items={tabs} defaultActiveKey="overview" />
      )}
    </Drawer>
  );
};


export default Students;
