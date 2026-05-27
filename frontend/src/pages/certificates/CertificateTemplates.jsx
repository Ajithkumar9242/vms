import { useState, useEffect } from 'react';
import {
  Table, Button, Space, Tag, Popconfirm, Typography,
  App, Empty, Tooltip, Badge,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined,
  FileTextOutlined, PrinterOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { certificateAPI } from '@/services/api';
import useAuthStore from '@/store/authStore';
import { ERP_COLORS } from '@/theme/colors';

const { Title, Text } = Typography;

const TYPE_COLORS = {
  study:         'blue',
  transfer:      'orange',
  bonafide:      'green',
  character:     'purple',
  conduct:       'cyan',
  participation: 'gold',
  merit:         'red',
  custom:        'default',
};

const WRITE_ROLES = ['super_admin', 'admin', 'principal'];

const CertificateTemplates = () => {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const user = useAuthStore((s) => s.user);
  const canWrite = WRITE_ROLES.includes(user?.role);

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await certificateAPI.getTemplates();
      const data = res.data || res;
      setTemplates(Array.isArray(data.templates) ? data.templates : []);
    } catch (e) {
      message.error(e.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTemplates(); }, []);

  const handleDelete = async (id) => {
    try {
      await certificateAPI.deleteTemplate(id);
      message.success('Template deleted');
      fetchTemplates();
    } catch (e) {
      message.error(e.message || 'Delete failed');
    }
  };

  const columns = [
    {
      title: 'Template Name',
      dataIndex: 'name',
      key: 'name',
      render: (name, row) => (
        <Space>
          <FileTextOutlined style={{ color: ERP_COLORS.primary }} />
          <Text strong>{name}</Text>
          {row.title && <Text type="secondary" style={{ fontSize: 12 }}>— {row.title}</Text>}
        </Space>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 140,
      render: (t) => (
        <Tag color={TYPE_COLORS[t] || 'default'} style={{ textTransform: 'capitalize' }}>
          {(t || 'custom').replace(/_/g, ' ')}
        </Tag>
      ),
    },
    {
      title: 'Letterhead',
      dataIndex: 'useSchoolLetterhead',
      key: 'useSchoolLetterhead',
      width: 110,
      render: (v) => <Badge status={v !== false ? 'success' : 'default'} text={v !== false ? 'Yes' : 'No'} />,
    },
    {
      title: 'Created By',
      dataIndex: ['createdBy', 'name'],
      key: 'createdBy',
      width: 140,
      render: (name) => name || '—',
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 180,
      render: (_, row) => (
        <Space>
          <Tooltip title="Print Certificate">
            <Button
              type="primary"
              size="small"
              icon={<PrinterOutlined />}
              onClick={() => navigate('/certificates/print', { state: { templateId: row._id } })}
            />
          </Tooltip>
          {canWrite && (
            <>
              <Tooltip title="Edit Template">
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => navigate(`/certificates/templates/${row._id}/edit`)}
                />
              </Tooltip>
              <Popconfirm
                title="Delete this template?"
                description="This action cannot be undone."
                onConfirm={() => handleDelete(row._id)}
                okText="Delete"
                okButtonProps={{ danger: true }}
              >
                <Tooltip title="Delete">
                  <Button danger size="small" icon={<DeleteOutlined />} />
                </Tooltip>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: ERP_COLORS.text }}>
            Certificate Templates
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Create and manage reusable certificate templates
          </Text>
        </div>
        <Space>
          <Button
            type="default"
            icon={<PrinterOutlined />}
            onClick={() => navigate('/certificates/print')}
          >
            Print Certificate
          </Button>
          {canWrite && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/certificates/templates/new')}
              style={{ background: ERP_COLORS.primary, borderColor: ERP_COLORS.primary }}
            >
              New Template
            </Button>
          )}
        </Space>
      </div>

      {/* Table */}
      <Table
        dataSource={templates}
        columns={columns}
        rowKey="_id"
        loading={loading}
        pagination={{ pageSize: 15, showTotal: (t) => `${t} templates` }}
        locale={{ emptyText: <Empty description="No certificate templates yet. Create one to get started." /> }}
        scroll={{ x: 700 }}
        size="middle"
      />
    </div>
  );
};

export default CertificateTemplates;
