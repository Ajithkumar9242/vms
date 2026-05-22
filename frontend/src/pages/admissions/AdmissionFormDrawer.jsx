import React, { useEffect, useState } from 'react';
import {
  Drawer, Form, Input, Select, DatePicker, Button, Space,
  Divider, Row, Col, App, Typography, Collapse,
  InputNumber, Checkbox,
  Alert, Upload,
} from 'antd';
import {
  UploadOutlined, UserOutlined, HomeOutlined,
  BookOutlined, TeamOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { admissionAPI, schoolAPI, setupAPI, uploadAPI } from '@/services/api';
import useAuthStore from '@/store/authStore';
import WebcamCapture from '@/components/WebcamCapture';

const { Title, Text } = Typography;
const { Panel } = Collapse;

// ─── normalizeUrl helper ─────────────────────────────────────
const normalizeUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  const baseUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
  return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
};

// ─── CAPS input wrapper ────────────────────────────────────────
// Auto-uppercases value on blur for name fields
const CapsInput = ({ value, onChange, ...rest }) => (
  <Input
    value={value}
    onChange={e => onChange?.(e.target.value)}
    onBlur={e => onChange?.(e.target.value.toUpperCase())}
    {...rest}
  />
);

const GENDER_OPTIONS = [{ label: 'Male', value: 'male' }, { label: 'Female', value: 'female' }, { label: 'Other', value: 'other' }];
const CATEGORY_OPTIONS = ['General', 'OBC', 'SC', 'ST', 'Others'].map(v => ({ label: v, value: v }));
const BOARDING_OPTIONS = [{ label: 'Residential', value: 'residential' }, { label: 'Day-Boarding', value: 'day-boarding' }];
const BOARD_OPTIONS = ['CBSE', 'ICSE', 'State Board', 'Other'].map(v => ({ label: v, value: v }));
const LANG_OPTIONS = ['Kannada', 'Hindi', 'Other'].map(v => ({ label: v, value: v }));

const AdmissionFormDrawer = ({ open, admission, onClose, onSuccess }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [secondLang, setSecondLang] = useState('');
  const { user } = useAuthStore();
  const isEdit = !!admission;
  const isSuperAdmin = user?.role === 'super_admin';
  const isApproved = admission?.status === 'approved';
  const canWrite = user?.role !== 'visitor';
  const canEdit = (!isApproved || isSuperAdmin) && canWrite;

  // ─── Load dropdowns on open ───────────────────────────────
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        // Classes
        const classRes = await admissionAPI.getClasses();
        if (!cancelled) setClasses((classRes.data || classRes).map(c => ({ label: c.name, value: c._id })));
        // Academic years — use the typed setupAPI (no raw axios needed)
        const yearRes = await setupAPI.getAcademicYears();
        if (!cancelled) setAcademicYears((yearRes.data || yearRes).map(y => ({ label: y.name, value: y._id })));
      } catch { /* silent — dropdowns will be empty */ }
    })();
    return () => { cancelled = true; };
  }, [open]);

  // ─── Populate form for edit ───────────────────────────────
  useEffect(() => {
    if (!open) { form.resetFields(); return; }
    if (admission) {
      const cid = admission.classId?._id || admission.classId;
      form.setFieldsValue({
        ...admission,
        classId: cid,
        sectionId: admission.sectionId?._id || admission.sectionId,
        academicYearId: admission.academicYearId?._id || admission.academicYearId,
        admissionDate: admission.admissionDate ? dayjs(admission.admissionDate) : null,
        dateOfBirth: admission.dateOfBirth ? dayjs(admission.dateOfBirth) : null,
        tcDate: admission.tcDate ? dayjs(admission.tcDate) : null,
        father: admission.father || {},
        mother: admission.mother || {},
        guardian: admission.guardian || {},
        officeUse: {
          ...admission.officeUse,
          receiptDate: admission.officeUse?.receiptDate ? dayjs(admission.officeUse.receiptDate) : null,
          documentsVerifiedDate: admission.officeUse?.documentsVerifiedDate ? dayjs(admission.officeUse.documentsVerifiedDate) : null,
        },
      });
      setSecondLang(admission.secondLanguage || '');
      // Pre-load sections for the existing class
      if (cid) handleClassChange(cid, false); // false = don't reset sectionId
    } else {
      form.resetFields();
    }
  }, [open, admission, form]);

  // Load sections when class changes
  // resetSection=false used in edit mode to preserve the existing sectionId value.
  const handleClassChange = async (classId, resetSection = true) => {
    if (resetSection) form.setFieldValue('sectionId', undefined);
    setSections([]);
    if (!classId) return;
    try {
      // Uses /api/school/sections — the correct canonical endpoint.
      const res = await schoolAPI.getSections({ classId, limit: 100 });
      const list = res.data || res;
      setSections((Array.isArray(list) ? list : list.sections || []).map(s => ({ label: s.name, value: s._id })));
    } catch { setSections([]); }
  };

  // ─── Submit ───────────────────────────────────────────────
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (values.admissionDate) values.admissionDate = values.admissionDate ? new Date(values.admissionDate).toISOString() : null;
      if (values.dateOfBirth) values.dateOfBirth = values.dateOfBirth ? new Date(values.dateOfBirth).toISOString() : null;
      if (values.tcDate) values.tcDate = values.tcDate ? new Date(values.tcDate).toISOString() : null;
      if (values.officeUse?.receiptDate) values.officeUse.receiptDate = new Date(values.officeUse.receiptDate).toISOString();
      if (values.officeUse?.documentsVerifiedDate) values.officeUse.documentsVerifiedDate = new Date(values.officeUse.documentsVerifiedDate).toISOString();
      setLoading(true);
      if (isEdit) {
        await admissionAPI.update(admission._id, values);
        message.success('Admission updated');
      } else {
        await admissionAPI.create(values);
        message.success('Admission application created');
      }
      onSuccess?.();
    } catch (e) {
      if (e.errorFields) return; // validation error — antd shows inline
      message.error(e.message || 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer
      title={
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            APPLICATION FOR ADMISSION – RESIDENTIAL / DAY-BOARDING
          </div>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {isEdit ? `Editing: ${admission.applicationNo}` : 'New Application'}
          </Text>
        </div>
      }
      open={open}
      onClose={onClose}
      width={720}
      destroyOnClose
      extra={
        <Space>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" loading={loading} onClick={handleSubmit} disabled={!canWrite || (isEdit && !canEdit)}>
            {isEdit ? 'Update Application' : 'Create Application'}
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" size="small" disabled={!canWrite || (isEdit && !canEdit)}>
        {isEdit && !canEdit && canWrite && (
          <Alert message="Approved admissions cannot be edited directly." type="warning" showIcon style={{ marginBottom: 16 }} />
        )}
        <Collapse defaultActiveKey={['academic', 'student']} ghost>

          {/* ─── SECTION 1: Academic / Admission Details ─── */}
          <Panel header={<><BookOutlined /> &nbsp;Academic / Admission Details</>} key="academic">
            <Row gutter={12}>
              <Col span={8}>
                <Form.Item label="Application Form No" name="applicationFormNo">
                  <Input placeholder="Office use" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="Admission No" name="admissionNo">
                  <Input placeholder="Auto or Enter" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="Roll Number" name="rollNo">
                  <Input placeholder="Auto or Enter" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Academic Year" name="academicYearId">
                  <Select options={academicYears} placeholder="Select year" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Admission Date" name="admissionDate">
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Class Applied For" name="classId" rules={[{ required: true, message: 'Class required' }]}>
                  <Select options={classes} placeholder="Select class" onChange={handleClassChange} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Section (Optional)" name="sectionId">
                  <Select options={sections} placeholder="Assign later" allowClear />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Boarding Type" name="boardingType">
                  <Select options={BOARDING_OPTIONS} defaultValue="day-boarding" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Second Language" name="secondLanguage">
                  <Select options={LANG_OPTIONS} allowClear onChange={v => setSecondLang(v)} />
                </Form.Item>
              </Col>
              {secondLang === 'Other' && (
                <Col span={12}>
                  <Form.Item label="Specify Language" name="secondLanguageOther">
                    <Input placeholder="Enter language" />
                  </Form.Item>
                </Col>
              )}
            </Row>
          </Panel>

          {/* ─── SECTION 2: Student Details ─── */}
          <Panel header={<><UserOutlined /> &nbsp;Student Details</>} key="student">
            <Alert message="Name fields will be stored in BLOCK LETTERS automatically." type="info" showIcon style={{ marginBottom: 12 }} />
            <Row gutter={12}>
              <Col span={16}>
                <Form.Item label="Full Name (Block Letters)" name="studentName" rules={[{ required: true }]}>
                  <CapsInput placeholder="STUDENT FULL NAME" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="Gender" name="gender" rules={[{ required: true }]}>
                  <Select options={GENDER_OPTIONS} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="Date of Birth" name="dateOfBirth" rules={[{ required: true }]}>
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={16}>
                <Form.Item label="Date of Birth in Words" name="dobInWords">
                  <Input placeholder="e.g. Fifteenth January Two Thousand Twelve" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="Place of Birth" name="placeOfBirth">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="Nationality" name="nationality" initialValue="Indian">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="Religion" name="religion">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="Mother Tongue" name="motherTongue">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="Aadhaar No" name="aadhaarNo">
                  <Input maxLength={12} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="Caste" name="caste">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="Category" name="category">
                  <Select options={CATEGORY_OPTIONS} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="No. of Siblings" name="numberOfSiblings" initialValue={0}>
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="Sibling in School?" name="siblingStudyingInSchool" valuePropName="checked">
                  <Checkbox />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="Sibling Class" name="siblingClass">
                  <Input placeholder="e.g. Class 5" />
                </Form.Item>
              </Col>
            </Row>

            <Divider style={{ margin: '8px 0' }}>Medical & Special Education Needs</Divider>
            <Row gutter={12}>
              <Col span={8}>
                <Form.Item label="Blood Group" name="bloodGroup">
                  <Input placeholder="e.g. O+" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="Allergies" name="allergies">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="Health Conditions" name="medicalConditions">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Special Need / Disability" name="senType">
                  <Input placeholder="Type of need (if any)" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Support Required" name="senSupportLevel">
                  <Select options={['Mild', 'Moderate', 'Intensive'].map(v => ({ label: v, value: v }))} allowClear />
                </Form.Item>
              </Col>
            </Row>

            {/* Webcam / Photo Capture */}
            <Divider style={{ margin: '8px 0' }}>Student Photo</Divider>
            <Row gutter={12}>
              <Col span={24}>
                <Form.Item name="studentPhoto" label="">
                  <WebcamCapture
                    value={normalizeUrl(form.getFieldValue('studentPhoto') || admission?.studentPhoto)}
                    onCapture={async (dataUrl, file) => {
                      try {
                        // Upload to server
                        const res = await uploadAPI.upload(file, 'admissions');
                        const url = res?.data?.url || res?.url || dataUrl;
                        form.setFieldValue('studentPhoto', url);
                      } catch {
                        // Fallback: store base64 in form (will be uploaded on submit)
                        form.setFieldValue('studentPhoto', dataUrl);
                      }
                    }}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Panel>

          {/* ─── SECTION 3: Previous School ─── */}
          <Panel header={<><BookOutlined /> &nbsp;Previous School Information</>} key="school">
            <Row gutter={12}>
              <Col span={16}>
                <Form.Item label="Previous School Name" name="previousSchool">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="Board" name="previousBoard">
                  <Select options={BOARD_OPTIONS} allowClear />
                </Form.Item>
              </Col>
              <Col span={16}>
                <Form.Item label="School Address" name="previousSchoolAddress">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="Medium of Instruction" name="previousMedium">
                  <Input placeholder="English / Kannada..." />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item label="Class Last Studied" name="previousClass">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item label="Year of Completion" name="yearOfCompletion">
                  <Input placeholder="e.g. 2024" maxLength={4} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item label="TC Number" name="tcNumber">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item label="TC Date" name="tcDate">
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </Col>
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
          </Panel>

          {/* ─── SECTION 4: Father ─── */}
          <Panel header={<><TeamOutlined /> &nbsp;Father's Information</>} key="father">
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item label="Full Name" name={['father', 'name']}>
                  <CapsInput placeholder="FATHER'S FULL NAME" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Mobile Number" name={['father', 'phone']}>
                  <Input maxLength={10} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Aadhaar Number" name={['father', 'aadhaarNo']}>
                  <Input maxLength={12} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Annual Income (₹)" name={['father', 'annualIncome']}>
                  <InputNumber style={{ width: '100%' }} min={0} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Qualification" name={['father', 'qualification']}>
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Occupation" name={['father', 'occupation']}>
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Email" name={['father', 'email']}>
                  <Input type="email" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Residential Address" name={['father', 'address']}>
                  <Input.TextArea rows={2} />
                </Form.Item>
              </Col>
            </Row>
          </Panel>

          {/* ─── SECTION 5: Mother ─── */}
          <Panel header={<><TeamOutlined /> &nbsp;Mother's Information</>} key="mother">
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item label="Full Name" name={['mother', 'name']}>
                  <CapsInput placeholder="MOTHER'S FULL NAME" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Mobile Number" name={['mother', 'phone']}>
                  <Input maxLength={10} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Aadhaar Number" name={['mother', 'aadhaarNo']}>
                  <Input maxLength={12} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Annual Income (₹)" name={['mother', 'annualIncome']}>
                  <InputNumber style={{ width: '100%' }} min={0} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Qualification" name={['mother', 'qualification']}>
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Occupation" name={['mother', 'occupation']}>
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Email" name={['mother', 'email']}>
                  <Input type="email" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Residential Address" name={['mother', 'address']}>
                  <Input.TextArea rows={2} />
                </Form.Item>
              </Col>
            </Row>
          </Panel>

          {/* ─── SECTION 6: Guardian ─── */}
          <Panel header={<><TeamOutlined /> &nbsp;Guardian Information (if different)</>} key="guardian">
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item label="Guardian Name" name={['guardian', 'name']}>
                  <CapsInput placeholder="GUARDIAN'S NAME" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Relationship" name={['guardian', 'relationship']}>
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Phone" name={['guardian', 'phone']}>
                  <Input maxLength={10} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Address" name={['guardian', 'address']}>
                  <Input.TextArea rows={2} />
                </Form.Item>
              </Col>
            </Row>
          </Panel>

          {/* ─── SECTION 7: Legacy parent fields (for backward compat) ─── */}
          <Panel header={<><HomeOutlined /> &nbsp;Primary Contact (Legacy)</>} key="contact">
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item label="Parent / Guardian Name" name="parentName" rules={[{ required: true }]}>
                  <CapsInput placeholder="PRIMARY GUARDIAN NAME" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Contact Phone" name="parentPhone" rules={[{ required: true }]}>
                  <Input maxLength={10} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Parent Email" name="parentEmail">
                  <Input type="email" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Address" name="address">
                  <Input.TextArea rows={2} />
                </Form.Item>
              </Col>
            </Row>
          </Panel>

          {/* ─── SECTION 8: Documents Checklist ─── */}
          <Panel header={<><UploadOutlined /> &nbsp;Documents Submitted</>} key="documents">
            <Row gutter={12}>
              <Col span={8}>
                <Form.Item name={['documentChecklist', 'birthCertificate']} valuePropName="checked">
                  <Checkbox>Birth Certificate</Checkbox>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name={['documentChecklist', 'aadhaarStudent']} valuePropName="checked">
                  <Checkbox>Aadhaar (Student)</Checkbox>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name={['documentChecklist', 'aadhaarParents']} valuePropName="checked">
                  <Checkbox>Aadhaar (Parents)</Checkbox>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name={['documentChecklist', 'previousReportCard']} valuePropName="checked">
                  <Checkbox>Previous Report Card</Checkbox>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name={['documentChecklist', 'tc']} valuePropName="checked">
                  <Checkbox>Transfer Certificate</Checkbox>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name={['documentChecklist', 'casteCertificate']} valuePropName="checked">
                  <Checkbox>Caste Certificate</Checkbox>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Photos Submitted (Count)" name={['documentChecklist', 'photosCount']} initialValue={0}>
                  <InputNumber min={0} />
                </Form.Item>
              </Col>
            </Row>
          </Panel>

          {/* ─── SECTION 9: Office Use ─── */}
          <Panel header={<><BookOutlined /> &nbsp;For Office Use Only</>} key="officeUse">
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item label="Fee Receipt No" name={['officeUse', 'feeReceiptNo']}>
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Receipt Date" name={['officeUse', 'receiptDate']}>
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Documents Verified By" name={['officeUse', 'documentsVerifiedBy']}>
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Verified Date" name={['officeUse', 'documentsVerifiedDate']}>
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item label="Principal Remarks" name={['officeUse', 'principalRemarks']}>
                  <Input.TextArea rows={2} />
                </Form.Item>
              </Col>
            </Row>
          </Panel>
        </Collapse>
      </Form>
    </Drawer>
  );
};

export default AdmissionFormDrawer;
