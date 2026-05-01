import React, { useState } from 'react';
import { Modal, Form, Input, InputNumber, Select, DatePicker, App } from 'antd';
import { examAPI, schoolAPI } from '@/services/api';
import { useEffect } from 'react';

/**
 * CreateExamModal — form to create a new exam.
 */
const CreateExamModal = ({ open, onClose, onSuccess }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      try {
        const [cRes, sRes] = await Promise.all([
          schoolAPI.getClasses({ limit: 50 }),
          schoolAPI.getSubjects({ limit: 100 }),
        ]);
        setClasses(cRes.data || []);
        setSubjects(sRes.data || []);
      } catch { /* non-critical */ }
    };
    load();
  }, [open]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await examAPI.create({
        ...values,
        examDate: values.examDate ? values.examDate.toISOString() : null,
      });
      message.success('Exam created successfully');
      form.resetFields();
      onSuccess?.();
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.message || 'Failed to create exam');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="Create Exam"
      open={open}
      onCancel={() => { form.resetFields(); onClose?.(); }}
      onOk={handleSubmit}
      okText="Create Exam"
      okButtonProps={{ loading: submitting, disabled: submitting, id: 'create-exam-submit' }}
      destroyOnClose
      maskClosable={false}
      width={520}
    >
      <Form form={form} layout="vertical" requiredMark="optional" style={{ marginTop: 16 }}>
        <Form.Item name="name" label="Exam Name" rules={[{ required: true, message: 'Enter exam name' }]}>
          <Input placeholder="e.g. Mid Term, Final Exam" id="exam-name-input" />
        </Form.Item>

        <Form.Item name="classId" label="Class" rules={[{ required: true, message: 'Select class' }]}>
          <Select
            placeholder="Select class"
            options={classes.map((c) => ({ label: c.name, value: c._id }))}
            id="exam-class-select"
          />
        </Form.Item>

        <Form.Item name="academicYear" label="Academic Year" rules={[{ required: true, message: 'Enter academic year' }]}>
          <Input placeholder="e.g. 2025-26" id="exam-year-input" />
        </Form.Item>

        <Form.Item name="subjects" label="Subjects" rules={[{ required: true, message: 'Select at least one subject' }]}>
          <Select
            mode="multiple"
            placeholder="Select subjects"
            options={subjects.map((s) => ({ label: `${s.name} (${s.code})`, value: s._id }))}
            id="exam-subjects-select"
          />
        </Form.Item>

        <Form.Item name="maxMarks" label="Max Marks (per subject)" rules={[{ required: true, message: 'Enter max marks' }]}>
          <InputNumber min={1} style={{ width: '100%' }} placeholder="e.g. 100" id="exam-max-marks" />
        </Form.Item>

        <Form.Item name="passingMarks" label="Passing Marks" rules={[{ required: true, message: 'Enter passing marks' }]}>
          <InputNumber min={0} style={{ width: '100%' }} placeholder="e.g. 35" id="exam-passing-marks" />
        </Form.Item>

        <Form.Item name="examDate" label="Exam Date">
          <DatePicker style={{ width: '100%' }} format="DD-MM-YYYY" id="exam-date-picker" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CreateExamModal;
