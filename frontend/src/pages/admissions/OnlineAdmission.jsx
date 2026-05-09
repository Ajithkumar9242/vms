import React, { useState, useEffect } from 'react';
import {
  Steps, Form, Input, Select, DatePicker, Button, Upload,
  Row, Col, Alert, Typography, Card, Spin, message, Result,
  InputNumber, Checkbox, Divider, Space, Progress,
} from 'antd';
import {
  UploadOutlined, CameraOutlined, CheckCircleOutlined,
  ArrowLeftOutlined, ArrowRightOutlined, SendOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import axios from 'axios';

const { Title, Text, Paragraph } = Typography;
const { Step } = Steps;

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const capsOnBlur = (form, field) => (e) => {
  const val = e.target.value.toUpperCase();
  form.setFieldValue(field, val);
};

// Auto-caps nested field
const CapsInput = ({ value, onChange, ...rest }) => (
  <Input
    value={value}
    onChange={e => onChange?.(e.target.value)}
    onBlur={e => onChange?.(e.target.value.toUpperCase())}
    {...rest}
  />
);

const GENDER_OPT   = [{ label: 'Male', value: 'male' }, { label: 'Female', value: 'female' }, { label: 'Other', value: 'other' }];
const CATEGORY_OPT = ['General', 'OBC', 'SC', 'ST', 'Others'].map(v => ({ label: v, value: v }));
const BOARD_OPT    = ['CBSE', 'ICSE', 'State Board', 'Other'].map(v => ({ label: v, value: v }));
const LANG_OPT     = ['Kannada', 'Hindi', 'Other'].map(v => ({ label: v, value: v }));

const STEPS = [
  { title: 'Academic Details' },
  { title: 'Student Info' },
  { title: 'Previous School' },
  { title: 'Father / Mother' },
  { title: 'Documents' },
  { title: 'Review & Submit' },
];

const OnlineAdmission = () => {
  const [form] = Form.useForm();
  const [current, setCurrent]         = useState(0);
  const [loading, setLoading]         = useState(false);
  const [submitted, setSubmitted]     = useState(false);
  const [applicationNo, setApplicationNo] = useState('');
  const [classes, setClasses]         = useState([]);
  const [sections, setSections]       = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [admOpen, setAdmOpen]         = useState(true); // default open until checked
  const [admOpenChecked, setAdmOpenChecked] = useState(false);
  const [secondLang, setSecondLang]   = useState('');
  const [formSnapshot, setFormSnapshot] = useState({});

  // ─── Check if admissions are open + load classes ─────────
  useEffect(() => {
    (async () => {
      try {
        const [settingsRes, classesRes] = await Promise.all([
          axios.get(`${API_BASE}/admissions/settings`),
          axios.get(`${API_BASE}/admissions/classes`),
        ]);
        const s = settingsRes.data?.data || settingsRes.data;
        setAdmOpen(s?.admissionsOpen ?? true);
        setClasses((classesRes.data?.data || classesRes.data || []).map(c => ({ label: c.name, value: c._id })));
        if (s?.activeAdmissionAcademicYearId) {
          form.setFieldValue('academicYearId', s.activeAdmissionAcademicYearId._id || s.activeAdmissionAcademicYearId);
        }
      } catch { setAdmOpen(false); }
      setAdmOpenChecked(true);
    })();
  }, [form]);

  const handleClassChange = async (classId) => {
    form.setFieldValue('sectionId', undefined);
    if (!classId) { setSections([]); return; }
    try {
      const r = await axios.get(`${API_BASE}/setup/sections?classId=${classId}`);
      setSections((r.data?.data || r.data || []).map(s => ({ label: s.name, value: s._id })));
    } catch { setSections([]); }
  };

  // ─── Step navigation ─────────────────────────────────────
  const next = async () => {
    try {
      await form.validateFields(getStepFields(current));
      if (current === STEPS.length - 2) {
        // Before review step: capture snapshot
        setFormSnapshot(form.getFieldsValue(true));
      }
      setCurrent(c => c + 1);
    } catch { /* antd shows inline errors */ }
  };

  const prev = () => setCurrent(c => c - 1);

  // ─── Submit ───────────────────────────────────────────────
  const handleSubmit = async () => {
    setLoading(true);
    try {
      const values = form.getFieldsValue(true);
      if (values.dateOfBirth) values.dateOfBirth = values.dateOfBirth.toISOString();
      if (values.tcDate)      values.tcDate      = values.tcDate.toISOString();
      // Remove file objects — uploads handled separately
      delete values.studentPhotoFile;

      const res = await axios.post(`${API_BASE}/admissions/public`, values);
      const appNo = res.data?.data?.applicationNo || res.data?.applicationNo;
      setApplicationNo(appNo || '');
      setSubmitted(true);
    } catch (e) {
      message.error(e.response?.data?.message || e.message || 'Submission failed');
    } finally {
      setLoading(false);
    }
  };

  // ─── Closed state ─────────────────────────────────────────
  if (admOpenChecked && !admOpen) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC' }}>
        <Card style={{ maxWidth: 500, textAlign: 'center', borderRadius: 16 }}>
          <div style={{ fontSize: 60, marginBottom: 16 }}>🔒</div>
          <Title level={3} style={{ color: '#1B3A5C' }}>Admissions Currently Closed</Title>
          <Paragraph type="secondary">
            We are not accepting new applications at this time. Please check back later or
            contact the school office for more information.
          </Paragraph>
        </Card>
      </div>
    );
  }

  // ─── Success state ────────────────────────────────────────
  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F0FDF4' }}>
        <Card style={{ maxWidth: 520, borderRadius: 16, textAlign: 'center' }}>
          <Result
            status="success"
            title="Application Submitted Successfully!"
            subTitle={
              <>
                <p>Your application number is:</p>
                <code style={{ fontSize: 20, fontWeight: 700, color: '#1B3A5C', background: '#EFF6FF', padding: '4px 12px', borderRadius: 6 }}>
                  {applicationNo}
                </code>
                <p style={{ marginTop: 12, color: '#64748B' }}>
                  Save this number to track your application status. We will contact you on the registered mobile number.
                </p>
              </>
            }
            extra={[
              <Button type="primary" key="track" href={`/application-status?app=${applicationNo}`}>
                Track Application
              </Button>,
            ]}
          />
        </Card>
      </div>
    );
  }

  const pct = Math.round((current / (STEPS.length - 1)) * 100);

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #EFF6FF 0%, #F0FDF4 100%)', padding: '20px 16px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        {/* Header */}
        <Card style={{ borderRadius: 16, marginBottom: 20, background: '#1B3A5C', border: 'none' }}>
          <div style={{ textAlign: 'center', color: '#fff' }}>
            <Title level={3} style={{ color: '#fff', margin: 0 }}>
              APPLICATION FOR ADMISSION
            </Title>
            <Text style={{ color: '#93C5FD', fontSize: 13 }}>
              RESIDENTIAL / DAY-BOARDING
            </Text>
          </div>
        </Card>

        {/* Progress */}
        <Progress percent={pct} size="small" style={{ marginBottom: 16 }} strokeColor="#2563EB" />

        {/* Steps */}
        <Steps current={current} size="small" style={{ marginBottom: 20 }} responsive={false}>
          {STEPS.map(s => <Step key={s.title} title={<span style={{ fontSize: 11 }}>{s.title}</span>} />)}
        </Steps>

        <Card style={{ borderRadius: 16 }}>
          <Spin spinning={!admOpenChecked || loading}>
            <Form form={form} layout="vertical" size="small">
              {/* ─── Step 0: Academic Details ─── */}
              {current === 0 && (
                <div>
                  <Title level={5}>Academic / Admission Details</Title>
                  <Divider style={{ margin: '8px 0 16px' }} />
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item label="Class Applying For" name="classId" rules={[{ required: true, message: 'Please select a class' }]}>
                        <Select options={classes} placeholder="Select class" onChange={handleClassChange} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="Section (Optional — can assign later)" name="sectionId">
                        <Select options={sections} placeholder="Leave blank if unsure" allowClear />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="Boarding Type" name="boardingType" initialValue="day-boarding" rules={[{ required: true }]}>
                        <Select options={[
                          { label: '🏫 Day-Boarding', value: 'day-boarding' },
                          { label: '🏠 Residential (Hostel)', value: 'residential' },
                        ]} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="Second Language Preference" name="secondLanguage">
                        <Select options={LANG_OPT} onChange={v => setSecondLang(v)} allowClear />
                      </Form.Item>
                    </Col>
                    {secondLang === 'Other' && (
                      <Col span={12}>
                        <Form.Item label="Specify Language" name="secondLanguageOther">
                          <Input />
                        </Form.Item>
                      </Col>
                    )}
                  </Row>
                </div>
              )}

              {/* ─── Step 1: Student Details ─── */}
              {current === 1 && (
                <div>
                  <Title level={5}>Student Details</Title>
                  <Alert message="Name fields will be stored in BLOCK LETTERS. Type normally — system will convert." type="info" showIcon style={{ marginBottom: 12 }} />
                  <Divider style={{ margin: '8px 0 16px' }} />
                  <Row gutter={12}>
                    <Col span={16}>
                      <Form.Item label="Full Name (Block Letters)" name="studentName" rules={[{ required: true }]}>
                        <CapsInput placeholder="STUDENT FULL NAME" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="Gender" name="gender" rules={[{ required: true }]}>
                        <Select options={GENDER_OPT} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="Date of Birth" name="dateOfBirth" rules={[{ required: true }]}>
                        <DatePicker style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={16}>
                      <Form.Item label="Date of Birth in Words" name="dobInWords">
                        <Input placeholder="Fifteenth January Two Thousand Twelve" />
                      </Form.Item>
                    </Col>
                    <Col span={8}><Form.Item label="Place of Birth" name="placeOfBirth"><Input /></Form.Item></Col>
                    <Col span={8}><Form.Item label="Nationality" name="nationality" initialValue="Indian"><Input /></Form.Item></Col>
                    <Col span={8}><Form.Item label="Religion" name="religion"><Input /></Form.Item></Col>
                    <Col span={8}><Form.Item label="Mother Tongue" name="motherTongue"><Input /></Form.Item></Col>
                    <Col span={8}><Form.Item label="Aadhaar No" name="aadhaarNo"><Input maxLength={12} /></Form.Item></Col>
                    <Col span={8}><Form.Item label="Caste" name="caste"><Input /></Form.Item></Col>
                    <Col span={8}><Form.Item label="Category" name="category" initialValue="General"><Select options={CATEGORY_OPT} /></Form.Item></Col>
                    <Col span={8}><Form.Item label="No. of Siblings" name="numberOfSiblings" initialValue={0}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
                    <Col span={8}>
                      <Form.Item label="Sibling in this School?" name="siblingStudyingInSchool" valuePropName="checked">
                        <Checkbox>Yes</Checkbox>
                      </Form.Item>
                    </Col>
                    <Col span={8}><Form.Item label="Sibling Class" name="siblingClass"><Input /></Form.Item></Col>
                  </Row>
                </div>
              )}

              {/* ─── Step 2: Previous School ─── */}
              {current === 2 && (
                <div>
                  <Title level={5}>Previous School Information</Title>
                  <Divider style={{ margin: '8px 0 16px' }} />
                  <Row gutter={12}>
                    <Col span={16}><Form.Item label="School Name" name="previousSchool"><Input /></Form.Item></Col>
                    <Col span={8}><Form.Item label="Board" name="previousBoard"><Select options={BOARD_OPT} allowClear /></Form.Item></Col>
                    <Col span={16}><Form.Item label="School Address" name="previousSchoolAddress"><Input /></Form.Item></Col>
                    <Col span={8}><Form.Item label="Medium" name="previousMedium"><Input /></Form.Item></Col>
                    <Col span={6}><Form.Item label="Class Last Studied" name="previousClass"><Input /></Form.Item></Col>
                    <Col span={6}><Form.Item label="Year of Completion" name="yearOfCompletion"><Input maxLength={4} /></Form.Item></Col>
                    <Col span={6}><Form.Item label="TC Number" name="tcNumber"><Input /></Form.Item></Col>
                    <Col span={6}><Form.Item label="TC Date" name="tcDate"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
                    <Col span={8}><Form.Item label="SATS Number" name="satsNumber"><Input /></Form.Item></Col>
                    <Col span={8}><Form.Item label="APAAR Number" name="apaarNumber"><Input /></Form.Item></Col>
                    <Col span={8}><Form.Item label="PEN Number" name="penNumber"><Input /></Form.Item></Col>
                  </Row>
                </div>
              )}

              {/* ─── Step 3: Father + Mother + Guardian ─── */}
              {current === 3 && (
                <div>
                  <Title level={5}>Parent / Guardian Information</Title>
                  <Divider orientation="left">Father</Divider>
                  <Row gutter={12}>
                    <Col span={12}><Form.Item label="Full Name" name={['father', 'name']}><CapsInput /></Form.Item></Col>
                    <Col span={12}><Form.Item label="Mobile" name={['father', 'phone']} rules={[{ required: true, message: 'Father mobile required' }]}><Input maxLength={10} /></Form.Item></Col>
                    <Col span={8}><Form.Item label="Aadhaar" name={['father', 'aadhaarNo']}><Input maxLength={12} /></Form.Item></Col>
                    <Col span={8}><Form.Item label="Annual Income" name={['father', 'annualIncome']}><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
                    <Col span={8}><Form.Item label="Occupation" name={['father', 'occupation']}><Input /></Form.Item></Col>
                    <Col span={12}><Form.Item label="Qualification" name={['father', 'qualification']}><Input /></Form.Item></Col>
                    <Col span={12}><Form.Item label="Email" name={['father', 'email']}><Input type="email" /></Form.Item></Col>
                    <Col span={24}><Form.Item label="Residential Address" name={['father', 'address']}><Input.TextArea rows={2} /></Form.Item></Col>
                  </Row>

                  <Divider orientation="left">Mother</Divider>
                  <Row gutter={12}>
                    <Col span={12}><Form.Item label="Full Name" name={['mother', 'name']}><CapsInput /></Form.Item></Col>
                    <Col span={12}><Form.Item label="Mobile" name={['mother', 'phone']}><Input maxLength={10} /></Form.Item></Col>
                    <Col span={8}><Form.Item label="Aadhaar" name={['mother', 'aadhaarNo']}><Input maxLength={12} /></Form.Item></Col>
                    <Col span={8}><Form.Item label="Annual Income" name={['mother', 'annualIncome']}><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
                    <Col span={8}><Form.Item label="Occupation" name={['mother', 'occupation']}><Input /></Form.Item></Col>
                    <Col span={12}><Form.Item label="Qualification" name={['mother', 'qualification']}><Input /></Form.Item></Col>
                    <Col span={12}><Form.Item label="Email" name={['mother', 'email']}><Input type="email" /></Form.Item></Col>
                    <Col span={24}><Form.Item label="Residential Address" name={['mother', 'address']}><Input.TextArea rows={2} /></Form.Item></Col>
                  </Row>

                  <Divider orientation="left">Primary Contact (Required for account)</Divider>
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item label="Primary Guardian Name" name="parentName" rules={[{ required: true }]}>
                        <CapsInput />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="Primary Mobile (for OTP login)" name="parentPhone"
                        rules={[{ required: true }, { pattern: /^\d{10}$/, message: '10 digits required' }]}>
                        <Input maxLength={10} />
                      </Form.Item>
                    </Col>
                    <Col span={12}><Form.Item label="Email" name="parentEmail"><Input type="email" /></Form.Item></Col>
                    <Col span={12}><Form.Item label="Address" name="address"><Input /></Form.Item></Col>
                  </Row>
                </div>
              )}

              {/* ─── Step 4: Documents ─── */}
              {current === 4 && (
                <div>
                  <Title level={5}>Photo & Document Uploads</Title>
                  <Alert message="You can upload from your gallery or take a photo directly using the camera button." type="info" showIcon style={{ marginBottom: 16 }} />
                  <Row gutter={[16, 16]}>
                    {[
                      { label: 'Student Photo', id: 'stu-photo', required: false },
                      { label: 'Aadhaar Card', id: 'aadhaar-doc' },
                      { label: 'Transfer Certificate (TC)', id: 'tc-doc' },
                      { label: 'Marks Card / Report', id: 'marks-doc' },
                    ].map(doc => (
                      <Col span={12} key={doc.id}>
                        <Card size="small" style={{ borderRadius: 10 }}>
                          <div style={{ fontWeight: 600, marginBottom: 8 }}>{doc.label}</div>
                          <Space>
                            <Upload accept="image/*,.pdf" maxCount={1} beforeUpload={() => false} listType="picture">
                              <Button icon={<UploadOutlined />} size="small">Upload</Button>
                            </Upload>
                            <label>
                              <Button icon={<CameraOutlined />} size="small"
                                onClick={() => document.getElementById(`cam-${doc.id}`)?.click()}>Camera</Button>
                              <input
                                id={`cam-${doc.id}`} type="file"
                                accept="image/*" capture="environment"
                                style={{ display: 'none' }} onChange={() => {}}
                              />
                            </label>
                          </Space>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                </div>
              )}

              {/* ─── Step 5: Review ─── */}
              {current === 5 && (
                <div>
                  <Title level={5}>Review Your Application</Title>
                  <Alert message="Please review all details before submitting. Once submitted, the form will be reviewed by the school administration." type="warning" showIcon style={{ marginBottom: 16 }} />
                  <Row gutter={12}>
                    {[
                      ['Student Name', formSnapshot.studentName],
                      ['Gender', formSnapshot.gender],
                      ['Date of Birth', formSnapshot.dateOfBirth ? dayjs(formSnapshot.dateOfBirth).format('DD MMM YYYY') : '—'],
                      ['Boarding Type', formSnapshot.boardingType],
                      ['Parent Phone', formSnapshot.parentPhone],
                      ['Parent Email', formSnapshot.parentEmail || '—'],
                      ['Father Name', formSnapshot.father?.name || '—'],
                      ['Mother Name', formSnapshot.mother?.name || '—'],
                      ['Previous School', formSnapshot.previousSchool || '—'],
                      ['Category', formSnapshot.category || '—'],
                    ].map(([label, val]) => (
                      <Col span={12} key={label}>
                        <div style={{ marginBottom: 12 }}>
                          <Text type="secondary" style={{ fontSize: 11 }}>{label}</Text>
                          <div style={{ fontWeight: 600 }}>{val || '—'}</div>
                        </div>
                      </Col>
                    ))}
                  </Row>
                  <Divider />
                  <Alert message="By submitting, you confirm all information is correct and accurate." type="info" />
                </div>
              )}
            </Form>
          </Spin>

          {/* Navigation */}
          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
            <Button icon={<ArrowLeftOutlined />} onClick={prev} disabled={current === 0}>
              Previous
            </Button>
            {current < STEPS.length - 1 ? (
              <Button type="primary" icon={<ArrowRightOutlined />} iconPosition="end" onClick={next}>
                Next Step
              </Button>
            ) : (
              <Button type="primary" icon={<SendOutlined />} loading={loading} onClick={handleSubmit}
                style={{ background: '#16A34A', borderColor: '#16A34A' }}>
                Submit Application
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

// Step field map for per-step validation
function getStepFields(step) {
  return [
    ['classId', 'boardingType'],
    ['studentName', 'gender', 'dateOfBirth'],
    [],
    ['parentName', 'parentPhone'],
    [],
    [],
  ][step] || [];
}

export default OnlineAdmission;
