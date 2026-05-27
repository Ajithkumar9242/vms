import { useState, useEffect } from 'react';
import {
  Form, Select, Button, Typography, Space, Card, Row, Col,
  App, Divider, Tag, Descriptions, Spin, Empty, Alert,
} from 'antd';
import {
  PrinterOutlined, DownloadOutlined, SearchOutlined,
  ArrowLeftOutlined, UserOutlined, FileTextOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { certificateAPI, studentAPI } from '@/services/api';
import { ERP_COLORS } from '@/theme/colors';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const PrintCertificate = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { message } = App.useApp();
  const [form] = Form.useForm();

  const [templates, setTemplates] = useState([]);
  const [students, setStudents]   = useState([]);
  const [previewData, setPreviewData] = useState(null);

  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [loadingStudents,  setLoadingStudents]  = useState(false);
  const [previewing,       setPreviewing]       = useState(false);
  const [studentSearch,    setStudentSearch]    = useState('');

  const selectedTemplateId = Form.useWatch('templateId', form);
  const selectedStudentId  = Form.useWatch('studentId',  form);

  // Load templates on mount
  useEffect(() => {
    setLoadingTemplates(true);
    certificateAPI.getTemplates()
      .then((res) => {
        const data = res.data || res;
        setTemplates(Array.isArray(data.templates) ? data.templates : []);
      })
      .catch((e) => message.error(e.message || 'Failed to load templates'))
      .finally(() => setLoadingTemplates(false));
  }, []);

  // Pre-select template from navigation state
  useEffect(() => {
    if (location.state?.templateId) {
      form.setFieldValue('templateId', location.state.templateId);
    }
  }, [location.state]);

  // Load students on search
  const handleStudentSearch = async (value) => {
    setStudentSearch(value);
    if (!value || value.length < 2) return;
    setLoadingStudents(true);
    try {
      const res = await studentAPI.getAll({ search: value, limit: 30 });
      const data = res.data || res;
      const list = Array.isArray(data.students) ? data.students
                 : Array.isArray(data.data)     ? data.data
                 : Array.isArray(data)           ? data
                 : [];
      setStudents(list);
    } catch (e) {
      message.error(e.message || 'Search failed');
    } finally {
      setLoadingStudents(false);
    }
  };

  // Load preview when both templateId and studentId are selected
  useEffect(() => {
    if (!selectedTemplateId || !selectedStudentId) {
      setPreviewData(null);
      return;
    }
    setPreviewing(true);
    certificateAPI.preview(selectedTemplateId, selectedStudentId)
      .then((res) => {
        const data = res.data || res;
        setPreviewData(data);
      })
      .catch((e) => {
        message.error(e.message || 'Preview failed');
        setPreviewData(null);
      })
      .finally(() => setPreviewing(false));
  }, [selectedTemplateId, selectedStudentId]);

  const handleDownload = () => {
    if (!selectedTemplateId || !selectedStudentId) {
      message.warning('Please select a template and a student first');
      return;
    }
    const url = certificateAPI.getPdfUrl(selectedTemplateId, selectedStudentId);
    window.open(url, '_blank');
  };

  const handlePrint = () => {
    if (!selectedTemplateId || !selectedStudentId) {
      message.warning('Please select a template and a student first');
      return;
    }
    const url = certificateAPI.getPdfUrl(selectedTemplateId, selectedStudentId);
    const win = window.open(url, '_blank');
    if (win) {
      win.onload = () => { win.print(); };
    }
  };

  const selectedTemplate = templates.find((t) => t._id === selectedTemplateId);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/certificates/templates')} />
        <div>
          <Title level={4} style={{ margin: 0 }}>Print Certificate</Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Select a template and student, preview, then download or print
          </Text>
        </div>
      </div>

      <Row gutter={24}>
        {/* ── Selection Panel ──────────────────────────────── */}
        <Col xs={24} lg={8}>
          <Card title="🎓 Certificate Setup" size="small" style={{ marginBottom: 16 }}>
            <Form form={form} layout="vertical">
              {/* Template selection */}
              <Form.Item
                name="templateId"
                label="Certificate Template"
                rules={[{ required: true, message: 'Please select a template' }]}
              >
                <Select
                  showSearch
                  placeholder="Select certificate template"
                  loading={loadingTemplates}
                  optionFilterProp="label"
                  options={templates.map((t) => ({
                    value: t._id,
                    label: t.name,
                  }))}
                />
              </Form.Item>

              {selectedTemplate && (
                <div style={{ marginBottom: 16, padding: '8px 12px', background: '#f8f9fa', borderRadius: 6 }}>
                  <Space wrap>
                    <Tag color="blue">{selectedTemplate.type}</Tag>
                    <Text style={{ fontSize: 12 }}>{selectedTemplate.title || selectedTemplate.name}</Text>
                  </Space>
                </div>
              )}

              <Divider style={{ margin: '12px 0' }} />

              {/* Student selection */}
              <Form.Item
                name="studentId"
                label="Student"
                rules={[{ required: true, message: 'Please select a student' }]}
              >
                <Select
                  showSearch
                  placeholder="Search by name or admission no..."
                  loading={loadingStudents}
                  onSearch={handleStudentSearch}
                  filterOption={false}
                  notFoundContent={
                    studentSearch.length < 2
                      ? <Text type="secondary" style={{ fontSize: 12 }}>Type at least 2 characters to search</Text>
                      : loadingStudents
                      ? <Spin size="small" />
                      : <Empty description="No students found" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  }
                >
                  {students.map((s) => (
                    <Select.Option key={s._id} value={s._id}>
                      <Space size={4}>
                        <UserOutlined style={{ color: ERP_COLORS.primary }} />
                        <strong>{s.name}</strong>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {s.classId?.name || ''}
                          {s.admissionNo ? ` · ${s.admissionNo}` : ''}
                        </Text>
                      </Space>
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              {/* Actions */}
              <Space direction="vertical" style={{ width: '100%' }}>
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  block
                  size="large"
                  disabled={!selectedTemplateId || !selectedStudentId}
                  onClick={handleDownload}
                  style={{ background: ERP_COLORS.primary, borderColor: ERP_COLORS.primary }}
                >
                  Download PDF
                </Button>
                <Button
                  icon={<PrinterOutlined />}
                  block
                  disabled={!selectedTemplateId || !selectedStudentId}
                  onClick={handlePrint}
                >
                  Print
                </Button>
              </Space>
            </Form>
          </Card>
        </Col>

        {/* ── Preview Panel ─────────────────────────────────── */}
        <Col xs={24} lg={16}>
          <Card title="📄 Certificate Preview" size="small">
            {previewing && (
              <div style={{ textAlign: 'center', padding: 60 }}>
                <Spin size="large" tip="Generating preview..." />
              </div>
            )}

            {!previewing && !previewData && (
              <Empty
                description="Select a template and a student to see the preview"
                style={{ padding: 60 }}
              />
            )}

            {!previewing && previewData && (
              <CertificatePreviewPane data={previewData} />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

// ── In-page certificate preview component ─────────────────────────────────
const CertificatePreviewPane = ({ data }) => {
  const { template, student, variables } = data;

  const fmtDob = (d) => d ? dayjs(d).format('DD MMMM YYYY') : '—';
  const primaryColor = template.textColor || '#c2410c';

  // Map font families to standard CSS stacks
  const fontStacks = {
    'Times New Roman': '"Times New Roman", Times, Georgia, serif',
    'Georgia': 'Georgia, serif',
    'Arial': 'Arial, Helvetica, sans-serif',
    'Roboto': '"Roboto", "Helvetica Neue", Arial, sans-serif',
    'Helvetica': 'Helvetica, Arial, sans-serif',
  };

  const selectedFont = fontStacks[template.fontFamily] || fontStacks['Times New Roman'];

  return (
    <div>
      {/* Student info strip */}
      <Alert
        message={
          <Space wrap>
            <Text strong>{student.name}</Text>
            <Tag color="blue">{student.classId?.name}</Tag>
            {student.sectionId?.name && <Tag>{student.sectionId.name}</Tag>}
            {student.admissionNo && <Text type="secondary">Adm: {student.admissionNo}</Text>}
          </Space>
        }
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      {/* Certificate document preview */}
      <div
        style={{
          border: `2px solid ${primaryColor}`,
          borderRadius: 4,
          padding: '4px',
          background: '#fff',
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          position: 'relative',
        }}
      >
        <div
          style={{
            border: `1px solid ${primaryColor}`,
            padding: '36px 48px',
            minHeight: '680px',
            fontFamily: selectedFont,
            fontSize: `${template.fontSize || 12}px`,
            position: 'relative',
            color: '#0f172a',
          }}
        >
          {/* Custom Letterhead or School Letterhead */}
          {template.letterheadUrl ? (
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <img
                src={template.letterheadUrl}
                alt="Custom Letterhead"
                style={{ width: '100%', maxHeight: 90, objectFit: 'contain' }}
              />
            </div>
          ) : template.useSchoolLetterhead !== false ? (
            <div style={{
              textAlign: 'center', marginBottom: 24, paddingBottom: 16,
              borderBottom: '2px solid #e2e8f0',
            }}>
              {(template.logoUrl || template.customLogoUrl) && (
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                  <img
                    src={template.logoUrl || template.customLogoUrl}
                    alt="School Logo"
                    style={{ height: 50, objectFit: 'contain' }}
                  />
                </div>
              )}
              <Text style={{ fontSize: 18, fontWeight: 700, color: primaryColor, display: 'block' }}>
                {variables.schoolName}
              </Text>
              {variables.schoolAddress && (
                <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                  {variables.schoolAddress}
                </Text>
              )}
              {variables.schoolPhone && (
                <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                  📞 {variables.schoolPhone} {variables.schoolEmail ? ` | ✉ ${variables.schoolEmail}` : ''}
                </Text>
              )}
            </div>
          ) : (
            <div style={{ height: 20 }} />
          )}

          {/* Certificate title */}
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <Text style={{
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: 2,
              color: primaryColor,
              textTransform: 'uppercase',
              display: 'block',
            }}>
              {template.title || template.name}
            </Text>
            <div style={{
              height: 2,
              width: 180,
              background: primaryColor,
              margin: '6px auto 2px',
              borderRadius: 2,
            }} />
            <div style={{
              height: 0.8,
              width: 120,
              background: primaryColor,
              margin: '0 auto',
            }} />
          </div>

          {/* Header text */}
          {template.headerText && (
            <div style={{
              textAlign: 'center',
              marginBottom: 20,
              color: '#64748b',
              fontSize: 11,
              fontStyle: 'italic',
            }}>
              {template.headerText}
            </div>
          )}

          {/* Certificate body */}
          <div style={{
            lineHeight: template.lineHeight || 1.8,
            textAlign: template.textAlign || 'justify',
            fontWeight: template.bold ? 'bold' : 'normal',
            fontStyle: template.italic ? 'italic' : 'normal',
            textDecoration: template.underline ? 'underline' : 'none',
            color: template.textColor || '#0f172a',
            whiteSpace: 'pre-wrap',
            marginBottom: 20,
          }}>
            {template.content}
          </div>

          {/* Signature + date row with custom spacing before signature */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginTop: `${template.spacingBeforeSignature || 60}px`,
          }}>
            <div>
              <Text style={{ fontSize: 11, color: '#64748b' }}>Date: {variables.date}</Text>
            </div>
            <div style={{ textAlign: 'center', minWidth: 140 }}>
              {template.signatureUrl ? (
                <img
                  src={template.signatureUrl}
                  alt="Signature"
                  style={{ maxHeight: 45, maxWidth: 120, objectFit: 'contain', display: 'block', margin: '0 auto 4px' }}
                />
              ) : (
                <div style={{ borderBottom: '1px solid #cbd5e1', width: 130, marginBottom: 4 }} />
              )}
              <Text strong style={{ fontSize: 11, display: 'block' }}>{variables.principalName || '—'}</Text>
              <Text type="secondary" style={{ fontSize: 10, display: 'block', color: '#64748b' }}>
                {variables.principalDesignation || 'Principal'}
              </Text>
            </div>
          </div>

          {/* Footer */}
          {template.footerText && (
            <div style={{
              marginTop: 32, paddingTop: 12,
              borderTop: '1px solid #e2e8f0',
              textAlign: template.footerAlign || 'center',
              fontSize: 10,
              color: '#94a3b8',
              fontStyle: 'italic',
            }}>
              {template.footerText}
            </div>
          )}

          {/* Bottom watermark */}
          <div style={{
            position: 'absolute', bottom: 12, left: 0, right: 0,
            textAlign: 'center', fontSize: 8.5, color: '#cbd5e1',
          }}>
            Computer-generated certificate · {variables.schoolName} · {variables.date}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintCertificate;
