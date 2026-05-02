import React, { useState, useEffect } from 'react';
import {
  Modal, Form, Input, InputNumber, Select, DatePicker,
  App, Table, Typography, Divider,
} from 'antd';
import { examAPI, schoolAPI } from '@/services/api';

const { Text } = Typography;

/**
 * CreateExamModal — per-subject maxMarks + passingMarks.
 * Loads subjects from ClassConfig when class is selected.
 */
const CreateExamModal = ({ open, onClose, onSuccess }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [classes, setClasses] = useState([]);

  // per-subject config: { [subjectId]: { maxMarks, passingMarks } }
  const [subjects, setSubjects] = useState([]); // available subjects for selected class
  const [subjectMarks, setSubjectMarks] = useState({}); // per-subject marks config
  const [selectedSubjectIds, setSelectedSubjectIds] = useState([]);

  // ─── Load classes on open ─────────────────────────────────
  useEffect(() => {
    if (!open) return;
    schoolAPI.getClasses({ limit: 50 })
      .then((res) => setClasses(res.data || []))
      .catch(() => {});
    // Reset state when reopened
    setSubjects([]);
    setSubjectMarks({});
    setSelectedSubjectIds([]);
  }, [open]);

  // ─── Load subjects when class changes ─────────────────────
  const handleClassChange = async (classId) => {
    setSubjects([]);
    setSubjectMarks({});
    setSelectedSubjectIds([]);
    form.setFieldValue('subjectIds', undefined);
    if (!classId) return;
    try {
      const res = await examAPI.getSubjectsForClass(classId);
      setSubjects(res.data || []);
    } catch {
      // fall back to all subjects
      try {
        const res = await schoolAPI.getSubjects({ limit: 100 });
        setSubjects(res.data || []);
      } catch { /* */ }
    }
  };

  // ─── When subjects are selected, initialize marks config ──
  const handleSubjectSelect = (selectedIds) => {
    setSelectedSubjectIds(selectedIds);
    const globalMax = form.getFieldValue('globalMaxMarks') || 100;
    const globalPassing = form.getFieldValue('globalPassingMarks') || 35;
    setSubjectMarks((prev) => {
      const next = { ...prev };
      selectedIds.forEach((id) => {
        if (!next[id]) {
          next[id] = { maxMarks: globalMax, passingMarks: globalPassing };
        }
      });
      return next;
    });
  };

  // ─── Update a single subject's marks ──────────────────────
  const updateSubjectMark = (subjectId, field, value) => {
    setSubjectMarks((prev) => ({
      ...prev,
      [subjectId]: { ...prev[subjectId], [field]: value },
    }));
  };

  // ─── Apply global defaults to all selected subjects ───────
  const applyGlobalToAll = () => {
    const globalMax = form.getFieldValue('globalMaxMarks') || 100;
    const globalPassing = form.getFieldValue('globalPassingMarks') || 35;
    const next = {};
    selectedSubjectIds.forEach((id) => {
      next[id] = { maxMarks: globalMax, passingMarks: globalPassing };
    });
    setSubjectMarks(next);
  };

  // ─── Submit ───────────────────────────────────────────────
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (!selectedSubjectIds.length) {
        message.warning('Select at least one subject');
        return;
      }
      setSubmitting(true);

      const subjectsPayload = selectedSubjectIds.map((id) => ({
        subjectId: id,
        maxMarks: subjectMarks[id]?.maxMarks || values.globalMaxMarks || 100,
        passingMarks: subjectMarks[id]?.passingMarks ?? values.globalPassingMarks ?? 35,
      }));

      await examAPI.create({
        name: values.name,
        classId: values.classId,
        academicYearId: values.academicYearId || undefined,
        subjects: subjectsPayload,
        examDate: values.examDate ? values.examDate.toISOString() : null,
      });

      message.success('Exam created successfully');
      form.resetFields();
      setSubjects([]);
      setSubjectMarks({});
      setSelectedSubjectIds([]);
      onSuccess?.();
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.message || 'Failed to create exam');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Per-subject marks table ──────────────────────────────
  const selectedSubjects = subjects.filter((s) => selectedSubjectIds.includes(s._id));
  const subjectTableCols = [
    {
      title: 'Subject',
      dataIndex: 'name',
      key: 'name',
      render: (name, s) => <Text strong>{name} <Text type="secondary" style={{ fontSize: 11 }}>({s.code})</Text></Text>,
    },
    {
      title: 'Max Marks',
      key: 'maxMarks',
      width: 120,
      render: (_, s) => (
        <InputNumber
          min={1}
          size="small"
          value={subjectMarks[s._id]?.maxMarks ?? 100}
          onChange={(val) => updateSubjectMark(s._id, 'maxMarks', val)}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: 'Passing Marks',
      key: 'passingMarks',
      width: 120,
      render: (_, s) => (
        <InputNumber
          min={0}
          size="small"
          value={subjectMarks[s._id]?.passingMarks ?? 35}
          onChange={(val) => updateSubjectMark(s._id, 'passingMarks', val)}
          style={{ width: '100%' }}
        />
      ),
    },
  ];

  return (
    <Modal
      title="Create Exam"
      open={open}
      onCancel={() => { form.resetFields(); setSubjects([]); setSubjectMarks({}); setSelectedSubjectIds([]); onClose?.(); }}
      onOk={handleSubmit}
      okText="Create Exam"
      okButtonProps={{ loading: submitting, disabled: submitting, id: 'create-exam-submit' }}
      destroyOnHidden
      maskClosable={false}
      width={620}
    >
      <Form form={form} layout="vertical" requiredMark="optional" style={{ marginTop: 16 }}>
        <Form.Item name="name" label="Exam Name" rules={[{ required: true, message: 'Enter exam name' }]}>
          <Input placeholder="e.g. Mid Term, Final Exam" id="exam-name-input" />
        </Form.Item>

        <Form.Item name="classId" label="Class" rules={[{ required: true, message: 'Select class' }]}>
          <Select
            placeholder="Select class"
            options={classes.map((c) => ({ label: c.name, value: c._id }))}
            onChange={handleClassChange}
            id="exam-class-select"
          />
        </Form.Item>

        <Form.Item name="examDate" label="Exam Date">
          <DatePicker style={{ width: '100%' }} format="DD-MM-YYYY" id="exam-date-picker" />
        </Form.Item>

        {/* Global defaults — applied when selecting subjects */}
        <Divider orientation="left" orientationMargin={0} style={{ fontSize: 12, marginTop: 4 }}>
          Default Marks (applied to each subject)
        </Divider>
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <Form.Item name="globalMaxMarks" label="Max Marks" style={{ flex: 1, marginBottom: 0 }} initialValue={100}>
            <InputNumber min={1} style={{ width: '100%' }} onChange={applyGlobalToAll} />
          </Form.Item>
          <Form.Item name="globalPassingMarks" label="Passing Marks" style={{ flex: 1, marginBottom: 0 }} initialValue={35}>
            <InputNumber min={0} style={{ width: '100%' }} onChange={applyGlobalToAll} />
          </Form.Item>
        </div>

        <Form.Item name="subjectIds" label="Subjects" rules={[{ required: false }]}>
          <Select
            mode="multiple"
            placeholder={subjects.length ? 'Select subjects' : 'Select a class first'}
            options={subjects.map((s) => ({ label: `${s.name} (${s.code})`, value: s._id }))}
            onChange={handleSubjectSelect}
            disabled={!subjects.length}
            optionFilterProp="label"
            showSearch
            id="exam-subjects-select"
          />
        </Form.Item>

        {/* Per-subject marks config */}
        {selectedSubjects.length > 0 && (
          <>
            <Divider orientation="left" orientationMargin={0} style={{ fontSize: 12, marginTop: 4 }}>
              Per-Subject Marks Configuration
            </Divider>
            <Table
              dataSource={selectedSubjects}
              columns={subjectTableCols}
              rowKey="_id"
              pagination={false}
              size="small"
              bordered
              style={{ marginBottom: 8 }}
            />
          </>
        )}
      </Form>
    </Modal>
  );
};

export default CreateExamModal;
