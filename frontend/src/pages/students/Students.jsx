import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Table, Typography, Input, Select, Row, Col, App, Empty,
  Button, Modal, Form, DatePicker, Tag, Drawer, Tabs, Descriptions, Spin,
  Statistic, Card, List, Badge, Avatar,
  Divider, Upload, Progress, Alert, Steps, Result,
} from 'antd';
import {
  SearchOutlined, PlusOutlined, EyeOutlined, EditOutlined,
  DollarOutlined, CalendarOutlined, BookOutlined, UserOutlined,
  UploadOutlined, DownloadOutlined, CheckCircleOutlined, CloseCircleOutlined,
  WarningOutlined, InboxOutlined,
} from '@ant-design/icons';
import { studentAPI, schoolAPI, feesAPI, attendanceAPI, examAPI, setupAPI } from '@/services/api';
import StatusTag from '@/components/common/StatusTag';
import FileUpload from '@/components/common/FileUpload';
import useAuthStore from '@/store/authStore';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const Students = () => {
  const { message } = App.useApp();
  const userRole = useAuthStore((s) => s.user?.role);
  // Accountant and visitor are read-only — cannot add/edit/delete students
  const canWrite = !['accountant', 'visitor'].includes(userRole);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
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
  const [editingStudent, setEditingStudent] = useState(null);

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

      const sortedList = [...list].sort((a, b) => {
        // 1. Class
        const classA = a.classId?.name || a.className || '';
        const classB = b.classId?.name || b.className || '';
        const classComp = classA.localeCompare(classB);
        if (classComp !== 0) return classComp;

        // 2. Section
        const secA = a.sectionId?.name || a.sectionName || '';
        const secB = b.sectionId?.name || b.sectionName || '';
        const secComp = secA.localeCompare(secB);
        if (secComp !== 0) return secComp;

        // 3. Roll No
        const rollA = a.rollNo || '';
        const rollB = b.rollNo || '';
        const numA = parseInt(rollA.replace(/\D/g, ''), 10);
        const numB = parseInt(rollB.replace(/\D/g, ''), 10);
        let rollComp = 0;
        if (!isNaN(numA) && !isNaN(numB)) {
          rollComp = numA - numB;
        } else {
          rollComp = rollA.localeCompare(rollB);
        }
        if (rollComp !== 0) return rollComp;

        // 4. Student Name
        const nameA = a.name || '';
        const nameB = b.name || '';
        return nameA.localeCompare(nameB);
      });

      setStudents(sortedList);

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


  // ─── Load classes + sections + academic years ──────────────
  useEffect(() => {
    schoolAPI.getClasses({ limit: 50 })
      .then((res) => {
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

    setupAPI.getAcademicYears()
      .then((res) => {
        const envelope = res?.data ?? {};
        const list = Array.isArray(envelope?.data) ? envelope.data
          : Array.isArray(envelope) ? envelope
            : [];
        setAcademicYears(list);
      })
      .catch(e => console.error('Academic years load failed', e));
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

  // ─── Edit student click handler ───────────────────────────
  const handleEditClick = async (record) => {
    setLoading(true);
    try {
      const res = await studentAPI.getProfile(record._id);
      const data = res?.data?.data || res?.data || {};
      const s = data.student || {};
      const adm = data.admission || {};

      // Merge values cleanly to prefill the form
      const merged = {
        ...adm,
        ...s,
        name: s.name || adm.studentName,
        dateOfBirth: s.dateOfBirth ? dayjs(s.dateOfBirth) : (adm.dateOfBirth ? dayjs(adm.dateOfBirth) : null),
        admissionDate: s.admissionDate ? dayjs(s.admissionDate) : (adm.admissionDate ? dayjs(adm.admissionDate) : null),
        tcDate: s.tcDate ? dayjs(s.tcDate) : (adm.tcDate ? dayjs(adm.tcDate) : null),
        receiptDate: s.receiptDate ? dayjs(s.receiptDate) : (adm.receiptDate ? dayjs(adm.receiptDate) : null),
        documentsVerifiedDate: s.documentsVerifiedDate ? dayjs(s.documentsVerifiedDate) : (adm.documentsVerifiedDate ? dayjs(adm.documentsVerifiedDate) : null),
        classId: s.classId?._id || s.classId || adm.classId?._id || adm.classId,
        sectionId: s.sectionId?._id || s.sectionId || adm.sectionId?._id || adm.sectionId,
        academicYearId: s.academicYearId?._id || s.academicYearId || adm.academicYearId?._id || adm.academicYearId,
      };

      setEditingStudent(record);
      form.setFieldsValue(merged);
      setAvatarUrl(s.avatar || s.studentPhoto || adm.studentPhoto || null);
      if (merged.classId) {
        setModalClassId(merged.classId);
        setFilteredSections(sections.filter((sec) => 
          sec.classId === merged.classId || 
          sec.classId?._id === merged.classId || 
          sec.classId?.toString() === merged.classId
        ));
      }
      setModal(true);
    } catch (err) {
      message.error(err.message || 'Failed to load student details for editing');
    } finally {
      setLoading(false);
    }
  };

  // ─── Create/Update student ────────────────────────────────
  const onFinish = async (values) => {
    setSaving(true);
    try {
      const payload = {
        ...values,
        dateOfBirth: values.dateOfBirth ? values.dateOfBirth.toISOString() : undefined,
        admissionDate: values.admissionDate ? values.admissionDate.toISOString() : undefined,
        tcDate: values.tcDate ? values.tcDate.toISOString() : undefined,
        receiptDate: values.receiptDate ? values.receiptDate.toISOString() : undefined,
        documentsVerifiedDate: values.documentsVerifiedDate ? values.documentsVerifiedDate.toISOString() : undefined,
        avatar: avatarUrl || null,
        studentPhoto: avatarUrl || null,
      };

      // Mirror contact numbers inside father/mother/guardian
      if (payload.motherPhone) {
        if (!payload.mother) payload.mother = {};
        payload.mother.phone = payload.motherPhone;
      }
      if (payload.guardianPhone) {
        if (!payload.guardian) payload.guardian = {};
        payload.guardian.phone = payload.guardianPhone;
      }
      if (payload.parentPhone) {
        if (!payload.father) payload.father = {};
        if (!payload.father.phone) payload.father.phone = payload.parentPhone;
      }

      if (editingStudent) {
        await studentAPI.update(editingStudent._id, payload);
        message.success('Student updated successfully');
      } else {
        await studentAPI.create(payload);
        message.success('Student created successfully');
      }

      setModal(false);
      setEditingStudent(null);
      form.resetFields();
      setAvatarUrl(null);
      setModalClassId(null);
      setFilteredSections([]);
      fetchStudents(pagination.current, pagination.pageSize);
    } catch (err) {
      message.error(err.message || 'Failed to save student');
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
      sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
      filters: [
        { text: 'Male', value: 'male' },
        { text: 'Female', value: 'female' },
        { text: 'Other', value: 'other' }
      ],
      onFilter: (value, record) => record.gender === value,
      render: (_, s) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar
            size={32}
            src={s.avatar || s.studentPhoto || s.photo || s.profilePhoto || null}
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
      sorter: (a, b) => (a.admissionNo || a.admissionNumber || '').localeCompare(b.admissionNo || b.admissionNumber || ''),
      render: (_, s) => s.admissionNo || s.admissionNumber || '—',
    },
    {
      title: 'Register No',
      key: 'registerNo',
      width: 130,
      sorter: (a, b) => {
        const valA = a.registerNo || a.rollNo || '';
        const valB = b.registerNo || b.rollNo || '';
        const numA = parseInt(valA.replace(/\D/g, ''), 10);
        const numB = parseInt(valB.replace(/\D/g, ''), 10);
        if (!isNaN(numA) && !isNaN(numB)) {
          return numA - numB;
        }
        return valA.localeCompare(valB);
      },
      render: (_, s) => s.registerNo || s.rollNo || '—',
    },
    {
      title: 'Class',
      key: 'class',
      width: 110,
      ellipsis: true,
      sorter: (a, b) => {
        const nameA = a.classId?.name || a.className || '';
        const nameB = b.classId?.name || b.className || '';
        return nameA.localeCompare(nameB);
      },
      filters: classes.map(c => ({ text: c.name, value: c._id })),
      onFilter: (value, record) => {
        const id = record.classId?._id || record.classId;
        return id === value;
      },
      render: (_, s) => s.classId?.name || s.className || '—',
    },
    {
      title: 'Section',
      key: 'section',
      width: 90,
      ellipsis: true,
      sorter: (a, b) => {
        const nameA = a.sectionId?.name || a.sectionName || '';
        const nameB = b.sectionId?.name || b.sectionName || '';
        return nameA.localeCompare(nameB);
      },
      filters: [...new Set(sections.map(s => s.name))].filter(Boolean).map(name => ({ text: name, value: name })),
      onFilter: (value, record) => {
        const name = record.sectionId?.name || record.sectionName;
        return name === value;
      },
      render: (_, s) => s.sectionId?.name || s.sectionName || '—',
    },
    {
      title: 'Parent',
      key: 'parent',
      width: 160,
      ellipsis: true,
      sorter: (a, b) => (a.parentName || '').localeCompare(b.parentName || ''),
      render: (_, s) => (
        <div>
          <Text ellipsis style={{ display: 'block', maxWidth: 150 }}>{s.parentName || '—'}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{s.parentPhone || ''}</Text>
        </div>
      ),
    },
    {
      title: 'Created Date',
      key: 'createdAt',
      width: 120,
      sorter: (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0),
      render: (_, s) => s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '—',
    },
    {
      title: 'Status', dataIndex: 'isActive', key: 'status', width: 90,
      filters: [
        { text: 'Active', value: true },
        { text: 'Inactive', value: false }
      ],
      onFilter: (value, record) => {
        const active = record.isActive !== false;
        return active === value;
      },
      render: (isActive) => <StatusTag status={isActive !== false ? 'active' : 'inactive'} />,
    },
    {
      title: 'Actions', key: 'actions', width: 160, fixed: 'right',
      render: (_, record) => (
        <span style={{ display: 'flex', gap: 8 }}>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setProfileDrawer({ open: true, student: record })}
            id={`view-profile-${record._id}`}
          >
            Profile
          </Button>
          {canWrite && (
            <Button
              size="small"
              type="primary"
              ghost
              icon={<EditOutlined />}
              onClick={() => handleEditClick(record)}
              id={`edit-student-${record._id}`}
            >
              Edit
            </Button>
          )}
        </span>
      ),
    },
  ];

  const handleTableChange = (pag) => fetchStudents(pag.current, pag.pageSize);

  const [bulkModal, setBulkModal] = useState(false);

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Title level={4} className="page-title" style={{ margin: 0 }}>Students</Title>
          <Text type="secondary">Manage enrolled students</Text>
        </div>
        {canWrite && (
          <Row gutter={8} style={{ flexWrap: 'nowrap' }}>
            <Col>
              <Button
                icon={<UploadOutlined />}
                onClick={() => setBulkModal(true)}
                id="bulk-upload-btn"
              >
                Bulk Upload CSV
              </Button>
            </Col>
            <Col>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditingStudent(null);
                  form.resetFields();
                  setAvatarUrl(null);
                  setModalClassId(null);
                  setFilteredSections([]);
                  setModal(true);
                }}
                id="new-student-btn"
              >
                New Student
              </Button>
            </Col>
          </Row>
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

      {/* New/Edit Student Modal — write roles only */}
      {canWrite && (
        <Modal
          title={editingStudent ? "Edit Student Details" : "Add New Student"}
          open={modal}
          onCancel={() => {
            setModal(false);
            setEditingStudent(null);
            form.resetFields();
            setAvatarUrl(null);
            setModalClassId(null);
            setFilteredSections([]);
          }}
          footer={null}
          width={800}
          destroyOnClose
        >
          <Form form={form} layout="vertical" onFinish={onFinish} style={{ marginTop: 16 }}>
            <Tabs defaultActiveKey="academic" type="card" style={{ marginBottom: 20 }}>
              {/* Tab 1: Academic & Admission */}
              <Tabs.TabPane tab="Academic & Admission" key="academic">
                <Row gutter={16}>
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
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item label="Academic Year" name="academicYearId">
                      <Select
                        placeholder="Select Academic Year"
                        allowClear
                        options={academicYears.map((ay) => ({ label: ay.name, value: ay._id }))}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Admission Date" name="admissionDate">
                      <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item label="Admission No" name="admissionNo">
                      <Input placeholder="Leave blank to auto-generate" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Register No" name="registerNo">
                      <Input placeholder="Leave blank to auto-generate" />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item label="Roll No" name="rollNo">
                      <Input placeholder="Leave blank to auto-generate" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Admission Mode" name="mode">
                      <Select defaultValue="offline">
                        <Select.Option value="online">Online</Select.Option>
                        <Select.Option value="offline">Offline</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item label="Admission Type" name="type">
                      <Select defaultValue="day-boarding">
                        <Select.Option value="day-boarding">Day Boarding</Select.Option>
                        <Select.Option value="residential">Residential</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Boarding Type" name="boardingType">
                      <Select defaultValue="day-boarding">
                        <Select.Option value="day-boarding">Day Boarding</Select.Option>
                        <Select.Option value="residential">Residential</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item label="Second Language Preference" name="secondLanguage">
                      <Input placeholder="e.g. Kannada, Hindi, French" />
                    </Form.Item>
                  </Col>
                </Row>
              </Tabs.TabPane>

              {/* Tab 2: Student Details */}
              <Tabs.TabPane tab="Student Details" key="personal">
                <Row gutter={16}>
                  <Col span={24} style={{ textAlign: 'center', marginBottom: 16 }}>
                    <Form.Item label="Student Profile Photo" style={{ display: 'inline-block' }}>
                      <FileUpload
                        folder="students"
                        accept="image/*"
                        value={avatarUrl}
                        onChange={setAvatarUrl}
                        onUploading={setUploading}
                        label="Upload Photo"
                      />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={16}>
                    <Form.Item label="Student Full Name" name="name" rules={[{ required: true }]}>
                      <Input placeholder="Student full name" />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Gender" name="gender" rules={[{ required: true }]}>
                      <Select placeholder="Select gender">
                        <Select.Option value="male">Male</Select.Option>
                        <Select.Option value="female">Female</Select.Option>
                        <Select.Option value="other">Other</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item label="Date of Birth" name="dateOfBirth" rules={[{ required: true }]}>
                      <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="DOB (In Words)" name="dobInWords">
                      <Input placeholder="e.g. Fifteenth June Two Thousand Fourteen" />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item label="Place of Birth" name="placeOfBirth">
                      <Input placeholder="City/Town" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Nationality" name="nationality" defaultValue="Indian">
                      <Input placeholder="e.g. Indian" />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item label="Religion" name="religion">
                      <Input placeholder="e.g. Hindu, Christian" />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Caste" name="caste">
                      <Input placeholder="e.g. General, SC" />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Category" name="category">
                      <Select placeholder="Select Category" defaultValue="General">
                        <Select.Option value="General">General</Select.Option>
                        <Select.Option value="OBC">OBC</Select.Option>
                        <Select.Option value="SC">SC</Select.Option>
                        <Select.Option value="ST">ST</Select.Option>
                        <Select.Option value="Others">Others</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item label="Mother Tongue" name="motherTongue">
                      <Input placeholder="e.g. Kannada, English" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Student Aadhaar No" name="aadhaarNo">
                      <Input placeholder="12-digit Aadhaar Number" />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item label="Number of Siblings" name="numberOfSiblings">
                      <Input type="number" min={0} placeholder="0" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Sibling Studying In This School?" name="siblingStudyingInSchool">
                      <Select placeholder="Select">
                        <Select.Option value={true}>Yes</Select.Option>
                        <Select.Option value={false}>No</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item label="Current Address" name="address">
                  <Input.TextArea rows={2} placeholder="Full communication address" />
                </Form.Item>
              </Tabs.TabPane>

              {/* Tab 3: Parents & Contacts */}
              <Tabs.TabPane tab="Parent / Guardian" key="parents">
                <Divider orientation="left" style={{ margin: '0 0 12px 0', fontSize: 13 }}>Father Details</Divider>
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item label="Father Name" name={['father', 'name']}>
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Father Phone" name="parentPhone" rules={[{ required: true, message: 'Primary Parent Phone is required' }]}>
                      <Input placeholder="Primary phone number" />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Father Aadhaar" name={['father', 'aadhaarNo']}>
                      <Input />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item label="Father Qualification" name={['father', 'qualification']}>
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Father Occupation" name={['father', 'occupation']}>
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Father Annual Income" name={['father', 'annualIncome']}>
                      <Input type="number" />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item label="Father Email" name={['father', 'email']}>
                      <Input type="email" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Father Address" name={['father', 'address']}>
                      <Input.TextArea rows={1} />
                    </Form.Item>
                  </Col>
                </Row>

                <Divider orientation="left" style={{ margin: '16px 0 12px 0', fontSize: 13 }}>Mother Details</Divider>
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item label="Mother Name" name={['mother', 'name']}>
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Mother Phone" name="motherPhone">
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Mother Aadhaar" name={['mother', 'aadhaarNo']}>
                      <Input />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item label="Mother Qualification" name={['mother', 'qualification']}>
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Mother Occupation" name={['mother', 'occupation']}>
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Mother Annual Income" name={['mother', 'annualIncome']}>
                      <Input type="number" />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item label="Mother Email" name={['mother', 'email']}>
                      <Input type="email" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Mother Address" name={['mother', 'address']}>
                      <Input.TextArea rows={1} />
                    </Form.Item>
                  </Col>
                </Row>

                <Divider orientation="left" style={{ margin: '16px 0 12px 0', fontSize: 13 }}>Guardian Details</Divider>
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item label="Guardian Name" name={['guardian', 'name']}>
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Guardian Relationship" name={['guardian', 'relationship']}>
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Guardian Phone" name="guardianPhone">
                      <Input />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item label="Guardian Address" name={['guardian', 'address']}>
                  <Input.TextArea rows={1} />
                </Form.Item>
                <Form.Item label="Primary Parent Email" name="parentEmail">
                  <Input type="email" placeholder="Secondary email backup" />
                </Form.Item>
              </Tabs.TabPane>

              {/* Tab 4: Previous School */}
              <Tabs.TabPane tab="Previous School" key="previousSchool">
                <Form.Item label="Previous School Name" name="previousSchool">
                  <Input />
                </Form.Item>
                <Form.Item label="Previous School Address" name="previousSchoolAddress">
                  <Input.TextArea rows={2} />
                </Form.Item>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item label="Previous Board" name="previousBoard">
                      <Input placeholder="e.g. CBSE, ICSE, State Board" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Medium of Instruction" name="mediumOfInstruction">
                      <Input placeholder="e.g. English, Kannada" />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item label="Class Last Studied" name="classLastStudied">
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Year of Completion" name="yearOfCompletion">
                      <Input />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item label="TC Number" name="tcNumber">
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="TC Issue Date" name="tcDate">
                      <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item label="SATS Number" name="satsNumber">
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="APAAR Number" name="apaarNumber">
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="PEN Number" name="penNumber">
                      <Input />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item label="Has Transfer Certificate (TC) submitted?" name="hasTC">
                  <Select placeholder="Select">
                    <Select.Option value={true}>Yes</Select.Option>
                    <Select.Option value={false}>No</Select.Option>
                  </Select>
                </Form.Item>
              </Tabs.TabPane>

              {/* Tab 5: Medical & SEN */}
              <Tabs.TabPane tab="Medical & SEN" key="medical">
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item label="Blood Group" name="bloodGroup">
                      <Input placeholder="e.g. O+, A-" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Allergies" name="allergies">
                      <Input placeholder="e.g. Peanuts, Penicillin" />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item label="Medical Conditions / Physical Challenges" name="medicalConditions">
                  <Input.TextArea rows={2} />
                </Form.Item>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item label="Special Educational Needs (SEN) Type" name="senType">
                      <Input placeholder="e.g. Dyslexia, ADHD" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="SEN Support Level" name="senSupportLevel">
                      <Select placeholder="Select level" allowClear>
                        <Select.Option value="">None</Select.Option>
                        <Select.Option value="Mild">Mild</Select.Option>
                        <Select.Option value="Moderate">Moderate</Select.Option>
                        <Select.Option value="Intensive">Intensive</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>
              </Tabs.TabPane>

              {/* Tab 6: Office Use & Checklist */}
              <Tabs.TabPane tab="Office & Docs" key="office">
                <Divider orientation="left" style={{ margin: '0 0 12px 0', fontSize: 13 }}>Office Use Metadata</Divider>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item label="Application Form No" name="applicationFormNo">
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Fee Receipt No" name="feeReceiptNo">
                      <Input />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item label="Receipt Date" name="receiptDate">
                      <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Documents Verified By" name="documentsVerifiedBy">
                      <Input />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item label="Documents Verified Date" name="documentsVerifiedDate">
                      <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item label="Principal Remarks" name="principalRemarks">
                  <Input.TextArea rows={2} />
                </Form.Item>

                <Divider orientation="left" style={{ margin: '16px 0 12px 0', fontSize: 13 }}>Document Checklist</Divider>
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item label="Birth Certificate" name={['documentChecklist', 'birthCertificate']}>
                      <Select defaultValue={false}>
                        <Select.Option value={true}>Submitted</Select.Option>
                        <Select.Option value={false}>Pending</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Aadhaar Card (Student)" name={['documentChecklist', 'aadhaarStudent']}>
                      <Select defaultValue={false}>
                        <Select.Option value={true}>Submitted</Select.Option>
                        <Select.Option value={false}>Pending</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Aadhaar Card (Parents)" name={['documentChecklist', 'aadhaarParents']}>
                      <Select defaultValue={false}>
                        <Select.Option value={true}>Submitted</Select.Option>
                        <Select.Option value={false}>Pending</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item label="Previous Report Card" name={['documentChecklist', 'previousReportCard']}>
                      <Select defaultValue={false}>
                        <Select.Option value={true}>Submitted</Select.Option>
                        <Select.Option value={false}>Pending</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Transfer Certificate" name={['documentChecklist', 'tc']}>
                      <Select defaultValue={false}>
                        <Select.Option value={true}>Submitted</Select.Option>
                        <Select.Option value={false}>Pending</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Caste Certificate" name={['documentChecklist', 'casteCertificate']}>
                      <Select defaultValue={false}>
                        <Select.Option value={true}>Submitted</Select.Option>
                        <Select.Option value={false}>Pending</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>
              </Tabs.TabPane>
            </Tabs>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" htmlType="submit" loading={saving} disabled={uploading} block>
                {uploading ? 'Uploading Photo...' : (editingStudent ? 'Save Changes' : 'Create Student')}
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

      {/* Bulk CSV Import Modal */}
      {canWrite && (
        <BulkImportModal
          open={bulkModal}
          onClose={() => setBulkModal(false)}
          onImportComplete={() => { setBulkModal(false); fetchStudents(1, pagination.pageSize); }}
        />
      )}
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
                alt={displayStudent.name || admission?.studentName}
                style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid #E2E8F0' }}
              />
            ) : (
              <Avatar size={80} icon={<UserOutlined />} style={{ background: 'var(--color-primary-dark)', fontSize: 32 }} />
            )}
            <div style={{ marginTop: 6, fontWeight: 600 }}>{displayStudent.name || admission?.studentName}</div>
          </div>
          
          <Divider style={{ margin: '12px 0 8px 0' }}>Academic & Admission</Divider>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Application Form No">{admission?.applicationFormNo || admission?.applicationNo || '—'}</Descriptions.Item>
            <Descriptions.Item label="Admission No">{displayStudent.admissionNo || displayStudent.admissionNumber || admission?.admissionNo || '—'}</Descriptions.Item>
            <Descriptions.Item label="Roll No">{displayStudent.rollNo || admission?.rollNo || '—'}</Descriptions.Item>
            <Descriptions.Item label="Academic Year">{displayStudent.academicYearId?.name || admission?.academicYear || '—'}</Descriptions.Item>
            <Descriptions.Item label="Class">{displayStudent.classId?.name || admission?.class || '—'}</Descriptions.Item>
            <Descriptions.Item label="Section">{displayStudent.sectionId?.name || admission?.section || '—'}</Descriptions.Item>
            <Descriptions.Item label="Admission Date">{displayStudent.admissionDate || admission?.admissionDate ? dayjs(displayStudent.admissionDate || admission?.admissionDate).format('DD MMM YYYY') : '—'}</Descriptions.Item>
            <Descriptions.Item label="Admission Mode">{displayStudent.mode || admission?.mode || '—'}</Descriptions.Item>
            <Descriptions.Item label="Admission Type">{displayStudent.type || admission?.type || '—'}</Descriptions.Item>
            <Descriptions.Item label="Boarding Type">{displayStudent.boardingType || admission?.boardingType || '—'}</Descriptions.Item>
            <Descriptions.Item label="Second Language Preference">{displayStudent.secondLanguage || admission?.secondLanguage || '—'}</Descriptions.Item>
          </Descriptions>

          <Divider style={{ margin: '12px 0 8px 0' }}>Personal Information</Divider>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Gender">{displayStudent.gender || admission?.gender || '—'}</Descriptions.Item>
            <Descriptions.Item label="Date of Birth">
              {displayStudent.dateOfBirth || admission?.dateOfBirth ? dayjs(displayStudent.dateOfBirth || admission?.dateOfBirth).format('DD MMM YYYY') : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="DOB (In Words)">{displayStudent.dobInWords || admission?.dobInWords || '—'}</Descriptions.Item>
            <Descriptions.Item label="Place of Birth">{displayStudent.placeOfBirth || admission?.placeOfBirth || '—'}</Descriptions.Item>
            <Descriptions.Item label="Nationality">{displayStudent.nationality || admission?.nationality || '—'}</Descriptions.Item>
            <Descriptions.Item label="Religion">{displayStudent.religion || admission?.religion || '—'}</Descriptions.Item>
            <Descriptions.Item label="Caste">{displayStudent.caste || admission?.caste || '—'}</Descriptions.Item>
            <Descriptions.Item label="Category">{displayStudent.category || admission?.category || '—'}</Descriptions.Item>
            <Descriptions.Item label="Mother Tongue">{displayStudent.motherTongue || admission?.motherTongue || '—'}</Descriptions.Item>
            <Descriptions.Item label="Number of Siblings">{displayStudent.numberOfSiblings ?? admission?.numberOfSiblings ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Sibling Studying Here?">{displayStudent.siblingStudyingInSchool ? 'Yes' : (admission?.siblingStudyingInSchool ? 'Yes' : 'No')}</Descriptions.Item>
            <Descriptions.Item label="Current Address">{displayStudent.address || admission?.address || '—'}</Descriptions.Item>
          </Descriptions>

          <Divider style={{ margin: '12px 0 8px 0' }}>Parent & Guardian Information</Divider>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Primary Contact Phone">{displayStudent.parentPhone || admission?.parentPhone || '—'}</Descriptions.Item>
            <Descriptions.Item label="Primary Contact Email">{displayStudent.parentEmail || admission?.parentEmail || '—'}</Descriptions.Item>
            
            <Descriptions.Item label="Father Name">{displayStudent.father?.name || admission?.father?.name || '—'}</Descriptions.Item>
            <Descriptions.Item label="Father Phone">{displayStudent.parentPhone || admission?.father?.phone || '—'}</Descriptions.Item>
            <Descriptions.Item label="Father Aadhaar">{displayStudent.father?.aadhaarNo || admission?.father?.aadhaarNo || '—'}</Descriptions.Item>
            <Descriptions.Item label="Father Qualification">{displayStudent.father?.qualification || admission?.father?.qualification || '—'}</Descriptions.Item>
            <Descriptions.Item label="Father Occupation">{displayStudent.father?.occupation || admission?.father?.occupation || '—'}</Descriptions.Item>
            <Descriptions.Item label="Father Annual Income">{displayStudent.father?.annualIncome ? `₹${displayStudent.father.annualIncome.toLocaleString('en-IN')}` : (admission?.father?.annualIncome ? `₹${admission.father.annualIncome.toLocaleString('en-IN')}` : '—')}</Descriptions.Item>
            <Descriptions.Item label="Father Address">{displayStudent.father?.address || admission?.father?.address || '—'}</Descriptions.Item>

            <Descriptions.Item label="Mother Name">{displayStudent.mother?.name || admission?.mother?.name || '—'}</Descriptions.Item>
            <Descriptions.Item label="Mother Phone">{displayStudent.motherPhone || displayStudent.mother?.phone || admission?.mother?.phone || '—'}</Descriptions.Item>
            <Descriptions.Item label="Mother Aadhaar">{displayStudent.mother?.aadhaarNo || admission?.mother?.aadhaarNo || '—'}</Descriptions.Item>
            <Descriptions.Item label="Mother Qualification">{displayStudent.mother?.qualification || admission?.mother?.qualification || '—'}</Descriptions.Item>
            <Descriptions.Item label="Mother Occupation">{displayStudent.mother?.occupation || admission?.mother?.occupation || '—'}</Descriptions.Item>
            <Descriptions.Item label="Mother Annual Income">{displayStudent.mother?.annualIncome ? `₹${displayStudent.mother.annualIncome.toLocaleString('en-IN')}` : (admission?.mother?.annualIncome ? `₹${admission.mother.annualIncome.toLocaleString('en-IN')}` : '—')}</Descriptions.Item>
            <Descriptions.Item label="Mother Address">{displayStudent.mother?.address || admission?.mother?.address || '—'}</Descriptions.Item>

            <Descriptions.Item label="Guardian Name">{displayStudent.guardian?.name || admission?.guardian?.name || '—'}</Descriptions.Item>
            <Descriptions.Item label="Guardian Relationship">{displayStudent.guardian?.relationship || admission?.guardian?.relationship || '—'}</Descriptions.Item>
            <Descriptions.Item label="Guardian Phone">{displayStudent.guardianPhone || displayStudent.guardian?.phone || admission?.guardian?.phone || '—'}</Descriptions.Item>
            <Descriptions.Item label="Guardian Address">{displayStudent.guardian?.address || admission?.guardian?.address || '—'}</Descriptions.Item>
          </Descriptions>

          <Divider style={{ margin: '12px 0 8px 0' }}>Previous School Information</Divider>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Previous School Name">{displayStudent.previousSchool || admission?.previousSchool || '—'}</Descriptions.Item>
            <Descriptions.Item label="Previous School Address">{displayStudent.previousSchoolAddress || admission?.previousSchoolAddress || '—'}</Descriptions.Item>
            <Descriptions.Item label="Previous Board">{displayStudent.previousBoard || admission?.previousBoard || '—'}</Descriptions.Item>
            <Descriptions.Item label="Medium of Instruction">{displayStudent.mediumOfInstruction || admission?.mediumOfInstruction || '—'}</Descriptions.Item>
            <Descriptions.Item label="Class Last Studied">{displayStudent.classLastStudied || admission?.classLastStudied || '—'}</Descriptions.Item>
            <Descriptions.Item label="Year of Completion">{displayStudent.yearOfCompletion || admission?.yearOfCompletion || '—'}</Descriptions.Item>
            <Descriptions.Item label="TC Submitted?">{displayStudent.hasTC ? 'Yes' : (admission?.hasTC ? 'Yes' : 'No')}</Descriptions.Item>
            <Descriptions.Item label="TC Number">{displayStudent.tcNumber || admission?.tcNumber || '—'}</Descriptions.Item>
            <Descriptions.Item label="TC Issue Date">{displayStudent.tcDate || admission?.tcDate ? dayjs(displayStudent.tcDate || admission?.tcDate).format('DD MMM YYYY') : '—'}</Descriptions.Item>
          </Descriptions>

          <Divider style={{ margin: '12px 0 8px 0' }}>Government National IDs</Divider>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Student Aadhaar No">{displayStudent.aadhaarNo || admission?.aadhaarNo || '—'}</Descriptions.Item>
            <Descriptions.Item label="SATS Number">{displayStudent.satsNumber || admission?.satsNumber || '—'}</Descriptions.Item>
            <Descriptions.Item label="APAAR Number">{displayStudent.apaarNumber || admission?.apaarNumber || '—'}</Descriptions.Item>
            <Descriptions.Item label="PEN Number">{displayStudent.penNumber || admission?.penNumber || '—'}</Descriptions.Item>
          </Descriptions>

          <Divider style={{ margin: '12px 0 8px 0' }}>Medical & Special Needs (SEN)</Divider>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Blood Group">{displayStudent.bloodGroup || admission?.bloodGroup || '—'}</Descriptions.Item>
            <Descriptions.Item label="Allergies">{displayStudent.allergies || admission?.allergies || '—'}</Descriptions.Item>
            <Descriptions.Item label="Medical Conditions">{displayStudent.medicalConditions || admission?.medicalConditions || '—'}</Descriptions.Item>
            <Descriptions.Item label="SEN Type">{displayStudent.senType || admission?.senType || '—'}</Descriptions.Item>
            <Descriptions.Item label="SEN Support Level">{displayStudent.senSupportLevel || admission?.senSupportLevel || '—'}</Descriptions.Item>
          </Descriptions>

          <Divider style={{ margin: '12px 0 8px 0' }}>Office Use Only</Divider>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Fee Receipt No">{displayStudent.feeReceiptNo || admission?.feeReceiptNo || '—'}</Descriptions.Item>
            <Descriptions.Item label="Receipt Date">{displayStudent.receiptDate || admission?.receiptDate ? dayjs(displayStudent.receiptDate || admission?.receiptDate).format('DD MMM YYYY') : '—'}</Descriptions.Item>
            <Descriptions.Item label="Documents Verified By">{displayStudent.documentsVerifiedBy || admission?.documentsVerifiedBy || '—'}</Descriptions.Item>
            <Descriptions.Item label="Documents Verified Date">{displayStudent.documentsVerifiedDate || admission?.documentsVerifiedDate ? dayjs(displayStudent.documentsVerifiedDate || admission?.documentsVerifiedDate).format('DD MMM YYYY') : '—'}</Descriptions.Item>
            <Descriptions.Item label="Principal Remarks">{displayStudent.principalRemarks || admission?.principalRemarks || '—'}</Descriptions.Item>
            
            <Descriptions.Item label="Birth Certificate Verified?">{displayStudent.documentChecklist?.birthCertificate ? 'Yes' : (admission?.documentChecklist?.birthCertificate ? 'Yes' : 'No')}</Descriptions.Item>
            <Descriptions.Item label="Student Aadhaar Verified?">{displayStudent.documentChecklist?.aadhaarStudent ? 'Yes' : (admission?.documentChecklist?.aadhaarStudent ? 'Yes' : 'No')}</Descriptions.Item>
            <Descriptions.Item label="Parents Aadhaar Verified?">{displayStudent.documentChecklist?.aadhaarParents ? 'Yes' : (admission?.documentChecklist?.aadhaarParents ? 'Yes' : 'No')}</Descriptions.Item>
            <Descriptions.Item label="Report Card Verified?">{displayStudent.documentChecklist?.previousReportCard ? 'Yes' : (admission?.documentChecklist?.previousReportCard ? 'Yes' : 'No')}</Descriptions.Item>
            <Descriptions.Item label="TC Verified?">{displayStudent.documentChecklist?.tc ? 'Yes' : (admission?.documentChecklist?.tc ? 'Yes' : 'No')}</Descriptions.Item>
            <Descriptions.Item label="Caste Certificate Verified?">{displayStudent.documentChecklist?.casteCertificate ? 'Yes' : (admission?.documentChecklist?.casteCertificate ? 'Yes' : 'No')}</Descriptions.Item>
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

// ─── CSV Parser helper (no external lib — pure JS) ───────────
/**
 * Parse a CSV string to an array of objects using the first row as headers.
 * Handles quoted fields, commas inside quotes, and CRLF line endings.
 */
function parseCsv(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean);
  if (lines.length < 2) return [];

  const parseRow = (line) => {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(cur.trim()); cur = '';
      } else {
        cur += ch;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const headers = parseRow(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const vals = parseRow(lines[i]);
    if (vals.every(v => !v)) continue;
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = vals[idx] || ''; });
    // Normalise header aliases for service compatibility
    const row = {
      studentName: obj.studentname || obj.name || '',
      class: obj.class || obj.classname || obj.className || '',
      section: obj.section || obj.sectionname || '',
      dateOfBirth: obj.dateofbirth || obj.dob || obj.DOB || '',
      gender: obj.gender || '',
      admissionNo: obj.admissionno || obj.admissionnumber || '',
      registerNo: obj.registerno || obj.regno || '',
      parentName: obj.parentname || obj.guardianname || '',
      parentPhone: obj.parentphone || obj.phone || obj.parentcontact || '',
      parentEmail: obj.parentemail || obj.email || '',
      bloodGroup: obj.bloodgroup || obj.blood || '',
      address: obj.address || '',
      aadhaarNo: obj.aadhaarno || obj.aadhaar || '',
      satsNumber: obj.satsnumber || obj.sats || '',
      apaarNumber: obj.apaarnumber || obj.apaar || '',
      
      // New admission style fields:
      rollNo: obj.rollno || obj.rollnumber || '',
      academicYear: obj.academicyear || '',
      admissionDate: obj.admissiondate || '',
      mode: obj.mode || '',
      type: obj.type || '',
      secondLanguage: obj.secondlanguage || '',
      dobInWords: obj.dobinwords || '',
      placeOfBirth: obj.placeofbirth || '',
      nationality: obj.nationality || '',
      religion: obj.religion || '',
      motherTongue: obj.mothertongue || '',
      caste: obj.caste || '',
      category: obj.category || '',
      previousSchool: obj.previousschool || '',
      previousBoard: obj.previousboard || '',
      previousSchoolAddress: obj.previousschooladdress || '',
      classLastStudied: obj.classlaststudied || '',
      yearOfCompletion: obj.yearofcompletion || '',
      tcNumber: obj.tcnumber || '',
      tcDate: obj.tcdate || '',
      penNumber: obj.pennumber || '',
      allergies: obj.allergies || '',
      medicalConditions: obj.medicalconditions || '',
      senType: obj.sentype || '',
      senSupportLevel: obj.sensupportlevel || '',
    };
    rows.push(row);
  }
  return rows;
}

// ─── BulkImportModal ──────────────────────────────────────────
const STEP_UPLOAD = 0;
const STEP_PREVIEW = 1;
const STEP_RESULT = 2;

const BulkImportModal = ({ open, onClose, onImportComplete }) => {
  const { message: msg } = App.useApp();
  const [step, setStep] = useState(STEP_UPLOAD);
  const [rows, setRows] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);

  const reset = () => {
    setStep(STEP_UPLOAD);
    setRows([]);
    setImporting(false);
    setImportResult(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const parsed = parseCsv(e.target.result);
      if (!parsed.length) {
        msg.error('No data rows found in CSV. Check the file format.');
        return;
      }
      setRows(parsed);
      setStep(STEP_PREVIEW);
    };
    reader.readAsText(file);
    return false; // prevent default Upload behaviour
  };

  const handleDownloadTemplate = () => {
    const headers = [
      'studentName', 'class', 'section', 'dateOfBirth', 'gender',
      'admissionNo', 'registerNo', 'rollNo', 'academicYear', 'admissionDate',
      'mode', 'type', 'secondLanguage', 'dobInWords', 'placeOfBirth',
      'nationality', 'religion', 'motherTongue', 'caste', 'category',
      'previousSchool', 'previousBoard', 'previousSchoolAddress', 'classLastStudied',
      'yearOfCompletion', 'tcNumber', 'tcDate', 'satsNumber', 'apaarNumber',
      'penNumber', 'parentName', 'parentPhone', 'parentEmail', 'bloodGroup',
      'address', 'allergies', 'medicalConditions', 'senType', 'senSupportLevel'
    ];
    const exampleRow = [
      'Ravi Kumar', 'Class 5', 'A', '2014-06-15', 'male',
      'ADM-001', 'REG-001', '10', '2025-26', '2025-06-01',
      'offline', 'day-boarding', 'Kannada', 'Fifteenth June Two Thousand Fourteen', 'Bangalore',
      'Indian', 'Hindu', 'Kannada', 'General', 'General',
      'Greenfield Public School', 'CBSE', '12 Main Rd, Bangalore', 'Class 4',
      '2024', 'TC-9921', '2024-05-15', '123456789', '987654321',
      'PEN-8871', 'Suresh Kumar', '9876543210', 'suresh@example.com', 'O+',
      '12 Main Street, Bangalore', 'None', 'None', '', ''
    ];
    const csv = [headers.join(','), exampleRow.join(',')].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'student_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const res = await studentAPI.bulkImport(rows);
      const data = res?.data ?? res;
      setImportResult(data);
      setStep(STEP_RESULT);
    } catch (e) {
      msg.error(e.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  // ── Preview columns ───────────────────────────────────────
  const previewColumns = [
    { title: '#', key: 'idx', width: 48, render: (_, __, i) => i + 1 },
    { title: 'Name', dataIndex: 'studentName', key: 'name', ellipsis: true, width: 140 },
    { title: 'Class', dataIndex: 'class', key: 'class', width: 80 },
    { title: 'Section', dataIndex: 'section', key: 'sec', width: 70 },
    { title: 'DOB', dataIndex: 'dateOfBirth', key: 'dob', width: 100 },
    { title: 'Gender', dataIndex: 'gender', key: 'gender', width: 72 },
    { title: 'AdmNo', dataIndex: 'admissionNo', key: 'adm', width: 90, ellipsis: true },
    { title: 'Parent', dataIndex: 'parentName', key: 'par', width: 120, ellipsis: true },
    { title: 'Phone', dataIndex: 'parentPhone', key: 'ph', width: 110 },
    {
      title: 'Status',
      key: 'status',
      width: 80,
      fixed: 'right',
      render: (_, r) => {
        const missing = [];
        if (!r.studentName) missing.push('name');
        if (!r.dateOfBirth) missing.push('DOB');
        if (!r.gender || !['male', 'female', 'other'].includes(r.gender.toLowerCase())) missing.push('gender');
        if (!r.parentName) missing.push('parent name');
        if (!r.parentPhone) missing.push('phone');
        if (!r.class) missing.push('class');
        if (missing.length) {
          return (
            <Tag color="red" title={`Missing: ${missing.join(', ')}`}>
              <WarningOutlined /> Invalid
            </Tag>
          );
        }
        return <Tag color="green"><CheckCircleOutlined /> OK</Tag>;
      },
    },
  ];

  // ── Result table columns ──────────────────────────────────
  const resultColumns = [
    { title: '#', dataIndex: 'row', key: 'row', width: 50 },
    { title: 'Name', dataIndex: 'name', key: 'name', ellipsis: true },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (s) => ({
        created: <Tag color="green">Created</Tag>,
        skipped: <Tag color="orange">Skipped</Tag>,
        failed: <Tag color="red">Failed</Tag>,
      }[s] || <Tag>{s}</Tag>),
    },
    { title: 'Roll No', dataIndex: 'rollNo', key: 'roll', width: 120, ellipsis: true, render: v => v || '—' },
    { title: 'Reason', dataIndex: 'reason', key: 'reason', ellipsis: true, render: v => v || '—' },
  ];

  const validCount = rows.filter(r => {
    const g = (r.gender || '').toLowerCase();
    return r.studentName && r.dateOfBirth && ['male', 'female', 'other'].includes(g) &&
      r.parentName && r.parentPhone && r.class;
  }).length;

  return (
    <Modal
      title="📤 Bulk Student Import (CSV)"
      open={open}
      onCancel={handleClose}
      footer={null}
      width={900}
      destroyOnHidden
      styles={{ body: { padding: '16px 24px 24px' } }}
    >
      {/* Steps */}
      <Steps
        current={step}
        size="small"
        style={{ marginBottom: 20 }}
        items={[
          { title: 'Upload CSV' },
          { title: 'Preview & Validate' },
          { title: 'Import Result' },
        ]}
      />

      {/* STEP 0 — Upload */}
      {step === STEP_UPLOAD && (
        <div>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="Upload your student data as a CSV file."
            description={
              <span>
                First row must be headers.{' '}
                <Button type="link" size="small" icon={<DownloadOutlined />} onClick={handleDownloadTemplate} style={{ padding: 0 }}>
                  Download sample template
                </Button>
              </span>
            }
          />

          <Upload.Dragger
            accept=".csv,text/csv"
            showUploadList={false}
            beforeUpload={handleFile}
            style={{ padding: '16px 0' }}
          >
            <p style={{ fontSize: 32 }}><InboxOutlined style={{ color: '#94A3B8' }} /></p>
            <p style={{ fontWeight: 600, color: '#1E293B' }}>Click or drag a CSV file here</p>
            <p style={{ color: '#64748B', fontSize: 12 }}>Supports .csv files up to 1,000 student rows</p>
          </Upload.Dragger>

          {/* Required columns reminder */}
          <div style={{ marginTop: 16, padding: '12px 16px', background: '#F8FAFC', borderRadius: 8, fontSize: 12, color: '#64748B' }}>
            <strong style={{ color: '#1E293B' }}>Required columns:</strong>{' '}
            studentName, class, dateOfBirth (YYYY-MM-DD), gender (male/female/other), parentName, parentPhone
            <br />
            <strong style={{ color: '#1E293B' }}>Optional:</strong>{' '}
            section, admissionNo, registerNo, parentEmail, bloodGroup, address, aadhaarNo, satsNumber, apaarNumber
          </div>
        </div>
      )}

      {/* STEP 1 — Preview */}
      {step === STEP_PREVIEW && (
        <div>
          <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
            <Col>
              <Text>{rows.length} rows loaded &nbsp;·&nbsp;</Text>
              <Text style={{ color: '#22C55E' }}>{validCount} valid</Text>
              <Text> &nbsp;·&nbsp; </Text>
              <Text style={{ color: '#EF4444' }}>{rows.length - validCount} invalid</Text>
            </Col>
            <Col>
              <Button size="small" onClick={reset} style={{ marginRight: 8 }}>
                Upload Different File
              </Button>
            </Col>
          </Row>

          {rows.length - validCount > 0 && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
              message={`${rows.length - validCount} row(s) have missing required fields and will be skipped during import. Fix the CSV and re-upload to import them.`}
            />
          )}

          <div style={{ maxHeight: 340, overflowY: 'auto' }}>
            <Table
              columns={previewColumns}
              dataSource={rows}
              rowKey={(_, i) => i}
              pagination={false}
              size="small"
              scroll={{ x: 900 }}
              rowClassName={(r) => {
                const g = (r.gender || '').toLowerCase();
                const ok = r.studentName && r.dateOfBirth && ['male', 'female', 'other'].includes(g) &&
                  r.parentName && r.parentPhone && r.class;
                return ok ? '' : 'ant-table-row-error';
              }}
            />
          </div>

          <Row justify="end" style={{ marginTop: 16 }} gutter={8}>
            <Col>
              <Button onClick={reset}>Back</Button>
            </Col>
            <Col>
              <Button
                type="primary"
                loading={importing}
                disabled={validCount === 0}
                onClick={handleImport}
                icon={<UploadOutlined />}
              >
                Import {validCount} Valid Student{validCount !== 1 ? 's' : ''}
              </Button>
            </Col>
          </Row>
        </div>
      )}

      {/* STEP 2 — Result */}
      {step === STEP_RESULT && importResult && (
        <div>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            {[
              { label: 'Created', value: importResult.created, color: '#22C55E', icon: <CheckCircleOutlined /> },
              { label: 'Skipped', value: importResult.skipped, color: '#F59E0B', icon: <WarningOutlined /> },
              { label: 'Failed', value: importResult.failed, color: '#EF4444', icon: <CloseCircleOutlined /> },
            ].map(s => (
              <Col key={s.label} span={8}>
                <Card size="small" bordered={false} style={{ background: '#F8FAFC', borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>{s.icon} {s.label}</div>
                </Card>
              </Col>
            ))}
          </Row>

          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            <Table
              columns={resultColumns}
              dataSource={importResult.results || []}
              rowKey="row"
              pagination={false}
              size="small"
              scroll={{ x: 600 }}
              rowClassName={r => r.status === 'created' ? '' : r.status === 'skipped' ? 'ant-table-row-warning' : 'ant-table-row-error'}
            />
          </div>

          <Row justify="end" style={{ marginTop: 16 }} gutter={8}>
            <Col>
              <Button onClick={reset}>Import Another File</Button>
            </Col>
            <Col>
              <Button type="primary" onClick={onImportComplete}>
                Done — View Students
              </Button>
            </Col>
          </Row>
        </div>
      )}
    </Modal>
  );
};


export default Students;
