import React, { useState } from 'react';
import { Upload, Button, Image, Typography, Space, Spin, message as antMessage, List } from 'antd';
import {
  UploadOutlined, DeleteOutlined, FileTextOutlined,
  FilePdfOutlined, FileImageOutlined, LinkOutlined, LoadingOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

/**
 * Reusable FileUpload component.
 *
 * Props:
 *   folder      - string  — Cloudinary folder key: 'students'|'faculty'|'parents'|'materials'|'logo'
 *   multiple    - boolean — false = single file, true = multi-file
 *   accept      - string  — e.g. 'image/*' | '.pdf,.doc,.docx,image/*'
 *   value       - string (single) | Array (multiple) — controlled value
 *   onChange    - fn(url | files[]) called after upload
 *   onUploading - fn(bool) — called while uploading (use to disable submit)
 *   label       - string  — optional button label override
 */
const FileUpload = ({
  folder = 'vms-erp',
  multiple = false,
  accept = 'image/*,.pdf,.doc,.docx',
  value,
  onChange,
  onUploading,
  label,
}) => {
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState(Array.isArray(value) ? value : []);

  const setLoading = (v) => {
    setUploading(v);
    onUploading?.(v);
  };

  // ─── Single upload handler ────────────────────────────────
  const handleSingleUpload = async ({ file }) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('vms_token');
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/upload?folder=${folder}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Upload failed');

      const url = json.data?.url || json.url;
      onChange?.(url);
      antMessage.success('File uploaded successfully');
    } catch (e) {
      antMessage.error(e.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  // ─── Multiple upload handler ──────────────────────────────
  const handleMultiUpload = async ({ file }) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('vms_token');
      const formData = new FormData();
      formData.append('files', file);

      const res = await fetch(`/api/upload/multiple?folder=${folder}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Upload failed');

      const uploaded = Array.isArray(json.data) ? json.data : [];
      const newFiles = [...files, ...uploaded];
      setFiles(newFiles);
      onChange?.(newFiles);
      antMessage.success(`${uploaded.length} file(s) uploaded`);
    } catch (e) {
      antMessage.error(e.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const removeFile = (idx) => {
    const updated = files.filter((_, i) => i !== idx);
    setFiles(updated);
    onChange?.(updated);
  };

  const isImage = (url) => /\.(jpe?g|png|gif|webp|svg)(\?|$)/i.test(url);

  // ─── Single file mode ──────────────────────────────────────
  if (!multiple) {
    const url = typeof value === 'string' ? value : null;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {url && isImage(url) && (
          <Image
            src={url}
            alt="preview"
            width={80}
            height={80}
            style={{ borderRadius: 8, objectFit: 'cover', border: '2px solid #E2E8F0' }}
            preview={{ src: url }}
          />
        )}
        {url && !isImage(url) && (
          <Space>
            <FilePdfOutlined style={{ color: '#DC2626', fontSize: 20 }} />
            <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
              View file
            </a>
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => onChange?.(null)}
            />
          </Space>
        )}
        <Upload
          showUploadList={false}
          accept={accept}
          customRequest={handleSingleUpload}
          disabled={uploading}
        >
          <Button
            icon={uploading ? <LoadingOutlined /> : <UploadOutlined />}
            loading={uploading}
            size="small"
          >
            {label || (url ? 'Change Photo' : 'Upload')}
          </Button>
        </Upload>
        <Text type="secondary" style={{ fontSize: 11 }}>
          Max 5MB · Images, PDF, DOC
        </Text>
      </div>
    );
  }

  // ─── Multiple file mode ───────────────────────────────────
  const fileList = Array.isArray(value) ? value : files;

  return (
    <div>
      <Upload
        showUploadList={false}
        accept={accept}
        customRequest={handleMultiUpload}
        multiple
        disabled={uploading}
      >
        <Button
          icon={uploading ? <LoadingOutlined /> : <UploadOutlined />}
          loading={uploading}
          size="small"
          style={{ marginBottom: 8 }}
        >
          {label || 'Add Files'}
        </Button>
      </Upload>

      {fileList.length > 0 && (
        <List
          size="small"
          dataSource={fileList}
          renderItem={(f, idx) => (
            <List.Item
              style={{
                padding: '6px 8px',
                background: '#F8FAFC',
                borderRadius: 6,
                marginBottom: 4,
                border: '1px solid #E2E8F0',
              }}
              actions={[
                <Button
                  key="rm"
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => removeFile(idx)}
                />,
              ]}
            >
              <Space>
                {isImage(f.url) ? (
                  <FileImageOutlined style={{ color: '#059669', fontSize: 16 }} />
                ) : /\.pdf/i.test(f.name || f.url) ? (
                  <FilePdfOutlined style={{ color: '#DC2626', fontSize: 16 }} />
                ) : (
                  <FileTextOutlined style={{ color: 'var(--color-primary)', fontSize: 16 }} />
                )}
                <a
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}
                >
                  {f.name || 'File'}
                </a>
                {f.size && (
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {(f.size / 1024).toFixed(0)} KB
                  </Text>
                )}
              </Space>
            </List.Item>
          )}
        />
      )}
      <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
        Max 5MB per file · Images, PDF, DOC, DOCX
      </Text>
    </div>
  );
};

export default FileUpload;
