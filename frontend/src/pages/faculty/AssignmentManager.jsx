import React, { useEffect, useState, useCallback } from 'react';
import {
  Table, Button, Modal, Form, Input, DatePicker, Select,
  InputNumber, Tag, Space, App, Tabs, Descriptions, Badge,
  Upload, Typography, Empty, Tooltip, Popconfirm,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  FileTextOutlined, CheckCircleOutlined, UploadOutlined, EyeOutlined,
} from '@ant-design/icons';
import { assignmentAPI, subjectAPI, uploadAPI } from '@/services/api';
import useAuthStore from '@/store/authStore';
import dayjs from 'dayjs';
import FacultyLayout from '../../components/mobile/FacultyLayout';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const STATUS_COLOR = {
  pending: 'default',
  submitted: 'blue',
  graded: 'green',
  late: 'orange',
};

const AssignmentManager = () => {
  const { message } = App.useApp();
  const user = useAuthStore((s) => s.user);
  const isAdmin = ['admin', 'super_admin'].includes(user?.role);
  const isFaculty = user?.role === 'faculty' || isAdmin;

  const [assignments, setAssignments] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  // Filters
  const [filterClass, setFilterClass] = useState(null);
  const [filterSubject, setFilterSubject] = useState(null);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  // Submissions modal
  const [subModal, setSubModal] = useState(false);
  const [selAssignment, setSelAssignment] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [subLoading, setSubLoading] = useState(false);

  // Grade modal
  const [gradeModal, setGradeModal] = useState(false);
  const [gradeSub, setGradeSub] = useState(null);
  const [gradeForm] = Form.useForm();
  const [gradeSaving, setGradeSaving] = useState(false);

  // Fetch classes for filter
  useEffect(() => {
    import('@/services/api').then(({ facultyDashboardAPI, schoolAPI }) => {
      if (isFaculty && !isAdmin) {
        facultyDashboardAPI.getDashboard().then((r) => {
          const cl = r?.data?.faculty?.assignedClasses || [];
          setClasses(cl.map((c) => ({ value: c._id, label: c.name })));
        }).catch(() => { });
      } else {
        schoolAPI.getClasses().then((r) => {
          const list = r?.data?.classes || r?.data || [];
          setClasses(list.map((c) => ({ value: c._id, label: c.name })));
        }).catch(() => { });
      }
    });
  }, []);

  useEffect(() => {
    if (filterClass) {
      subjectAPI.getAll({ classId: filterClass }).then((r) => {
        const list = r?.data?.subjects || r?.data || [];
        setSubjects(list.map((s) => ({ value: s._id, label: `${s.name} (${s.code || ''})` })));
      }).catch(() => { });
    }
  }, [filterClass]);

  const fetchAssignments = useCallback(() => {
    setLoading(true);
    const params = { page, limit: 15 };
    if (filterClass) params.classId = filterClass;
    if (filterSubject) params.subjectId = filterSubject;
    assignmentAPI.getAll(params).then((r) => {
      const d = r?.data || {};
      setAssignments(Array.isArray(d) ? d : d.assignments || []);
      setTotal(d.total || 0);
    }).catch(() => message.error('Failed to load assignments'))
      .finally(() => setLoading(false));
  }, [page, filterClass, filterSubject]);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

  const openCreate = () => {
    setEditRecord(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (rec) => {
    setEditRecord(rec);
    form.setFieldsValue({
      title: rec.title,
      description: rec.description,
      classId: rec.classId?._id || rec.classId,
      subjectId: rec.subjectId?._id || rec.subjectId,
      dueDate: rec.dueDate ? dayjs(rec.dueDate) : null,
      maxMarks: rec.maxMarks,
    });
    // Load subjects for the class
    subjectAPI.getAll({ classId: rec.classId?._id || rec.classId }).then((r) => {
      setSubjects((r?.data?.subjects || r?.data || []).map((s) => ({ value: s._id, label: `${s.name}` })));
    }).catch(() => { });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = {
        ...values,
        dueDate: values.dueDate?.toISOString(),
      };
      if (editRecord) {
        await assignmentAPI.update(editRecord._id, payload);
        message.success('Assignment updated');
      } else {
        await assignmentAPI.create(payload);
        message.success('Assignment created — students notified');
      }
      setModalOpen(false);
      fetchAssignments();
    } catch (e) {
      if (e?.message) message.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await assignmentAPI.remove(id);
      message.success('Assignment deleted');
      fetchAssignments();
    } catch (e) { message.error(e.message || 'Delete failed'); }
  };

  const openSubmissions = (rec) => {
    setSelAssignment(rec);
    setSubModal(true);
    setSubLoading(true);
    assignmentAPI.getSubmissions(rec._id).then((r) => {
      setSubmissions(Array.isArray(r?.data) ? r.data : []);
    }).catch(() => { }).finally(() => setSubLoading(false));
  };

  const openGrade = (sub) => {
    setGradeSub(sub);
    gradeForm.setFieldsValue({ marks: sub.marks, feedback: sub.feedback });
    setGradeModal(true);
  };

  const handleGrade = async () => {
    try {
      const values = await gradeForm.validateFields();
      setGradeSaving(true);
      await assignmentAPI.grade(selAssignment._id, {
        studentId: gradeSub.studentId?._id || gradeSub.studentId,
        marks: values.marks,
        feedback: values.feedback || '',
      });
      message.success('Graded successfully');
      setGradeModal(false);
      // Refresh submissions
      assignmentAPI.getSubmissions(selAssignment._id).then((r) => {
        setSubmissions(Array.isArray(r?.data) ? r.data : []);
      }).catch(() => { });
    } catch (e) { if (e?.message) message.error(e.message); }
    finally { setGradeSaving(false); }
  };

  const columns = [
    {
      title: 'Title', dataIndex: 'title', key: 'title',
      render: (v, r) => <a onClick={() => openSubmissions(r)}>{v}</a>,
    },
    { title: 'Class', key: 'class', render: (_, r) => r.classId?.name || '—' },
    { title: 'Subject', key: 'sub', render: (_, r) => r.subjectId?.name || '—' },
    {
      title: 'Due Date', key: 'due',
      render: (_, r) => {
        const past = dayjs(r.dueDate).isBefore(dayjs());
        return <span style={{ color: past ? '#DC2626' : '#0F172A' }}>{dayjs(r.dueDate).format('DD MMM YYYY')}</span>;
      },
    },
    { title: 'Max Marks', dataIndex: 'maxMarks', key: 'mm', width: 100 },
    {
      title: 'Actions', key: 'actions',
      render: (_, r) => (
        <Space>
          <Tooltip title="View Submissions">
            <Button icon={<EyeOutlined />} size="small" onClick={() => openSubmissions(r)} />
          </Tooltip>
          {isFaculty && (
            <>
              <Tooltip title="Edit">
                <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(r)} />
              </Tooltip>
              <Popconfirm title="Delete this assignment?" onConfirm={() => handleDelete(r._id)} okText="Yes">
                <Button icon={<DeleteOutlined />} size="small" danger />
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  const subColumns = [
    { title: 'Student', key: 'stu', render: (_, r) => r.studentId?.name || r.studentId },
    { title: 'Roll No', key: 'roll', render: (_, r) => r.studentId?.rollNo || '—' },
    { title: 'Submitted', key: 'at', render: (_, r) => r.submittedAt ? dayjs(r.submittedAt).format('DD MMM, HH:mm') : '—' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (v) => <Tag color={STATUS_COLOR[v]}>{v}</Tag> },
    { title: 'Marks', dataIndex: 'marks', key: 'marks', render: (v) => v ?? '—' },
    {
      title: 'Action', key: 'act',
      render: (_, r) => isFaculty && (
        <Button size="small" icon={<CheckCircleOutlined />} type="primary" ghost onClick={() => openGrade(r)}>
          Grade
        </Button>
      ),
    },
  ];

  return (
    <FacultyLayout title="Assignment" >
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '0 12px' }}>

        {/* Header */}
        <div style={{ marginBottom: 16 }}>
          <Title level={4} style={{ marginBottom: 10 }}>
            <FileTextOutlined /> Assignments
          </Title>

          {isFaculty && (
            <Button
              type="primary"
              block
              icon={<PlusOutlined />}
              onClick={openCreate}
            >
              New Assignment
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="m-card" style={{ marginBottom: 12 }}>
          <div className="m-form-group">
            <label className="m-label">Class</label>
            <Select
              style={{ width: '100%' }}
              options={classes}
              onChange={(v) => { setFilterClass(v); setPage(1); }}
            />
          </div>

          <div className="m-form-group">
            <label className="m-label">Subject</label>
            <Select
              style={{ width: '100%' }}
              options={subjects}
              disabled={!filterClass}
              onChange={(v) => { setFilterSubject(v); setPage(1); }}
            />
          </div>
        </div>

        {/* Table (fixed overflow) */}
        <div style={{ overflowX: 'auto' }}>
          <Table
            dataSource={assignments}
            columns={columns}
            rowKey="_id"
            loading={loading}
            pagination={{ current: page, pageSize: 10, total, onChange: setPage }}
            size="small"
          />
        </div>

        {/* Create/Edit Modal */}
        <Modal
          open={modalOpen}
          title={editRecord ? 'Edit Assignment' : 'New Assignment'}
          onCancel={() => setModalOpen(false)}
          onOk={handleSave}
          confirmLoading={saving}
          okText={editRecord ? 'Update' : 'Create'}
          width={560}
          destroyOnHidden
        >
          <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
            <Form.Item name="title" label="Title" rules={[{ required: true }]}>
              <Input placeholder="Assignment title" id="assignment-title-input" />
            </Form.Item>
            <Form.Item name="description" label="Description">
              <TextArea rows={3} placeholder="Instructions for students..." />
            </Form.Item>
            <Row gutter={12} style={{ display: 'flex' }}>
              <Form.Item name="classId" label="Class" style={{ flex: 1 }} rules={[{ required: true }]}>
                <Select
                  placeholder="Select class" options={classes}
                  onChange={(v) => {
                    form.setFieldValue('subjectId', undefined);
                    subjectAPI.getAll({ classId: v }).then((r) => {
                      setSubjects((r?.data?.subjects || r?.data || []).map((s) => ({ value: s._id, label: s.name })));
                    }).catch(() => { });
                  }}
                  id="assignment-class-select"
                />
              </Form.Item>
              <Form.Item name="subjectId" label="Subject" style={{ flex: 1 }} rules={[{ required: true }]}>
                <Select placeholder="Select subject" options={subjects} id="assignment-subject-select" />
              </Form.Item>
            </Row>
            <Row gutter={12} style={{ display: 'flex' }}>
              <Form.Item name="dueDate" label="Due Date" style={{ flex: 1 }} rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} disabledDate={(d) => d.isBefore(dayjs().startOf('day'))} />
              </Form.Item>
              <Form.Item name="maxMarks" label="Max Marks" style={{ flex: 1 }} initialValue={100}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Row>
          </Form>
        </Modal>

        {/* Submissions Modal */}
        <Modal
          open={subModal}
          title={`Submissions — ${selAssignment?.title || ''}`}
          onCancel={() => setSubModal(false)}
          footer={null}
          width={760}
          destroyOnHidden
        >
          <Table
            dataSource={submissions}
            columns={subColumns}
            rowKey="_id"
            loading={subLoading}
            size="small"
            pagination={{ pageSize: 10 }}
          />
        </Modal>

        {/* Grade Modal */}
        <Modal
          open={gradeModal}
          title={`Grade — ${gradeSub?.studentId?.name || 'Student'}`}
          onCancel={() => setGradeModal(false)}
          onOk={handleGrade}
          confirmLoading={gradeSaving}
          okText="Save Grade"
          width={400}
          destroyOnHidden
        >
          <Form form={gradeForm} layout="vertical" style={{ marginTop: 8 }}>
            <Form.Item name="marks" label={`Marks (max ${selAssignment?.maxMarks || 100})`} rules={[{ required: true }]}>
              <InputNumber min={0} max={selAssignment?.maxMarks || 100} style={{ width: '100%' }} id="grade-marks-input" />
            </Form.Item>
            <Form.Item name="feedback" label="Feedback">
              <TextArea rows={3} placeholder="Optional feedback..." />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </FacultyLayout>

  );
};

// Wrap in a named Row import to avoid JSX issues
const Row = ({ gutter, style, children }) => <div style={{ display: 'flex', gap: (gutter || [0])[0] || gutter || 0, ...style }}>{children}</div>;

export default AssignmentManager;
