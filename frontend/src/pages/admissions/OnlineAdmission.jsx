import React, { useState, useEffect } from 'react';
import {
  Steps, Form, Input, Select, DatePicker, Radio, Button, Upload, Card,
  Typography, Descriptions, Divider, Result, Space, Row, Col, App, Spin, Tag,
} from 'antd';
import {
  UserOutlined, TeamOutlined, BookOutlined, HeartOutlined,
  CloudUploadOutlined, CreditCardOutlined, CheckCircleOutlined,
  ArrowLeftOutlined, ArrowRightOutlined, FileImageOutlined,
  IdcardOutlined, SafetyCertificateOutlined, FileTextOutlined,
  HomeFilled,
} from '@ant-design/icons';
import { onlineAdmissionAPI, paymentAPI, publicUploadAPI } from '@/services/api';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

// ─── Step Definitions ───────────────────────────────────────
const STEPS = [
  { title: 'Student', icon: <UserOutlined /> },
  { title: 'Parent', icon: <TeamOutlined /> },
  { title: 'Academic', icon: <BookOutlined /> },
  { title: 'Medical', icon: <HeartOutlined /> },
  { title: 'Documents', icon: <CloudUploadOutlined /> },
  { title: 'Review & Pay', icon: <CreditCardOutlined /> },
];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

const DOCUMENT_TYPES = [
  { key: 'student_photo', label: 'Student Photo', icon: <FileImageOutlined /> },
  { key: 'aadhaar', label: 'Aadhaar Card', icon: <IdcardOutlined /> },
  { key: 'birth_certificate', label: 'Birth Certificate', icon: <SafetyCertificateOutlined /> },
  { key: 'report_card', label: 'Previous Report Card', icon: <FileTextOutlined /> },
];

const OnlineAdmission = () => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({});
  const [classes, setClasses] = useState([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [documents, setDocuments] = useState({});
  const [uploading, setUploading] = useState({});
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);

  // Load classes on mount
  useEffect(() => {
    const loadClasses = async () => {
      try {
        const res = await onlineAdmissionAPI.getClasses();
        setClasses(res.data?.classes || []);
      } catch (err) {
        message.error('Failed to load classes. Please refresh.');
      } finally {
        setClassesLoading(false);
      }
    };
    loadClasses();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Step Navigation ──────────────────────────────────────
  const handleNext = async () => {
    try {
      const values = await form.validateFields();
      const merged = { ...formData, ...values };
      setFormData(merged);
      setCurrentStep((prev) => prev + 1);
    } catch {
      // validation errors shown by antd
    }
  };

  const handlePrev = () => {
    const values = form.getFieldsValue();
    setFormData({ ...formData, ...values });
    setCurrentStep((prev) => prev - 1);
  };

  // ─── Document Upload ──────────────────────────────────────
  const handleDocumentUpload = async (file, docKey) => {
    setUploading((prev) => ({ ...prev, [docKey]: true }));
    try {
      const res = await publicUploadAPI.upload(file);
      const docData = res.data || res;
      setDocuments((prev) => ({
        ...prev,
        [docKey]: {
          name: DOCUMENT_TYPES.find((d) => d.key === docKey)?.label || docKey,
          url: docData.url,
          publicId: docData.publicId,
        },
      }));
      message.success(`${DOCUMENT_TYPES.find((d) => d.key === docKey)?.label} uploaded`);
    } catch (err) {
      message.error(err.message || 'Upload failed');
    } finally {
      setUploading((prev) => ({ ...prev, [docKey]: false }));
    }
    return false; // prevent antd default upload
  };

  // ─── Load Razorpay Script ─────────────────────────────────
  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  // ─── Payment Flow ─────────────────────────────────────────
  const handlePayment = async () => {
    setPaymentLoading(true);
    try {
      // 1. Load Razorpay SDK
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        throw new Error('Failed to load Razorpay SDK. Please check your internet.');
      }

      // 2. Build the final admission data
      const allData = { ...formData };
      // Convert dateOfBirth from dayjs to ISO string
      if (allData.dateOfBirth && dayjs.isDayjs(allData.dateOfBirth)) {
        allData.dateOfBirth = allData.dateOfBirth.toISOString();
      }
      // Attach uploaded documents
      allData.documents = Object.values(documents);
      // Set parentName from fatherName if not set
      if (!allData.parentName) {
        allData.parentName = allData.fatherName || allData.motherName || 'Parent';
      }

      // 3. Create Razorpay order
      const orderRes = await paymentAPI.createOrder({
        studentName: allData.studentName,
      });
      const orderData = orderRes.data;

      // 4. Open Razorpay Checkout
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'VMS School',
        description: 'Admission Application Fee',
        order_id: orderData.orderId,
        handler: async (response) => {
          // 5. Verify payment on backend
          try {
            const verifyRes = await paymentAPI.verify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              admissionData: allData,
            });

            const result = verifyRes.data;
            setSubmissionResult({
              success: true,
              applicationNo: result.applicationNo || result.admission?.applicationNo,
              studentName: allData.studentName,
            });
            message.success('Application submitted successfully!');
          } catch (err) {
            setSubmissionResult({
              success: false,
              error: err.message || 'Payment verification failed',
            });
            message.error(err.message || 'Payment verification failed');
          }
          setPaymentLoading(false);
        },
        modal: {
          ondismiss: () => {
            setPaymentLoading(false);
            message.info('Payment cancelled');
          },
        },
        prefill: {
          name: allData.fatherName || allData.parentName || '',
          email: allData.parentEmail || '',
          contact: allData.parentPhone || '',
        },
        theme: {
          color: '#1B3A5C',
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (response) => {
        setPaymentLoading(false);
        setSubmissionResult({
          success: false,
          error: response.error?.description || 'Payment failed',
        });
        message.error(response.error?.description || 'Payment failed');
      });
      rzp.open();
    } catch (err) {
      setPaymentLoading(false);
      message.error(err.message || 'Failed to initiate payment');
    }
  };

  // ─── If submission complete, show result ───────────────────
  if (submissionResult) {
    return (
      <div className="admission-page">
        <div className="admission-container">
          <Card className="admission-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
            {submissionResult.success ? (
              <Result
                status="success"
                icon={<CheckCircleOutlined style={{ color: '#22C55E' }} />}
                title="Application Submitted Successfully!"
                subTitle={
                  <div>
                    <Paragraph style={{ fontSize: 16, marginBottom: 8 }}>
                      Student: <strong>{submissionResult.studentName}</strong>
                    </Paragraph>
                    <Paragraph style={{ fontSize: 16, marginBottom: 8 }}>
                      Application No: <Tag color="blue" style={{ fontSize: 16, padding: '4px 12px' }}>{submissionResult.applicationNo}</Tag>
                    </Paragraph>
                    <Paragraph type="secondary" style={{ marginTop: 16 }}>
                      Please save your application number for future reference.
                      You can track your application status at any time.
                    </Paragraph>
                  </div>
                }
                extra={[
                  <Button
                    key="status"
                    type="primary"
                    size="large"
                    onClick={() => window.location.href = '/admission-status'}
                  >
                    Check Status
                  </Button>,
                  <Button
                    key="new"
                    size="large"
                    onClick={() => window.location.reload()}
                  >
                    New Application
                  </Button>,
                ]}
              />
            ) : (
              <Result
                status="error"
                title="Submission Failed"
                subTitle={submissionResult.error || 'Something went wrong. Please try again.'}
                extra={[
                  <Button
                    key="retry"
                    type="primary"
                    size="large"
                    onClick={() => {
                      setSubmissionResult(null);
                      setPaymentLoading(false);
                    }}
                  >
                    Try Again
                  </Button>,
                ]}
              />
            )}
          </Card>
        </div>
      </div>
    );
  }

  // ─── Step Content Renderers ────────────────────────────────
  const renderStep1 = () => (
    <div className="step-content">
      <Title level={5} style={{ marginBottom: 20, color: '#1B3A5C' }}>
        <UserOutlined style={{ marginRight: 8 }} />Student Information
      </Title>
      <Row gutter={[16, 0]}>
        <Col xs={24} md={12}>
          <Form.Item name="studentName" label="Full Name" rules={[{ required: true, message: 'Student name is required' }]}>
            <Input placeholder="Enter student's full name" size="large" id="admission-student-name" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name="gender" label="Gender" rules={[{ required: true, message: 'Gender is required' }]}>
            <Select placeholder="Select gender" size="large" id="admission-gender"
              options={[
                { label: 'Male', value: 'male' },
                { label: 'Female', value: 'female' },
                { label: 'Other', value: 'other' },
              ]}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name="dateOfBirth" label="Date of Birth" rules={[{ required: true, message: 'DOB is required' }]}>
            <DatePicker
              placeholder="Select date of birth"
              size="large"
              style={{ width: '100%' }}
              format="DD/MM/YYYY"
              disabledDate={(current) => current && current > dayjs().endOf('day')}
              id="admission-dob"
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name="classId" label="Class Applying For" rules={[{ required: true, message: 'Class is required' }]}>
            <Select
              placeholder="Select class"
              size="large"
              loading={classesLoading}
              id="admission-class"
              options={classes.map((c) => ({ label: c.name, value: c._id }))}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name="type" label="Admission Type" rules={[{ required: true, message: 'Type is required' }]}>
            <Radio.Group id="admission-type">
              <Radio.Button value="day-boarding">Day Boarding</Radio.Button>
              <Radio.Button value="residential">Residential</Radio.Button>
            </Radio.Group>
          </Form.Item>
        </Col>
      </Row>
    </div>
  );

  const renderStep2 = () => (
    <div className="step-content">
      <Title level={5} style={{ marginBottom: 20, color: '#1B3A5C' }}>
        <TeamOutlined style={{ marginRight: 8 }} />Parent / Guardian Information
      </Title>
      <Row gutter={[16, 0]}>
        <Col xs={24} md={12}>
          <Form.Item name="fatherName" label="Father's Name" rules={[{ required: true, message: "Father's name is required" }]}>
            <Input placeholder="Enter father's name" size="large" id="admission-father" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name="motherName" label="Mother's Name">
            <Input placeholder="Enter mother's name" size="large" id="admission-mother" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name="parentPhone" label="Phone Number" rules={[
            { required: true, message: 'Phone is required' },
            { pattern: /^[6-9]\d{9}$/, message: 'Enter a valid 10-digit mobile number' },
          ]}>
            <Input placeholder="Enter mobile number" size="large" maxLength={10} id="admission-phone" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name="parentEmail" label="Email Address" rules={[{ type: 'email', message: 'Enter a valid email' }]}>
            <Input placeholder="Enter email address" size="large" id="admission-email" />
          </Form.Item>
        </Col>
        <Col xs={24}>
          <Form.Item name="address" label="Residential Address" rules={[{ required: true, message: 'Address is required' }]}>
            <TextArea rows={3} placeholder="Enter full residential address" size="large" id="admission-address" />
          </Form.Item>
        </Col>
      </Row>
    </div>
  );

  const renderStep3 = () => (
    <div className="step-content">
      <Title level={5} style={{ marginBottom: 20, color: '#1B3A5C' }}>
        <BookOutlined style={{ marginRight: 8 }} />Academic Information
      </Title>
      <Row gutter={[16, 0]}>
        <Col xs={24} md={12}>
          <Form.Item name="previousSchool" label="Previous School Name">
            <Input placeholder="Enter previous school name" size="large" id="admission-prev-school" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name="previousBoard" label="Board / Affiliation">
            <Select placeholder="Select board" size="large" allowClear id="admission-board"
              options={[
                { label: 'CBSE', value: 'CBSE' },
                { label: 'ICSE', value: 'ICSE' },
                { label: 'State Board', value: 'State Board' },
                { label: 'IB', value: 'IB' },
                { label: 'Other', value: 'Other' },
              ]}
            />
          </Form.Item>
        </Col>
        <Col xs={24}>
          <Form.Item name="hasTC" label="Do you have a Transfer Certificate (TC)?">
            <Radio.Group id="admission-tc">
              <Radio value={true}>Yes</Radio>
              <Radio value={false}>No</Radio>
            </Radio.Group>
          </Form.Item>
        </Col>
      </Row>
    </div>
  );

  const renderStep4 = () => (
    <div className="step-content">
      <Title level={5} style={{ marginBottom: 20, color: '#1B3A5C' }}>
        <HeartOutlined style={{ marginRight: 8 }} />Medical Information
      </Title>
      <Row gutter={[16, 0]}>
        <Col xs={24} md={12}>
          <Form.Item name="bloodGroup" label="Blood Group">
            <Select placeholder="Select blood group" size="large" allowClear id="admission-blood-group"
              options={BLOOD_GROUPS.map((bg) => ({ label: bg, value: bg }))}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name="allergies" label="Known Allergies">
            <Input placeholder="e.g., Dust, Peanuts (or None)" size="large" id="admission-allergies" />
          </Form.Item>
        </Col>
        <Col xs={24}>
          <Form.Item name="medicalConditions" label="Existing Medical Conditions">
            <TextArea rows={3} placeholder="e.g., Asthma, Diabetes (or None)" size="large" id="admission-medical" />
          </Form.Item>
        </Col>
      </Row>
    </div>
  );

  const renderStep5 = () => (
    <div className="step-content">
      <Title level={5} style={{ marginBottom: 20, color: '#1B3A5C' }}>
        <CloudUploadOutlined style={{ marginRight: 8 }} />Document Upload
      </Title>
      <Paragraph type="secondary" style={{ marginBottom: 20 }}>
        Upload the following documents (JPEG, PNG, or PDF — max 5MB each). All documents are optional but recommended.
      </Paragraph>
      <Row gutter={[16, 16]}>
        {DOCUMENT_TYPES.map((doc) => (
          <Col xs={24} sm={12} key={doc.key}>
            <Card
              size="small"
              className={`doc-upload-card ${documents[doc.key] ? 'doc-uploaded' : ''}`}
              style={{ textAlign: 'center' }}
            >
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontSize: 20, color: documents[doc.key] ? '#22C55E' : '#94A3B8' }}>
                  {documents[doc.key] ? <CheckCircleOutlined /> : doc.icon}
                </span>
                <div style={{ marginTop: 4 }}>
                  <Text strong style={{ fontSize: 13 }}>{doc.label}</Text>
                </div>
              </div>
              {documents[doc.key] ? (
                <div>
                  <Tag color="success" style={{ marginBottom: 8 }}>Uploaded ✓</Tag>
                  <br />
                  <Button
                    size="small"
                    type="link"
                    danger
                    onClick={() => {
                      setDocuments((prev) => {
                        const copy = { ...prev };
                        delete copy[doc.key];
                        return copy;
                      });
                    }}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <Upload
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  maxCount={1}
                  showUploadList={false}
                  beforeUpload={(file) => handleDocumentUpload(file, doc.key)}
                  id={`upload-${doc.key}`}
                >
                  <Button
                    icon={<CloudUploadOutlined />}
                    loading={uploading[doc.key]}
                    size="small"
                  >
                    {uploading[doc.key] ? 'Uploading...' : 'Choose File'}
                  </Button>
                </Upload>
              )}
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );

  const renderStep6 = () => {
    const allData = { ...formData, ...form.getFieldsValue() };
    const selectedClass = classes.find((c) => c._id === allData.classId);
    const admissionFee = 500; // ₹500

    return (
      <div className="step-content">
        <Title level={5} style={{ marginBottom: 20, color: '#1B3A5C' }}>
          <CreditCardOutlined style={{ marginRight: 8 }} />Review & Payment
        </Title>

        <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small" labelStyle={{ fontWeight: 500, width: 160 }}>
          <Descriptions.Item label="Student Name">{allData.studentName}</Descriptions.Item>
          <Descriptions.Item label="Gender"><span style={{ textTransform: 'capitalize' }}>{allData.gender}</span></Descriptions.Item>
          <Descriptions.Item label="Date of Birth">
            {allData.dateOfBirth ? dayjs(allData.dateOfBirth).format('DD/MM/YYYY') : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Class">{selectedClass?.name || '—'}</Descriptions.Item>
          <Descriptions.Item label="Type"><span style={{ textTransform: 'capitalize' }}>{allData.type || '—'}</span></Descriptions.Item>
          <Descriptions.Item label="Father's Name">{allData.fatherName || '—'}</Descriptions.Item>
          <Descriptions.Item label="Mother's Name">{allData.motherName || '—'}</Descriptions.Item>
          <Descriptions.Item label="Phone">{allData.parentPhone || '—'}</Descriptions.Item>
          <Descriptions.Item label="Email">{allData.parentEmail || '—'}</Descriptions.Item>
          <Descriptions.Item label="Address" span={2}>{allData.address || '—'}</Descriptions.Item>
          <Descriptions.Item label="Previous School">{allData.previousSchool || '—'}</Descriptions.Item>
          <Descriptions.Item label="Board">{allData.previousBoard || '—'}</Descriptions.Item>
          <Descriptions.Item label="Has TC">{allData.hasTC ? 'Yes' : 'No'}</Descriptions.Item>
          <Descriptions.Item label="Blood Group">{allData.bloodGroup || '—'}</Descriptions.Item>
          <Descriptions.Item label="Allergies">{allData.allergies || 'None'}</Descriptions.Item>
          <Descriptions.Item label="Medical Conditions">{allData.medicalConditions || 'None'}</Descriptions.Item>
        </Descriptions>

        {/* Documents summary */}
        <Divider orientation="left" style={{ fontSize: 13 }}>Uploaded Documents</Divider>
        <div style={{ marginBottom: 24 }}>
          {Object.keys(documents).length > 0 ? (
            <Space wrap>
              {Object.entries(documents).map(([key, doc]) => (
                <Tag key={key} color="blue" icon={<CheckCircleOutlined />}>{doc.name}</Tag>
              ))}
            </Space>
          ) : (
            <Text type="secondary">No documents uploaded</Text>
          )}
        </div>

        {/* Payment summary */}
        <Card className="payment-summary-card" style={{ background: 'linear-gradient(135deg, #1B3A5C 0%, #2563EB 100%)', color: '#FFF', borderRadius: 12 }}>
          <Row justify="space-between" align="middle">
            <Col>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>Application Fee</Text>
              <Title level={3} style={{ color: '#FFF', margin: '4px 0 0' }}>₹{admissionFee}</Title>
            </Col>
            <Col>
              <Button
                type="primary"
                size="large"
                icon={<CreditCardOutlined />}
                onClick={handlePayment}
                loading={paymentLoading}
                style={{
                  height: 48,
                  fontSize: 16,
                  background: '#22C55E',
                  borderColor: '#22C55E',
                  borderRadius: 8,
                  fontWeight: 600,
                }}
                id="proceed-to-payment-btn"
              >
                {paymentLoading ? 'Processing...' : 'Proceed to Payment'}
              </Button>
            </Col>
          </Row>
        </Card>
      </div>
    );
  };

  const stepRenderers = [renderStep1, renderStep2, renderStep3, renderStep4, renderStep5, renderStep6];

  return (
    <div className="admission-page">
      {/* Header */}
      <div className="admission-header">
        <div className="admission-header-content">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <HomeFilled style={{ fontSize: 28, color: '#FFF' }} />
            <div>
              <Title level={3} style={{ color: '#FFF', margin: 0 }}>VMS School</Title>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>Online Admission Application</Text>
            </div>
          </div>
          <Button
            type="text"
            style={{ color: '#FFF' }}
            onClick={() => window.location.href = '/admission-status'}
          >
            Check Status →
          </Button>
        </div>
      </div>

      <div className="admission-container">
        {/* Steps */}
        <Card className="steps-card" style={{ marginBottom: 24 }}>
          <Steps
            current={currentStep}
            size="small"
            responsive={false}
            items={STEPS.map((s, idx) => ({
              title: <span className="step-label">{s.title}</span>,
              icon: s.icon,
              status: idx < currentStep ? 'finish' : idx === currentStep ? 'process' : 'wait',
            }))}
          />
        </Card>

        {/* Form Content */}
        <Card className="admission-card">
          {classesLoading && currentStep === 0 ? (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <Spin size="large" />
              <div style={{ marginTop: 16 }}><Text type="secondary">Loading...</Text></div>
            </div>
          ) : (
            <Form
              form={form}
              layout="vertical"
              initialValues={formData}
              size="large"
              requiredMark="optional"
            >
              {stepRenderers[currentStep]()}
            </Form>
          )}

          {/* Navigation Buttons */}
          {currentStep < 5 && (
            <div className="step-actions">
              {currentStep > 0 && (
                <Button
                  icon={<ArrowLeftOutlined />}
                  onClick={handlePrev}
                  size="large"
                  id="step-prev-btn"
                >
                  Previous
                </Button>
              )}
              <div style={{ flex: 1 }} />
              {currentStep < 5 && (
                <Button
                  type="primary"
                  onClick={currentStep === 4 ? () => {
                    setFormData({ ...formData, ...form.getFieldsValue() });
                    setCurrentStep(5);
                  } : handleNext}
                  size="large"
                  style={{ minWidth: 140 }}
                  id="step-next-btn"
                >
                  {currentStep === 4 ? 'Review Application' : 'Next'} <ArrowRightOutlined />
                </Button>
              )}
            </div>
          )}
          {currentStep === 5 && (
            <div className="step-actions" style={{ marginTop: 16 }}>
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={handlePrev}
                size="large"
                id="step-prev-btn-review"
              >
                Go Back & Edit
              </Button>
            </div>
          )}
        </Card>
      </div>

      {/* Footer */}
      <div className="admission-footer">
        <Text type="secondary" style={{ fontSize: 12 }}>
          © {new Date().getFullYear()} VMS School — All rights reserved. For queries, contact the school office.
        </Text>
      </div>
    </div>
  );
};

export default OnlineAdmission;
