import React, { useEffect, useState } from 'react';
import {
  Drawer, Form, Input, Select, DatePicker, Button, Space,
  Divider, Row, Col, App, Upload, Typography, Collapse,
  InputNumber, Checkbox,
  Alert,
} from 'antd';
import {
  UploadOutlined, CameraOutlined, UserOutlined, HomeOutlined,
  BookOutlined, TeamOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { admissionAPI } from '@/services/api';

const { Title, Text } = Typography;
const { Panel } = Collapse;

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
  const isEdit = !!admission;

  // ─── Load dropdowns ───────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const res = await admissionAPI.getClasses();
        setClasses((res.data || res).map(c => ({ label: c.name, value: c._id })));
        // Academic years
        const token = localStorage.getItem('vms_token');
        const { default: axios } = await import('axios');
        const r = await axios.get('/api/setup/academic-years', { headers: { Authorization: `Bearer ${token}` } });
        setAcademicYears((r.data?.data || r.data || []).map(y => ({ label: y.name, value: y._id })));
      } catch { /* silent */ }
    })();
  }, [open]);

  // ─── Populate form for edit ───────────────────────────────
  useEffect(() => {
    if (!open) { form.resetFields(); return; }
    if (admission) {
      form.setFieldsValue({
        ...admission,
        classId: admission.classId?._id || admission.classId,
        sectionId: admission.sectionId?._id || admission.sectionId,
        academicYearId: admission.academicYearId?._id || admission.academicYearId,
        dateOfBirth: admission.dateOfBirth ? dayjs(admission.dateOfBirth) : null,
        tcDate: admission.tcDate ? dayjs(admission.tcDate) : null,
        father: admission.father || {},
        mother: admission.mother || {},
        guardian: admission.guardian || {},
      });
      setSecondLang(admission.secondLanguage || '');
    } else {
      form.resetFields();
    }
  }, [open, admission, form]);

  // Load sections when class changes
  const handleClassChange = async (classId) => {
    form.setFieldValue('sectionId', undefined);
    if (!classId) { setSections([]); return; }
    try {
      const token = localStorage.getItem('vms_token');
      const { default: axios } = await import('axios');
      const r = await axios.get(`/api/setup/sections?classId=${classId}`, { headers: { Authorization: `Bearer ${token}` } });
      setSections((r.data?.data || r.data || []).map(s => ({ label: s.name, value: s._id })));
    } catch { setSections([]); }
  };

  // ─── Submit ───────────────────────────────────────────────
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (values.dateOfBirth) values.dateOfBirth = values.dateOfBirth ? new Date(values.dateOfBirth).toISOString() : null;
      if (values.tcDate) values.tcDate = values.tcDate ? new Date(values.tcDate).toISOString() : null;
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
          <Button type="primary" loading={loading} onClick={handleSubmit}>
            {isEdit ? 'Update Application' : 'Create Application'}
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" size="small">
        <Collapse defaultActiveKey={['academic', 'student']} ghost>

          {/* ─── SECTION 1: Academic / Admission Details ─── */}
          <Panel header={<><BookOutlined /> &nbsp;Academic / Admission Details</>} key="academic">
            <Row gutter={12}>
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

            {/* Photo upload */}
            <Divider style={{ margin: '8px 0' }}>Student Photo</Divider>
            <Row gutter={12}>
              <Col span={24}>
                <Form.Item name="studentPhoto" label="">
                  <div style={{ display: 'flex', gap: 12 }}>
                    <Upload accept="image/*" maxCount={1} beforeUpload={() => false} listType="picture">
                      <Button icon={<UploadOutlined />}>Upload Photo</Button>
                    </Upload>
                    {/* Camera capture for mobile */}
                    <label style={{ cursor: 'pointer' }}>
                      <Button icon={<CameraOutlined />} onClick={() => document.getElementById('camera-input')?.click()}>
                        Camera
                      </Button>
                      <input
                        id="camera-input"
                        type="file"
                        accept="image/*"
                        capture="environment"
                        style={{ display: 'none' }}
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) form.setFieldValue('studentPhotoFile', file);
                        }}
                      />
                    </label>
                  </div>
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

          {/* ─── SECTION 8: Documents ─── */}
          <Panel header={<><UploadOutlined /> &nbsp;Documents</>} key="documents">
            <Row gutter={[16, 8]}>
              {[
                { label: 'Aadhaar Card', id: 'doc-aadhaar' },
                { label: 'Transfer Certificate (TC)', id: 'doc-tc' },
                { label: 'Marks Card / Report', id: 'doc-marks' },
                { label: 'Other Documents', id: 'doc-other' },
              ].map(doc => (
                <Col span={12} key={doc.id}>
                  <div style={{ marginBottom: 4, fontSize: 12, color: '#374151' }}>{doc.label}</div>
                  <Upload accept="image/*,.pdf" maxCount={3} beforeUpload={() => false} listType="text" id={doc.id}>
                    <Button icon={<UploadOutlined />} size="small">Upload / Camera</Button>
                  </Upload>
                </Col>
              ))}
            </Row>
          </Panel>
        </Collapse>
      </Form>
    </Drawer>
  );
};

export default AdmissionFormDrawer;
