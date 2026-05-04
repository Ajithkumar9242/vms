import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal, Form, Input, InputNumber, Select, DatePicker, App, Row, Col,
} from 'antd';
import dayjs from 'dayjs';
import { examAPI, schoolAPI } from '@/services/api';

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

        form.setFieldsValue({
          examName: editRecord.examName || editRecord.name,
          classId,
          dateRange: start ? [start, end || null] : undefined,
          maxMarks: editRecord.maxMarks ?? 100,
          passingMarks: editRecord.passingMarks ?? 35,
          subjects: (editRecord.subjects || []).map((s) => s?._id?.toString() || s?.toString?.() || s),
        });
      });
    } else {
      // Create mode — clean slate
      form.resetFields();
      form.setFieldsValue({ maxMarks: 100, passingMarks: 35 });
      setSubjects([]);
    }
  }, [open, editRecord, isEdit, form, loadSubjectsForClass]);

  // ── Class selector change ─────────────────────────────────
  const handleClassChange = (classId) => {
    form.setFieldValue('subjects', undefined);
    loadSubjectsForClass(classId);
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
        {/* Exam Name */}
        <Form.Item
          name="examName"
          label="Exam Name"
          rules={[{ required: true, message: 'Enter exam name' }]}
        >
          <Input placeholder="e.g. Mid Term Exam, Unit Test 1" id="exam-name-input" />
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

        {/* Max / Passing Marks */}
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item
              name="maxMarks"
              label="Max Marks"
              rules={[{ required: true, message: 'Required' }]}
            >
              <InputNumber min={1} style={{ width: '100%' }} id="exam-max-marks" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="passingMarks" label="Passing Marks">
              <InputNumber min={0} style={{ width: '100%' }} id="exam-passing-marks" />
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
