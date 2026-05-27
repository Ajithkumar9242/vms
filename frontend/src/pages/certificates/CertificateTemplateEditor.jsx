import { useState, useEffect, useRef } from 'react';
import {
  Form, Input, Select, Switch, Button, Typography, Space,
  Divider, Card, Row, Col, App, Tooltip, Upload, Spin, Tabs, Slider, Radio, Alert,
  Tag,
} from 'antd';
import {
  SaveOutlined, ArrowLeftOutlined, UploadOutlined, InfoCircleOutlined,
  DeleteOutlined, FileTextOutlined, FontSizeOutlined, PictureOutlined,
  FontColorsOutlined, BoldOutlined, ItalicOutlined, UnderlineOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import api, { certificateAPI } from '@/services/api';
import { ERP_COLORS } from '@/theme/colors';

const { Title, Text } = Typography;
const { TextArea } = Input;

// ── All available template variables ─────────────────────────────────────
const VARIABLES = [
  {
    group: 'Student', vars: [
      { key: 'studentName', label: 'Full Name', placeholder: '[Student Full Name]' },
      { key: 'firstName', label: 'First Name', placeholder: '[First Name]' },
      { key: 'lastName', label: 'Last Name', placeholder: '[Last Name]' },
      { key: 'admissionNo', label: 'Admission No', placeholder: '[Admission No]' },
      { key: 'rollNo', label: 'Roll No', placeholder: '[Roll No]' },
      { key: 'registerNo', label: 'Register No', placeholder: '[Register No]' },
      { key: 'className', label: 'Class', placeholder: '[Class Name]' },
      { key: 'sectionName', label: 'Section', placeholder: '[Section Name]' },
      { key: 'dateOfBirth', label: 'Date of Birth', placeholder: '[Date of Birth]' },
      { key: 'gender', label: 'Gender', placeholder: '[Gender]' },
      { key: 'bloodGroup', label: 'Blood Group', placeholder: '[Blood Group]' },
      { key: 'nationality', label: 'Nationality', placeholder: '[Nationality]' },
      { key: 'religion', label: 'Religion', placeholder: '[Religion]' },
      { key: 'caste', label: 'Caste', placeholder: '[Caste]' },
    ]
  },
  {
    group: 'Parent / Contact', vars: [
      { key: 'parentName', label: 'Parent Name', placeholder: '[Parent Name]' },
      { key: 'fatherName', label: 'Father Name', placeholder: '[Father Name]' },
      { key: 'motherName', label: 'Mother Name', placeholder: '[Mother Name]' },
      { key: 'address', label: 'Address', placeholder: '[Address]' },
      { key: 'phone', label: 'Phone', placeholder: '[Phone]' },
    ]
  },
  {
    group: 'School / Date', vars: [
      { key: 'schoolName', label: 'School Name', placeholder: '[School Name]' },
      { key: 'schoolAddress', label: 'School Address', placeholder: '[School Address]' },
      { key: 'schoolPhone', label: 'School Phone', placeholder: '[School Phone]' },
      { key: 'academicYear', label: 'Academic Year', placeholder: '[Academic Year]' },
      { key: 'date', label: "Today's Date", placeholder: '[Current Date]' },
      { key: 'principalName', label: 'Principal Name', placeholder: '[Principal Name]' },
      { key: 'principalDesignation', label: 'Principal Designation', placeholder: '[Principal Designation]' },
    ]
  },
];

const PREDEFINED_TEMPLATES = {
  study: {
    name: 'Study Certificate',
    title: 'STUDY CERTIFICATE',
    content: 'This is to certify that {{studentName}}, son/daughter of {{parentName}}, is/was a bonafide student of this institution studying in Class {{className}} (Section {{sectionName}}) with Admission No. {{admissionNo}} and Roll No. {{rollNo}} during the academic year {{academicYear}}.\n\nAccording to our official school records, his/her date of birth is {{dateOfBirth}}.\n\nHe/She bears a good moral character and conduct during the stay in the school.',
    headerText: 'TO WHOMSOEVER IT MAY CONCERN',
    footerText: 'This certificate is issued on official request for study and higher education purposes.',
    fontFamily: 'Times New Roman',
    fontSize: 12,
    textAlign: 'justify',
    bold: false,
    italic: false,
    underline: false,
    lineHeight: 1.8,
    textColor: '#1e293b',
    spacingBeforeSignature: 60,
    useSchoolLetterhead: true,
    footerAlign: 'center',
    principalName: '',
    principalDesignation: 'Principal',
  },
  transfer: {
    name: 'Transfer Certificate',
    title: 'TRANSFER CERTIFICATE',
    content: '1. Name of the Student: {{studentName}}\n2. Father\'s / Guardian\'s Name: {{fatherName}}\n3. Mother\'s Name: {{motherName}}\n4. Admission Number: {{admissionNo}}  |  Roll Number: {{rollNo}}\n5. Date of Birth (as per records): {{dateOfBirth}}\n6. Class in which student last studied: Class {{className}} (Section {{sectionName}})\n7. Academic Session: {{academicYear}}\n8. General Conduct of student: Satisfactory & Good\n9. Date of Application for Certificate: {{date}}\n10. Reason for leaving the School: Completed academic term / Transferred',
    headerText: 'OFFICIAL TRANSFER RECORD',
    footerText: 'Any alteration or tampering on this certificate will result in immediate cancellation.',
    fontFamily: 'Arial',
    fontSize: 11,
    textAlign: 'left',
    bold: false,
    italic: false,
    underline: false,
    lineHeight: 1.6,
    textColor: '#0f172a',
    spacingBeforeSignature: 50,
    useSchoolLetterhead: true,
    footerAlign: 'center',
    principalName: '',
    principalDesignation: 'Principal',
  },
  bonafide: {
    name: 'Bonafide Certificate',
    title: 'BONAFIDE CERTIFICATE',
    content: 'This is to certify that {{studentName}}, son/daughter of {{parentName}}, is a bonafide student of {{schoolName}}, studying in Class {{className}} (Section {{sectionName}}) with Admission No. {{admissionNo}} and Roll No. {{rollNo}} during the academic year {{academicYear}}.\n\nHe/She bears a good moral character and has shown sincere discipline in all activities during the period.',
    headerText: 'TO WHOM IT MAY CONCERN',
    footerText: 'This certificate is valid for the current academic session only.',
    fontFamily: 'Times New Roman',
    fontSize: 12,
    textAlign: 'justify',
    bold: false,
    italic: false,
    underline: false,
    lineHeight: 1.8,
    textColor: '#0f172a',
    spacingBeforeSignature: 60,
    useSchoolLetterhead: true,
    footerAlign: 'center',
    principalName: '',
    principalDesignation: 'Principal',
  },
  character: {
    name: 'Character & Conduct Certificate',
    title: 'CHARACTER & CONDUCT CERTIFICATE',
    content: 'This is to certify that {{studentName}}, son/daughter of {{parentName}}, studying in Class {{className}} (Section {{sectionName}}) with Admission No. {{admissionNo}} is personally known to me.\n\nTo the best of my knowledge and belief, he/she bears a good moral character and has shown exemplary discipline, respect, and academic dedication during his/her tenure at this institution.',
    headerText: 'CONFIDENTIAL CHARACTER RECORD',
    footerText: 'Issued without any erasure or corrections.',
    fontFamily: 'Georgia',
    fontSize: 12,
    textAlign: 'justify',
    bold: false,
    italic: false,
    underline: false,
    lineHeight: 1.8,
    textColor: '#030712',
    spacingBeforeSignature: 65,
    useSchoolLetterhead: true,
    footerAlign: 'center',
    principalName: '',
    principalDesignation: 'Principal',
  },
  conduct: {
    name: 'Conduct Certificate',
    title: 'CONDUCT CERTIFICATE',
    content: 'This is to certify that {{studentName}} has been studying at our school in Class {{className}}.\n\nDuring his/her study period in the school, his/her general conduct and behavior towards teachers, staff, and classmates has been extremely polite, obedient, and helpful.\n\nWe wish him/her the very best of luck in his/her future path.',
    headerText: 'TO WHOMSOEVER IT MAY CONCERN',
    footerText: 'Issued under the authority of the school board.',
    fontFamily: 'Times New Roman',
    fontSize: 12,
    textAlign: 'justify',
    bold: false,
    italic: false,
    underline: false,
    lineHeight: 1.8,
    textColor: '#0f172a',
    spacingBeforeSignature: 60,
    useSchoolLetterhead: true,
    footerAlign: 'center',
    principalName: '',
    principalDesignation: 'Principal',
  },
};

const CERT_TYPES = [
  { value: 'study', label: 'Study Certificate' },
  { value: 'transfer', label: 'Transfer Certificate' },
  { value: 'bonafide', label: 'Bonafide Certificate' },
  { value: 'character', label: 'Character Certificate' },
  { value: 'conduct', label: 'Conduct Certificate' },
  { value: 'participation', label: 'Participation Certificate' },
  { value: 'merit', label: 'Merit Certificate' },
  { value: 'custom', label: 'Custom' },
];

const DEFAULT_CONTENT = `This is to certify that {{studentName}}, son/daughter of {{parentName}}, studying in Class {{className}} (Section {{sectionName}}) with Admission No. {{admissionNo}} and Roll No. {{rollNo}} is a bonafide student of this institution for the academic year {{academicYear}}.

He/She bears a good moral character and is well-behaved during his/her stay in this institution.

This certificate is issued on request for the purpose stated by the student/parent.`;

const CertificateTemplateEditor = () => {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const [form] = Form.useForm();
  const contentRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Live preview tracking state
  const [previewState, setPreviewState] = useState({
    name: '',
    type: 'custom',
    title: '',
    headerText: '',
    content: DEFAULT_CONTENT,
    footerText: '',
    fontFamily: 'Times New Roman',
    fontSize: 12,
    textAlign: 'justify',
    bold: false,
    italic: false,
    underline: false,
    lineHeight: 1.8,
    textColor: '#0f172a',
    spacingBeforeSignature: 60,
    useSchoolLetterhead: true,
    footerAlign: 'center',
    principalName: '',
    principalDesignation: 'Principal',
    signatureUrl: null,
    letterheadUrl: null,
  });

  const [uploadingSig, setUploadingSig] = useState(false);
  const [uploadingLh, setUploadingLh] = useState(false);

  // Load existing template if editing
  useEffect(() => {
    if (!isEdit) {
      const initial = {
        name: '',
        type: 'custom',
        useSchoolLetterhead: true,
        fontFamily: 'Times New Roman',
        fontSize: 12,
        textAlign: 'justify',
        bold: false,
        italic: false,
        underline: false,
        lineHeight: 1.8,
        textColor: '#0f172a',
        spacingBeforeSignature: 60,
        footerAlign: 'center',
        content: DEFAULT_CONTENT,
        principalName: '',
        principalDesignation: 'Principal',
        title: 'CERTIFICATE OF BONAFIDE',
        headerText: 'TO WHOM IT MAY CONCERN',
        footerText: 'This is an official document from the school administration.'
      };
      form.setFieldsValue(initial);
      setPreviewState(initial);
      return;
    }
    setLoading(true);
    certificateAPI.getTemplate(id)
      .then((res) => {
        const tpl = res.data?.template || res.data || res;
        form.setFieldsValue(tpl);
        setPreviewState(tpl);
      })
      .catch((e) => message.error(e.message || 'Failed to load template'))
      .finally(() => setLoading(false));
  }, [id]);

  // Insert variable token at cursor position in the content textarea
  const insertVariable = (varKey) => {
    const token = `{{${varKey}}}`;
    const textarea = contentRef.current?.resizableTextArea?.textArea;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentVal = form.getFieldValue('content') || '';
      const newVal = currentVal.slice(0, start) + token + currentVal.slice(end);
      form.setFieldValue('content', newVal);
      setPreviewState((prev) => ({ ...prev, content: newVal }));
      // Restore cursor
      setTimeout(() => {
        textarea.setSelectionRange(start + token.length, start + token.length);
        textarea.focus();
      }, 0);
    } else {
      // Fallback: append
      const current = form.getFieldValue('content') || '';
      const newVal = current + token;
      form.setFieldValue('content', newVal);
      setPreviewState((prev) => ({ ...prev, content: newVal }));
    }
  };

  // Drag and drop variable insertion
  const handleDragStart = (e, varKey) => {
    e.dataTransfer.setData('text/plain', `{{${varKey}}}`);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const token = e.dataTransfer.getData('text/plain');
    if (!token || !token.startsWith('{{')) return;

    const textarea = contentRef.current?.resizableTextArea?.textArea;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentVal = form.getFieldValue('content') || '';
      const newVal = currentVal.slice(0, start) + token + currentVal.slice(end);
      form.setFieldValue('content', newVal);
      setPreviewState((prev) => ({ ...prev, content: newVal }));
      setTimeout(() => {
        textarea.setSelectionRange(start + token.length, start + token.length);
        textarea.focus();
      }, 0);
    }
  };

  // Image Upload handler (customRequest)
  const handleUpload = async (options, setUrlField, setUploading) => {
    const { file, onSuccess, onError } = options;
    const formData = new FormData();
    formData.append('file', file);
    setUploading(true);

    try {
      const res = await api.post('/upload?folder=logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = res.data?.data?.url || res.data?.url;
      if (!url) throw new Error('Upload returned empty URL');

      form.setFieldValue(setUrlField, url);
      setPreviewState((prev) => ({ ...prev, [setUrlField]: url }));
      onSuccess(url);
      message.success('Image uploaded successfully');
    } catch (err) {
      onError(err);
      message.error(err.message || 'Image upload failed');
    } finally {
      setUploading(false);
    }
  };

  // When type changes, prompt if predefined layout should load
  const handleTypeChange = (val) => {
    if (PREDEFINED_TEMPLATES[val]) {
      modal.confirm({
        title: 'Load Predefined Template Format?',
        content: `Would you like to overwrite your current fields with the standard layout and content for a ${PREDEFINED_TEMPLATES[val].name}?`,
        okText: 'Yes, Overwrite',
        cancelText: 'Keep Current',
        onOk: () => {
          const tpl = PREDEFINED_TEMPLATES[val];
          const newFields = {
            ...tpl,
            name: form.getFieldValue('name') || tpl.name,
          };
          form.setFieldsValue(newFields);
          setPreviewState(newFields);
        }
      });
    }
  };

  const handleSave = async (values) => {
    setSaving(true);
    try {
      if (isEdit) {
        await certificateAPI.updateTemplate(id, values);
        message.success('Template updated successfully');
      } else {
        await certificateAPI.createTemplate(values);
        message.success('Template created successfully');
      }
      navigate('/certificates/templates');
    } catch (e) {
      message.error(e.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spin size="large" /></div>;

  // Resolved preview body string
  const resolvedContentPreview = () => {
    let body = previewState.content || '';
    VARIABLES.forEach(({ vars }) => {
      vars.forEach((v) => {
        body = body.replaceAll(`{{${v.key}}}`, v.placeholder);
      });
    });
    return body;
  };

  // Map font families to standard CSS stacks
  const fontStacks = {
    'Times New Roman': '"Times New Roman", Times, Georgia, serif',
    'Georgia': 'Georgia, serif',
    'Arial': 'Arial, Helvetica, sans-serif',
    'Roboto': '"Roboto", "Helvetica Neue", Arial, sans-serif',
    'Helvetica': 'Helvetica, Arial, sans-serif',
  };

  return (
    <div style={{ maxWidth: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/certificates/templates')} />
        <div>
          <Title level={4} style={{ margin: 0 }}>
            {isEdit ? 'Certificate Designer' : 'Create Certificate Template'}
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Design professional certificate templates with real-time A4 print-matching layout preview.
          </Text>
        </div>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSave}
        onValuesChange={(changed, all) => setPreviewState({ ...all })}
      >
        <Row gutter={20}>
          {/* ── Left Editor Sidebar Panel (Form Controls) ── */}
          <Col xs={24} xl={10}>
            <Tabs defaultActiveKey="1" style={{ marginBottom: 20 }}>
              {/* Tab 1: Structure & Variables */}
              <Tabs.TabPane tab="1. Content & Vars" key="1">
                <Card size="small" style={{ marginBottom: 12 }}>
                  <Form.Item
                    name="name"
                    label={<span style={{ fontWeight: 600 }}>Template Name</span>}
                    rules={[{ required: true, message: 'Template name is required' }]}
                  >
                    <Input placeholder="e.g. 10th Standard Study Certificate" />
                  </Form.Item>

                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item name="type" label="Predefined Format">
                        <Select options={CERT_TYPES} onChange={handleTypeChange} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="title"
                        label="Title Heading"
                        rules={[{ required: true, message: 'Title is required' }]}
                      >
                        <Input placeholder="e.g. STUDY CERTIFICATE" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item name="headerText" label="Header Text (optional)">
                    <Input placeholder="e.g. TO WHOMSOEVER IT MAY CONCERN" />
                  </Form.Item>
                </Card>

                <Card
                  size="small"
                  title={<span style={{ fontSize: 13, fontWeight: 600 }}>Editor Content Body</span>}
                  bodyStyle={{ padding: 12 }}
                >
                  <Form.Item
                    name="content"
                    rules={[{ required: true, message: 'Content body is required' }]}
                    style={{ marginBottom: 8 }}
                  >
                    <TextArea
                      ref={contentRef}
                      rows={10}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleDrop}
                      style={{
                        fontFamily: fontStacks[previewState.fontFamily] || 'Times New Roman',
                        fontSize: previewState.fontSize || 12,
                        lineHeight: previewState.lineHeight || 1.8,
                        fontWeight: previewState.bold ? 'bold' : 'normal',
                        fontStyle: previewState.italic ? 'italic' : 'normal',
                        textDecoration: previewState.underline ? 'underline' : 'none',
                        color: previewState.textColor || '#0f172a',
                        border: '1px dashed #cbd5e1',
                        borderRadius: 4,
                        padding: 8,
                      }}
                      placeholder="Drag variables here or type {{variableName}}"
                    />
                  </Form.Item>

                  <Alert
                    message="💡 Drag variables below directly into the text editor, or click to insert at cursor position."
                    type="info"
                    showIcon
                    style={{ fontSize: 11, padding: '4px 8px', marginBottom: 12 }}
                  />

                  {/* Variables Palette */}
                  <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #f1f5f9', padding: 8, borderRadius: 6, background: '#f8fafc' }}>
                    {VARIABLES.map(({ group, vars }) => (
                      <div key={group} style={{ marginBottom: 10 }}>
                        <Text strong style={{ fontSize: 10, color: ERP_COLORS.primary, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                          {group}
                        </Text>
                        <Space wrap size={4}>
                          {vars.map(({ key, label }) => (
                            <Tooltip key={key} title="Drag me in!">
                              <Tag
                                draggable
                                onDragStart={(e) => handleDragStart(e, key)}
                                onClick={() => insertVariable(key)}
                                style={{ cursor: 'grab', fontSize: 11, margin: 0, userSelect: 'none', background: '#fff', border: '1px solid #cbd5e1' }}
                              >
                                {label}
                              </Tag>
                            </Tooltip>
                          ))}
                        </Space>
                      </div>
                    ))}
                  </div>
                </Card>
              </Tabs.TabPane>

              {/* Tab 2: Typography & Styling */}
              <Tabs.TabPane tab="2. Typography & Layout" key="2">
                <Card size="small" style={{ marginBottom: 12 }}>
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item name="fontFamily" label="Font Family">
                        <Select>
                          <Select.Option value="Times New Roman">Times New Roman (Classic Serif)</Select.Option>
                          <Select.Option value="Arial">Arial (Clean Sans-Serif)</Select.Option>
                          <Select.Option value="Georgia">Georgia (Formal Serif)</Select.Option>
                          <Select.Option value="Roboto">Roboto (Modern Sans-Serif)</Select.Option>
                          <Select.Option value="Helvetica">Helvetica (Swiss Style)</Select.Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="fontSize" label="Font Size">
                        <Select>
                          {[10, 11, 12, 13, 14, 16, 18, 20].map((s) => (
                            <Select.Option key={s} value={s}>{s}pt</Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item name="textAlign" label="Text Align">
                        <Radio.Group buttonStyle="solid" style={{ display: 'flex', width: '100%' }}>
                          <Radio.Button value="left" style={{ flex: 1, textAlign: 'center' }}>Left</Radio.Button>
                          <Radio.Button value="center" style={{ flex: 1, textAlign: 'center' }}>Center</Radio.Button>
                          <Radio.Button value="right" style={{ flex: 1, textAlign: 'center' }}>Right</Radio.Button>
                          <Radio.Button value="justify" style={{ flex: 1, textAlign: 'center' }}>Justify</Radio.Button>
                        </Radio.Group>
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="textColor" label="Text Color">
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Input
                            type="color"
                            value={previewState.textColor || '#000000'}
                            onChange={(e) => {
                              form.setFieldValue('textColor', e.target.value);
                              setPreviewState((prev) => ({ ...prev, textColor: e.target.value }));
                            }}
                            style={{ width: 50, padding: 0, height: 32, cursor: 'pointer' }}
                          />
                          <Input
                            value={previewState.textColor}
                            placeholder="#0f172a"
                            onChange={(e) => {
                              form.setFieldValue('textColor', e.target.value);
                              setPreviewState((prev) => ({ ...prev, textColor: e.target.value }));
                            }}
                          />
                        </div>
                      </Form.Item>
                    </Col>
                  </Row>

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 4px', border: '1px solid #f1f5f9', borderRadius: 4, marginBottom: 16 }}>
                    <Text strong style={{ fontSize: 13 }}>Text decoration styles:</Text>
                    <Space size={16}>
                      <Form.Item name="bold" valuePropName="checked" style={{ margin: 0 }}>
                        <Switch checkedChildren={<BoldOutlined />} unCheckedChildren={<BoldOutlined />} />
                      </Form.Item>
                      <Form.Item name="italic" valuePropName="checked" style={{ margin: 0 }}>
                        <Switch checkedChildren={<ItalicOutlined />} unCheckedChildren={<ItalicOutlined />} />
                      </Form.Item>
                      <Form.Item name="underline" valuePropName="checked" style={{ margin: 0 }}>
                        <Switch checkedChildren={<UnderlineOutlined />} unCheckedChildren={<UnderlineOutlined />} />
                      </Form.Item>
                    </Space>
                  </div>

                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item name="lineHeight" label="Line Height">
                        <Slider min={1.2} max={2.6} step={0.1} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="spacingBeforeSignature" label="Signature Spacing">
                        <Slider min={20} max={150} step={5} />
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>
              </Tabs.TabPane>

              {/* Tab 3: Branding & Signatures */}
              <Tabs.TabPane tab="3. Branding & Sign" key="3">
                <Card size="small" style={{ marginBottom: 12 }}>
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item name="useSchoolLetterhead" label="School Letterhead" valuePropName="checked">
                        <Switch checkedChildren="Show" unCheckedChildren="Hide" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="footerAlign" label="Footer Align">
                        <Select>
                          <Select.Option value="left">Left</Select.Option>
                          <Select.Option value="center">Center</Select.Option>
                          <Select.Option value="right">Right</Select.Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>

                  {/* Letterhead Upload */}
                  <div style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Custom Letterhead Banner Image</Text>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Upload
                        accept="image/*"
                        showUploadList={false}
                        customRequest={(opts) => handleUpload(opts, 'letterheadUrl', setUploadingLh)}
                      >
                        <Button icon={<UploadOutlined />} loading={uploadingLh}>Upload Image</Button>
                      </Upload>
                      {previewState.letterheadUrl && (
                        <Button danger icon={<DeleteOutlined />} onClick={() => {
                          form.setFieldValue('letterheadUrl', null);
                          setPreviewState(prev => ({ ...prev, letterheadUrl: null }));
                        }}>Remove</Button>
                      )}
                    </div>
                    {previewState.letterheadUrl && (
                      <img src={previewState.letterheadUrl} alt="Lh Preview" style={{ maxWidth: '100%', maxHeight: 40, marginTop: 8, objectFit: 'contain', border: '1px solid #cbd5e1', padding: 2 }} />
                    )}
                  </div>

                  {/* Signature Upload */}
                  <div style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Principal Signature Image</Text>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Upload
                        accept="image/*"
                        showUploadList={false}
                        customRequest={(opts) => handleUpload(opts, 'signatureUrl', setUploadingSig)}
                      >
                        <Button icon={<UploadOutlined />} loading={uploadingSig}>Upload Image</Button>
                      </Upload>
                      {previewState.signatureUrl && (
                        <Button danger icon={<DeleteOutlined />} onClick={() => {
                          form.setFieldValue('signatureUrl', null);
                          setPreviewState(prev => ({ ...prev, signatureUrl: null }));
                        }}>Remove</Button>
                      )}
                    </div>
                    {previewState.signatureUrl && (
                      <img src={previewState.signatureUrl} alt="Sig Preview" style={{ maxHeight: 35, marginTop: 8, objectFit: 'contain', border: '1px solid #cbd5e1', padding: 2 }} />
                    )}
                  </div>

                  <Divider style={{ margin: '12px 0' }} />

                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item name="principalName" label="Principal Name Override">
                        <Input placeholder="e.g. Dr. A. K. Sharma" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="principalDesignation" label="Designation Override">
                        <Input placeholder="Principal" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item name="footerText" label="Footer Disclaimer Text">
                    <Input placeholder="e.g. Valid only with authentic seal." />
                  </Form.Item>
                </Card>
              </Tabs.TabPane>
            </Tabs>

            {/* Actions Bar */}
            <div style={{ display: 'flex', gap: 10, background: '#f8fafc', padding: 12, borderRadius: 6, border: '1px solid #e2e8f0' }}>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                htmlType="submit"
                loading={saving}
                block
                style={{ background: ERP_COLORS.primary, borderColor: ERP_COLORS.primary, height: 38 }}
              >
                {isEdit ? 'Update Template' : 'Save Template'}
              </Button>
              <Button onClick={() => navigate('/certificates/templates')} style={{ height: 38 }}>
                Cancel
              </Button>
            </div>
          </Col>

          {/* ── Right Centered A4 Canvas Live Preview Pane ── */}
          <Col xs={24} xl={14}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#f1f5f9', padding: '16px 8px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <Text strong style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                Live A4 Document Print Preview
              </Text>

              {/* Document Container */}
              <div
                style={{
                  width: '100%',
                  maxWidth: '595px', // Standard A4 Aspect Ratio width (approx)
                  background: '#ffffff',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.1)',
                  borderRadius: 2,
                  border: `2px solid ${previewState.textColor || '#c2410c'}`,
                  padding: '4px',
                  boxSizing: 'border-box',
                }}
              >
                <div
                  style={{
                    border: `1px solid ${previewState.textColor || '#c2410c'}`,
                    padding: '36px 42px',
                    minHeight: '680px',
                    boxSizing: 'border-box',
                    fontFamily: fontStacks[previewState.fontFamily] || fontStacks['Times New Roman'],
                    fontSize: `${previewState.fontSize || 12}px`,
                    position: 'relative',
                  }}
                >
                  {/* Letterhead */}
                  {previewState.letterheadUrl ? (
                    <div style={{ textAlign: 'center', marginBottom: 20 }}>
                      <img src={previewState.letterheadUrl} alt="Lh Preview" style={{ width: '100%', maxHeight: 80, objectFit: 'contain' }} />
                    </div>
                  ) : previewState.useSchoolLetterhead !== false ? (
                    <div style={{ textAlign: 'center', marginBottom: 20, paddingBottom: 12, borderBottom: '2px solid #cbd5e1' }}>
                      <Text style={{ fontSize: 16, fontWeight: 700, color: previewState.textColor || '#c2410c', display: 'block' }}>
                        VIKRAMASILA MODEL SCHOOL
                      </Text>
                      <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>
                        12, Mahatma Gandhi Road, Bangalore, Karnataka - 560001
                      </Text>
                      <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>
                        Phone: +91 80 2345 6789 | Email: contact@vms.edu.in
                      </Text>
                    </div>
                  ) : (
                    <div style={{ height: 15 }} />
                  )}

                  {/* Title */}
                  <div style={{ textAlign: 'center', marginBottom: 18 }}>
                    <Text style={{
                      fontSize: 20,
                      fontWeight: 800,
                      letterSpacing: 2,
                      color: previewState.textColor || '#c2410c',
                      textTransform: 'uppercase',
                      display: 'block'
                    }}>
                      {previewState.title || 'CERTIFICATE TITLE'}
                    </Text>
                    <div style={{ height: 2, width: 160, background: previewState.textColor || '#c2410c', margin: '4px auto 1px', borderRadius: 2 }} />
                    <div style={{ height: 0.8, width: 100, background: previewState.textColor || '#c2410c', margin: '0 auto' }} />
                  </div>

                  {/* Subtitle / Header Text */}
                  {previewState.headerText && (
                    <div style={{ textAlign: 'center', marginBottom: 16, color: '#64748b', fontSize: 10, fontStyle: 'italic' }}>
                      {previewState.headerText}
                    </div>
                  )}

                  {/* Body Content */}
                  <div style={{
                    lineHeight: previewState.lineHeight || 1.8,
                    textAlign: previewState.textAlign || 'justify',
                    fontWeight: previewState.bold ? 'bold' : 'normal',
                    fontStyle: previewState.italic ? 'italic' : 'normal',
                    textDecoration: previewState.underline ? 'underline' : 'none',
                    color: previewState.textColor || '#0f172a',
                    whiteSpace: 'pre-wrap',
                    minHeight: 180,
                    marginBottom: 20,
                  }}>
                    {resolvedContentPreview()}
                  </div>

                  {/* Signature row */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-end',
                    marginTop: `${previewState.spacingBeforeSignature || 60}px`,
                  }}>
                    <div>
                      <Text style={{ fontSize: 10, color: '#64748b' }}>Date: 27 May 2026</Text>
                    </div>
                    <div style={{ textAlign: 'center', minWidth: 130 }}>
                      {previewState.signatureUrl ? (
                        <img src={previewState.signatureUrl} alt="Signature" style={{ maxHeight: 40, maxWidth: 110, objectFit: 'contain', display: 'block', margin: '0 auto 4px' }} />
                      ) : (
                        <div style={{ borderBottom: '1px solid #cbd5e1', width: 120, marginBottom: 4 }} />
                      )}
                      <Text strong style={{ fontSize: 10, display: 'block' }}>{previewState.principalName || '[Principal Name]'}</Text>
                      <Text type="secondary" style={{ fontSize: 9, display: 'block', color: '#64748b' }}>
                        {previewState.principalDesignation || 'Principal'}
                      </Text>
                    </div>
                  </div>

                  {/* Footer disclaimer */}
                  {previewState.footerText && (
                    <div style={{
                      marginTop: 24, paddingTop: 10,
                      borderTop: '1px solid #cbd5e1',
                      textAlign: previewState.footerAlign || 'center',
                      fontSize: 9,
                      color: '#94a3b8',
                      fontStyle: 'italic'
                    }}>
                      {previewState.footerText}
                    </div>
                  )}

                  {/* Computer generated watermark */}
                  <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0, textAlign: 'center', fontSize: 8, color: '#cbd5e1' }}>
                    Computer-generated certificate · VIKRAMASILA MODEL SCHOOL · 27 May 2026
                  </div>
                </div>
              </div>
            </div>
          </Col>
        </Row>
      </Form>
    </div>
  );
};

export default CertificateTemplateEditor;
