import React, { useEffect, useState } from 'react';
import { Card, Form, Select, Button, Tag, message, Typography, Alert } from 'antd';
import { PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { setupAPI } from '@/services/api';

const { Title, Text } = Typography;

const SESSION_PRESETS = [
  { label: 'Full Day (Morning + Afternoon)', value: ['Morning', 'Afternoon'] },
  { label: 'Period-wise (P1–P6)', value: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'] },
  { label: 'Single Session (Morning only)', value: ['Morning'] },
];

const AttendanceConfig = () => {
  const [years, setYears] = useState([]);
  const [sessions, setSessions] = useState(['Morning']);
  const [activeYearId, setActiveYearId] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newSession, setNewSession] = useState('');

  useEffect(() => {
    setupAPI.getAcademicYears().then((res) => {
      const ys = res?.data || [];
      setYears(ys);
      const active = ys.find((y) => y.isActive);
      if (active) { setActiveYearId(active._id); setSelectedYear(active._id); }
    });
  }, []);

  useEffect(() => {
    if (!selectedYear) return;
    setLoading(true);
    setupAPI.getAttendanceConfig({ academicYearId: selectedYear })
      .then((res) => { if (res?.data?.sessions) setSessions(res.data.sessions); })
      .finally(() => setLoading(false));
  }, [selectedYear]);

  const applyPreset = (preset) => setSessions(preset.value);

  const addSession = () => {
    if (!newSession.trim()) return;
    if (sessions.includes(newSession.trim())) { message.warning('Session already exists'); return; }
    setSessions([...sessions, newSession.trim()]);
    setNewSession('');
  };

  const removeSession = (s) => setSessions(sessions.filter((x) => x !== s));

  const save = async () => {
    if (!sessions.length) { message.warning('Add at least one session'); return; }
    setSaving(true);
    try {
      await setupAPI.saveAttendanceConfig({ academicYearId: selectedYear || activeYearId, sessions });
      message.success('Attendance config saved');
    } catch (e) { message.error(e.message); } finally { setSaving(false); }
  };

  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ marginBottom: 16 }}>✅ Attendance Configuration</Title>
      <Card style={{ maxWidth: 640 }} loading={loading}>
        <Form layout="vertical">
          <Form.Item label="Academic Year">
            <Select value={selectedYear} onChange={setSelectedYear} style={{ width: '100%' }}>
              {years.map((y) => <Select.Option key={y._id} value={y._id}>{y.name}{y.isActive ? ' (Active)' : ''}</Select.Option>)}
            </Select>
          </Form.Item>

          <Form.Item label="Quick Presets">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {SESSION_PRESETS.map((p) => (
                <Button key={p.label} size="small" onClick={() => applyPreset(p)}>{p.label}</Button>
              ))}
            </div>
          </Form.Item>

          <Form.Item label="Sessions (drag to reorder)">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {sessions.map((s) => (
                <Tag key={s} closable onClose={() => removeSession(s)} color="blue" style={{ fontSize: 13, padding: '2px 10px' }}>
                  {s}
                </Tag>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Select
                showSearch freeSolo style={{ flex: 1 }}
                value={newSession}
                onChange={setNewSession}
                onSearch={setNewSession}
                placeholder="Add custom session name"
                filterOption={false}
                options={[]}
              />
              <Button icon={<PlusOutlined />} onClick={addSession}>Add</Button>
            </div>
          </Form.Item>

          {sessions.length === 0 && (
            <Alert type="warning" message="Add at least one session before saving." style={{ marginBottom: 16 }} />
          )}

          <Button type="primary" onClick={save} loading={saving}>Save Config</Button>
        </Form>
      </Card>
    </div>
  );
};

export default AttendanceConfig;
