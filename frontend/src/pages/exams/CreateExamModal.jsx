import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal, Form, InputNumber, Select, DatePicker, App, Row, Col,
} from 'antd';
import dayjs from 'dayjs';
import { examAPI, schoolAPI } from '@/services/api';

// ── School canonical exam names (used by the marks card PDF) ────────────────
// ONLY these 5 names appear correctly in the Progress Report.
const SCHOOL_EXAM_OPTIONS = [
  { label: '📋 Periodic Test  (/10)', value: 'Periodic Test' },
  { label: '📓 Notebook  (/5)', value: 'Notebook' },
  { label: '🔬 SEA  (/5)', value: 'SEA' },
  { label: '📝 Half Yearly Examination  (Term 1 · /80)', value: 'Half Yearly Examination' },
  { label: '📝 Yearly Examination  (Term 2 · /80)', value: 'Yearly Examination' },
];

// Canonical rules: maxMarks + passing + auto-term (null = user must pick).
const EXAM_RULES = {
  'Periodic Test':          { maxMarks: 10, passingMarks: 4,  autoTerm: null },
  'Notebook':               { maxMarks: 5,  passingMarks: 2,  autoTerm: null },
  'SEA':                    { maxMarks: 5,  passingMarks: 2,  autoTerm: null },
  'Half Yearly Examination':{ maxMarks: 80, passingMarks: 27, autoTerm: 'term1' },
  'Yearly Examination':     { maxMarks: 80, passingMarks: 27, autoTerm: 'term2' },
};

const TERM_OPTIONS = [
  { label: '📄 Term 1  (Jan – Jun)', value: 'term1' },
  { label: '📄 Term 2  (Jul – Dec)', value: 'term2' },
];

const { RangePicker } = DatePicker;

/**
 * CreateExamModal — create OR edit an exam.
 *
 * Props:
 *  open       : boolean
 *  editRecord : exam object | null   (null = create mode)
 *  onClose    : () => void
 *  onSuccess  : () => void
 */
const CreateExamModal = ({ open, editRecord, onClose, onSuccess }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  // Track whether a canonical name is selected so we can lock the marks fields
  const [canonicalRule, setCanonicalRule] = useState(null);

  const isEdit = !!(editRecord?._id);

  // ── Load classes ─────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    schoolAPI.getClasses({ limit: 50 })
      .then((res) => {
        const list = res?.data?.classes || res?.data || res || [];
        setClasses(Array.isArray(list) ? list : []);
      })
      .catch(() => { });
  }, [open]);

  // ── Load subjects for a given classId ────────────────────
  const loadSubjectsForClass = useCallback(async (classId) => {
    if (!classId) { setSubjects([]); return; }
    setLoadingSubjects(true);
    try {
      const res = await examAPI.getSubjectsForClass(classId);
      // API interceptor unwraps to res.data (the { success, data } wrapper)
      // so we try both shapes:
      const list = res?.data || res || [];
      setSubjects(Array.isArray(list) ? list : []);
    } catch {
      setSubjects([]);
    } finally {
      setLoadingSubjects(false);
    }
  }, []);

  // ── Populate form on open ─────────────────────────────────
  useEffect(() => {
    if (!open) {
      form.resetFields();
      setSubjects([]);
      return;
    }

    if (isEdit && editRecord) {
      const classId = editRecord.classId?._id || editRecord.classId;

      // Load subjects first, then set form values so multi-select options exist
      loadSubjectsForClass(classId).then(() => {
        const start = editRecord.startDate ? dayjs(editRecord.startDate) : null;
        const end = editRecord.endDate ? dayjs(editRecord.endDate) : null;
        const name = editRecord.examName || editRecord.name;

        form.setFieldsValue({
          examName: name,
          term: editRecord.term || undefined,
          classId,
          dateRange: start ? [start, end || null] : undefined,
          maxMarks: editRecord.maxMarks ?? 100,
          passingMarks: editRecord.passingMarks ?? 35,
          subjects: (editRecord.subjects || []).map((s) => s?._id?.toString() || s?.toString?.() || s),
        });
        // Restore lock state for canonical names in edit mode
        setCanonicalRule(EXAM_RULES[name] || null);
      });
    } else {
      // Create mode — clean slate
      form.resetFields();
      form.setFieldsValue({ maxMarks: 100, passingMarks: 35 });
      setSubjects([]);
      setCanonicalRule(null);
    }
  }, [open, editRecord, isEdit, form, loadSubjectsForClass]);

  // ── Class selector change ─────────────────────────────────
  const handleClassChange = (classId) => {
    form.setFieldValue('subjects', undefined);
    loadSubjectsForClass(classId);
  };

  // ── Exam name change: auto-fill + lock marks + auto-set term ────────────
  const handleExamNameChange = (value) => {
    const rule = EXAM_RULES[value] || null;
    setCanonicalRule(rule);
    if (rule) {
      form.setFieldsValue({ maxMarks: rule.maxMarks, passingMarks: rule.passingMarks });
      // Auto-lock term for HY (term1) and YE (term2); clear it for PT/NB/SEA so user picks
      if (rule.autoTerm) {
        form.setFieldValue('term', rule.autoTerm);
      } else {
        form.setFieldValue('term', undefined);
      }
    } else {
      // Non-canonical name selected (or cleared) — also clear term
      form.setFieldValue('term', undefined);
    }
  };

  // ── Submit ────────────────────────────────────────────────
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const [startDate, endDate] = values.dateRange
        ? [
          values.dateRange[0]?.toISOString() ?? null,
          values.dateRange[1]?.toISOString() ?? null,
        ]
        : [null, null];

      const payload = {
        examName: values.examName,
        term: values.term || undefined,
        classId: values.classId,
        maxMarks: values.maxMarks,
        passingMarks: values.passingMarks ?? 35,
        subjects: values.subjects || [],
        startDate,
        endDate,
      };

      if (isEdit) {
        await examAPI.update(editRecord._id, payload);
        message.success('Exam updated');
      } else {
        await examAPI.create(payload);
        message.success('Exam created');
      }

      form.resetFields();
      setSubjects([]);
      onSuccess?.();
    } catch (err) {
      if (err.errorFields) return;   // Ant Design inline validation
      message.error(err.message || 'Failed to save exam');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setSubjects([]);
    onClose?.();
  };

  return (
    <Modal
      title={isEdit ? `Edit Exam — ${editRecord?.examName || editRecord?.name || ''}` : 'Create Exam'}
      open={open}
      onCancel={handleCancel}
      onOk={handleSubmit}
      okText={isEdit ? 'Save Changes' : 'Create Exam'}
      okButtonProps={{ loading: submitting, id: 'exam-modal-submit' }}
      cancelButtonProps={{ id: 'exam-modal-cancel' }}
      destroyOnHidden
      maskClosable={false}
      width={520}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark="optional"
        style={{ marginTop: 16 }}
      >
        {/* Exam Name — locked to school canonical names */}
        <Form.Item
          name="examName"
          label="Exam Name"
          rules={[{ required: true, message: 'Select an exam component' }]}
          extra={
            canonicalRule
              ? <span style={{ fontSize: 11, color: '#16a34a' }}>
                  ✅ Max marks auto-set to <strong>{canonicalRule.maxMarks}</strong> and locked.
                  Appears in the <strong>CBSE Progress Report</strong>.
                </span>
              : <span style={{ fontSize: 11, color: '#6b7280' }}>
                  Only these 5 names appear in the marks card PDF.
                </span>
          }
        >
          <Select
            placeholder="Select exam component…"
            id="exam-name-input"
            options={SCHOOL_EXAM_OPTIONS}
            onChange={handleExamNameChange}
            allowClear
          />
        </Form.Item>

        {/* Term — required for marks card column placement */}
        <Form.Item
          name="term"
          label="Term"
          rules={[{ required: true, message: 'Select a term (Term 1 or Term 2)' }]}
          extra={
            canonicalRule?.autoTerm
              ? <span style={{ fontSize: 11, color: '#16a34a' }}>
                  🔒 Auto-set: <strong>{canonicalRule.autoTerm === 'term1' ? 'Term 1' : 'Term 2'}</strong>
                </span>
              : <span style={{ fontSize: 11, color: '#6b7280' }}>
                  Periodic Test / Notebook / SEA appear in both terms — select which one.
                </span>
          }
        >
          <Select
            placeholder="Select term…"
            id="exam-term-select"
            options={TERM_OPTIONS}
            disabled={!!(canonicalRule?.autoTerm)}
            allowClear={!canonicalRule?.autoTerm}
          />
        </Form.Item>

        {/* Class */}
        <Form.Item
          name="classId"
          label="Class"
          rules={[{ required: true, message: 'Select a class' }]}
        >
          <Select
            placeholder="Select class"
            options={classes.map((c) => ({ label: c.name, value: c._id }))}
            onChange={handleClassChange}
            disabled={isEdit}          // class locked on edit
            showSearch
            optionFilterProp="label"
            id="exam-class-select"
          />
        </Form.Item>

        {/* Date Range */}
        <Form.Item name="dateRange" label="Exam Date / Date Range">
          <RangePicker
            style={{ width: '100%' }}
            format="DD-MM-YYYY"
            allowEmpty={[true, true]}
            id="exam-date-range"
          />
        </Form.Item>

        {/* Max / Passing Marks — locked when a canonical exam name is selected */}
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item
              name="maxMarks"
              label="Max Marks"
              rules={[
                { required: true, message: 'Required' },
                {
                  validator(_, value) {
                    if (!canonicalRule) return Promise.resolve();
                    if (value !== canonicalRule.maxMarks) {
                      return Promise.reject(
                        new Error(`"${form.getFieldValue('examName')}" must be /${canonicalRule.maxMarks}`)
                      );
                    }
                    return Promise.resolve();
                  },
                },
              ]}
            >
              <InputNumber
                min={1}
                style={{ width: '100%' }}
                id="exam-max-marks"
                disabled={!!canonicalRule}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="passingMarks" label="Passing Marks">
              <InputNumber
                min={0}
                style={{ width: '100%' }}
                id="exam-passing-marks"
                disabled={!!canonicalRule}
              />
            </Form.Item>
          </Col>
        </Row>

        {/* Subjects */}
        <Form.Item
          name="subjects"
          label="Subjects (optional)"
          extra={
            !form.getFieldValue('classId')
              ? 'Select a class to load subjects'
              : subjects.length === 0 && !loadingSubjects
                ? 'No subjects found — all subjects will be available'
                : `${subjects.length} subject${subjects.length !== 1 ? 's' : ''} available`
          }
        >
          <Select
            mode="multiple"
            placeholder={subjects.length ? 'Select subjects…' : 'Leave empty for all subjects'}
            options={subjects.map((s) => ({
              label: s.code ? `${s.name} (${s.code})` : s.name,
              value: String(s._id),
            }))}
            loading={loadingSubjects}
            optionFilterProp="label"
            showSearch
            allowClear
            id="exam-subjects-select"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CreateExamModal;
