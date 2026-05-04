import React, { useEffect, useState, useCallback } from 'react';
import {
  Table, Button, Modal, Form, Select, Tag, Space,
  Typography, Tooltip, Alert, message, Badge, Row, Col, Card,
} from 'antd';
import {
  PlusOutlined, EditOutlined, SettingOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import { setupAPI, schoolAPI, subjectAPI } from '@/services/api';

const { Title, Text } = Typography;

// ─── Helper: safely extract list from various response shapes ─
const extractList = (res) => {
  if (!res) return [];
  if (Array.isArray(res))         return res;
  if (Array.isArray(res.data))    return res.data;
  return [];
};

const ClassConfig = () => {
  const [configs,      setConfigs]      = useState([]);
  const [classes,      setClasses]      = useState([]);
  const [sections,     setSections]     = useState([]);
  const [subjects,     setSubjects]     = useState([]);
  const [years,        setYears]        = useState([]);
  const [activeYear,   setActiveYear]   = useState(null);

  const [loading,      setLoading]      = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [modalOpen,    setModalOpen]    = useState(false);
  const [editRecord,   setEditRecord]   = useState(null);

  // Sections filtered by selected class inside modal
  const [filteredSections, setFilteredSections] = useState([]);

  const [form] = Form.useForm();

  // ─── Boot: load reference data ──────────────────────────────
  useEffect(() => {
    // Load classes, all sections, all subjects, academic years in parallel
    Promise.all([
      schoolAPI.getClasses({ limit: 200 }),
      schoolAPI.getSections({ limit: 500 }),
      subjectAPI.getAll({ limit: 500, isActive: 'true' }),
      setupAPI.getAcademicYears(),
      setupAPI.getActiveYear().catch(() => null),
    ])
      .then(([cls, sec, sub, yrs, ay]) => {
        setClasses(extractList(cls));
        setSections(extractList(sec));
        setSubjects(extractList(sub));
        setYears(extractList(yrs));
        if (ay?.data || ay) setActiveYear(ay?.data || ay);
      })
      .catch((e) => message.error(e.message));
  }, []);

  // ─── Load configs whenever active year is known ──────────────
  const loadConfigs = useCallback((yearId) => {
    if (!yearId) return;
    setLoading(true);
    setupAPI
      .getClassConfigs({ academicYearId: yearId })
      .then((res) => setConfigs(extractList(res)))
      .catch((e) => message.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeYear?._id) loadConfigs(activeYear._id);
  }, [activeYear, loadConfigs]);

  // ─── Year switcher in header ─────────────────────────────────
  const handleYearChange = (yearId) => {
    const y = years.find((y) => y._id === yearId);
    setActiveYear(y || null);
  };

  // ─── When class changes in modal, filter sections ────────────
  const handleClassChange = (classId) => {
    const filtered = sections.filter(
      (s) => (s.classId?._id || s.classId) === classId
    );
    setFilteredSections(filtered);
    form.setFieldValue('sections', []);
  };

  // ─── Open modal ──────────────────────────────────────────────
  const openCreate = () => {
    setEditRecord(null);
    setFilteredSections([]);
    form.resetFields();
    if (activeYear?._id) form.setFieldValue('academicYearId', activeYear._id);
    setModalOpen(true);
  };

  const openEdit = (record) => {
    setEditRecord(record);

    const classId = record.classId?._id || record.classId;
    const filtered = sections.filter(
      (s) => (s.classId?._id || s.classId) === classId
    );
    setFilteredSections(filtered);

    form.setFieldsValue({
      classId,
      academicYearId: record.academicYearId?._id || record.academicYearId || activeYear?._id,
      sections: record.sections?.map((s) => s._id || s) || [],
      subjects: record.subjects?.map((s) => s._id || s) || [],
    });
    setModalOpen(true);
  };

  // ─── Submit ──────────────────────────────────────────────────
  const onFinish = async (values) => {
    if (!values.subjects?.length) {
      message.error('Select at least one subject');
      return;
    }
    if (!values.sections?.length) {
      message.error('Select at least one section');
      return;
    }

    setSaving(true);
    try {
      await setupAPI.saveClassConfig({
        academicYearId: values.academicYearId || activeYear?._id,
        classId:        values.classId,
        sections:       values.sections,
        subjects:       values.subjects,
      });
      message.success(editRecord ? 'Class Config updated' : 'Class Config saved');
      setModalOpen(false);
      form.resetFields();
      loadConfigs(values.academicYearId || activeYear?._id);
    } catch (e) {
      message.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  // ─── Table columns ───────────────────────────────────────────
  const columns = [
    {
      title: 'Class',
      render: (_, r) => <Text strong>{r.classId?.name || r.classId}</Text>,
      sorter: (a, b) => (a.classId?.name || '').localeCompare(b.classId?.name || ''),
    },
    {
      title: 'Sections',
      render: (_, r) => (
        <Space size={4} wrap>
          {(r.sections || []).length
            ? r.sections.map((s) => <Tag key={s._id || s} color="geekblue">{s.name || s}</Tag>)
            : <Text type="secondary">—</Text>}
        </Space>
      ),
    },
    {
      title: 'Subjects',
      render: (_, r) => (
        <Space size={4} wrap>
          {(r.subjects || []).length
            ? r.subjects.map((s) => (
                <Tag key={s._id || s} color="blue">
                  {s.code || s}
                  {s.isOptional ? <sup style={{ fontSize: 9, marginLeft: 2, color: '#8B5CF6' }}>opt</sup> : null}
                </Tag>
              ))
            : <Text type="secondary">—</Text>}
        </Space>
      ),
    },
    {
      title: 'Status',
      render: (_, r) => {
        const hasSubjects = (r.subjects || []).length > 0;
        const hasSections = (r.sections || []).length > 0;
        if (hasSubjects && hasSections) {
          return <Badge status="success" text="Configured" />;
        }
        return <Badge status="warning" text="Incomplete" />;
      },
    },
    {
      title: '',
      width: 80,
      render: (_, record) => (
        <Tooltip title="Edit Config">
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
        </Tooltip>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            <SettingOutlined style={{ marginRight: 8, color: '#6366F1' }} />
            Class Configuration
          </Title>
          <Text type="secondary">Assign subjects and sections to each class per academic year</Text>
        </div>
        <Space>
          <Select
            style={{ width: 160 }}
            value={activeYear?._id}
            onChange={handleYearChange}
            placeholder="Select year"
          >
            {years.map((y) => (
              <Select.Option key={y._id} value={y._id}>
                {y.name}{y.isActive ? ' ✓' : ''}
              </Select.Option>
            ))}
          </Select>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            New Config
          </Button>
        </Space>
      </div>

      {/* ── Info banner ── */}
      {!activeYear && (
        <Alert
          type="warning"
          message="No active academic year found. Please create one in Academic Year setup."
          style={{ marginBottom: 16 }}
          showIcon
        />
      )}

      {/* ── Stats ── */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={6}>
          <Card size="small" styles={{ body: { padding: '12px 16px' } }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Configured Classes</Text>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{configs.length}</div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" styles={{ body: { padding: '12px 16px' } }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Total Subjects Assigned</Text>
            <div style={{ fontSize: 24, fontWeight: 700 }}>
              {configs.reduce((acc, c) => acc + (c.subjects?.length || 0), 0)}
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" styles={{ body: { padding: '12px 16px' } }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Incomplete Configs</Text>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#F59E0B' }}>
              {configs.filter((c) => !(c.subjects?.length && c.sections?.length)).length}
            </div>
          </Card>
        </Col>
      </Row>

      {/* ── Table ── */}
      <Table
        rowKey="_id"
        columns={columns}
        dataSource={configs}
        loading={loading}
        pagination={{ pageSize: 20 }}
        scroll={{ x: 700 }}
        size="middle"
      />

      {/* ── Create/Edit Modal ── */}
      <Modal
        title={editRecord ? 'Edit Class Configuration' : 'New Class Configuration'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        footer={null}
        destroyOnHidden
        width={580}
      >
        <Alert
          type="info"
          message="ClassConfig is the source of truth. Subjects and sections set here will be used across Exams, Attendance, and Faculty assignment."
          style={{ marginBottom: 16 }}
          showIcon
          icon={<CheckCircleOutlined />}
        />

        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
        >
          {/* Academic Year — hidden when pre-filled */}
          <Form.Item
            label="Academic Year"
            name="academicYearId"
            rules={[{ required: true, message: 'Academic year is required' }]}
          >
            <Select placeholder="Select academic year">
              {years.map((y) => (
                <Select.Option key={y._id} value={y._id}>
                  {y.name}{y.isActive ? ' (Active)' : ''}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="Class"
            name="classId"
            rules={[{ required: true, message: 'Class is required' }]}
          >
            <Select
              placeholder="Select class"
              onChange={handleClassChange}
              disabled={!!editRecord}
            >
              {classes.map((c) => (
                <Select.Option key={c._id} value={c._id}>{c.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="Sections"
            name="sections"
            rules={[{ required: true, message: 'At least one section is required', type: 'array', min: 1 }]}
            extra={filteredSections.length === 0 ? 'Select a class first' : `${filteredSections.length} section(s) available`}
          >
            <Select
              mode="multiple"
              placeholder="Select sections"
              disabled={filteredSections.length === 0}
              showSearch
              optionFilterProp="children"
            >
              {filteredSections.map((s) => (
                <Select.Option key={s._id} value={s._id}>{s.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="Subjects"
            name="subjects"
            rules={[{ required: true, message: 'At least one subject is required', type: 'array', min: 1 }]}
            extra={`${subjects.length} subject(s) available`}
          >
            <Select
              mode="multiple"
              placeholder="Select subjects for this class"
              showSearch
              optionFilterProp="children"
            >
              {subjects.map((s) => (
                <Select.Option key={s._id} value={s._id}>
                  {s.name} <Text type="secondary">({s.code})</Text>
                  {s.isOptional ? <Text type="secondary"> — optional</Text> : null}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => { setModalOpen(false); form.resetFields(); }}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={saving}>
                {editRecord ? 'Save Changes' : 'Create Config'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ClassConfig;
