import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Form, Select, Button, Tag, message, Typography, Alert,
  Input, TimePicker, Space, Table, InputNumber, Tooltip,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, DragOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import { setupAPI } from '@/services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

// ─── Preset definitions (mirrors backend) ────────────────────
const PRESETS = [
  {
    key: 'FULL_DAY',
    label: '☀️ Full Day',
    desc: 'Morning + Afternoon',
    sessions: [
      { name: 'Morning', startTime: '09:00', endTime: '12:30', order: 1 },
      { name: 'Afternoon', startTime: '13:30', endTime: '16:00', order: 2 },
    ],
  },
  {
    key: 'PERIOD',
    label: '📚 Period-wise',
    desc: 'P1–P6',
    sessions: [
      { name: 'P1', startTime: '09:00', endTime: '09:45', order: 1 },
      { name: 'P2', startTime: '09:45', endTime: '10:30', order: 2 },
      { name: 'P3', startTime: '10:45', endTime: '11:30', order: 3 },
      { name: 'P4', startTime: '11:30', endTime: '12:15', order: 4 },
      { name: 'P5', startTime: '13:15', endTime: '14:00', order: 5 },
      { name: 'P6', startTime: '14:00', endTime: '14:45', order: 6 },
    ],
  },
  {
    key: 'SINGLE',
    label: '🌤️ Single Session',
    desc: 'Morning only',
    sessions: [{ name: 'Morning', startTime: '09:00', endTime: '16:00', order: 1 }],
  },
];

const MODE_OPTIONS = [
  { value: 'session', label: 'Session Mode (Full-day sessions)' },
  { value: 'period', label: 'Period Mode  (Subject periods)' },
];

const AttendanceConfig = () => {
  const [years, setYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [mode, setMode] = useState('session');
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── New session form state ─────────────────────────────────
  const [newName, setNewName] = useState('');
  const [newStart, setNewStart] = useState(null);
  const [newEnd, setNewEnd] = useState(null);

  // ── Load academic years ────────────────────────────────────
  useEffect(() => {
    setupAPI.getAcademicYears().then((res) => {
      const ys = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      setYears(ys);
      const active = ys.find((y) => y.isActive);
      if (active) setSelectedYear(active._id);
    });
  }, []);

  // ── Load existing config when year changes ─────────────────
  const loadConfig = useCallback(async (yearId) => {
    if (!yearId) return;
    setLoading(true);
    try {
      const res = await setupAPI.getAttendanceConfig({ academicYearId: yearId });

      const cfg = res?.data?.data || res?.data || res;

      if (cfg && Array.isArray(cfg.sessions)) {
        setMode(cfg.mode || 'session');

        const raw = cfg.sessions;

        if (raw.length > 0 && typeof raw[0] === 'string') {
          setSessions(raw.map((s, i) => ({
            name: s,
            order: i + 1,
            startTime: null,
            endTime: null
          })));
        } else {
          setSessions([...raw].sort((a, b) => a.order - b.order));
        }
      } else {
        setSessions([]);
        setMode('session');
      }
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig(selectedYear);
  }, [selectedYear, loadConfig]);

  // ── Apply preset ───────────────────────────────────────────
  const applyPreset = (preset) => {
    setSessions([...preset.sessions]);
    if (preset.key === 'PERIOD') setMode('period');
    else setMode('session');
  };

  // ── Add session ────────────────────────────────────────────
  const addSession = () => {
    if (!newName.trim()) { message.warning('Session name is required'); return; }
    if (sessions.some((s) => s.name.toLowerCase() === newName.trim().toLowerCase())) {
      message.warning('Session name already exists');
      return;
    }
    if (sessions.length >= 10) { message.warning('Maximum 10 sessions'); return; }
    const maxOrder = sessions.reduce((max, s) => Math.max(max, s.order || 0), 0);
    setSessions([
      ...sessions,
      {
        name: newName.trim(),
        order: maxOrder + 1,
        startTime: newStart ? newStart.format('HH:mm') : null,
        endTime: newEnd ? newEnd.format('HH:mm') : null,
      },
    ]);
    setNewName('');
    setNewStart(null);
    setNewEnd(null);
  };

  // ── Remove session ─────────────────────────────────────────
  const removeSession = (order) => {
    setSessions(
      sessions
        .filter((s) => s.order !== order)
        .map((s, i) => ({ ...s, order: i + 1 }))  // re-number
    );
  };

  // ── Move session up/down ───────────────────────────────────
  const moveSession = (currentOrder, direction) => {
    const arr = [...sessions].sort((a, b) => a.order - b.order);
    const idx = arr.findIndex((s) => s.order === currentOrder);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= arr.length) return;
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    setSessions(arr.map((s, i) => ({ ...s, order: i + 1 })));
  };

  // ── Save ───────────────────────────────────────────────────
  const save = async () => {
    if (!sessions.length) { message.warning('Add at least one session'); return; }
    setSaving(true);
    try {
      await setupAPI.saveAttendanceConfig({
        academicYearId: selectedYear,
        mode,
        sessions,
      });
      message.success('Attendance config saved');
    } catch (e) {
      message.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  // ─── Table columns ─────────────────────────────────────────
  const cols = [
    {
      title: '#',
      dataIndex: 'order',
      width: 44,
      render: (v) => <Text type="secondary">{v}</Text>,
    },
    {
      title: 'Session Name',
      dataIndex: 'name',
      render: (v) => <Tag color="orange" style={{ fontSize: 13, padding: '2px 10px' }}>{v}</Tag>,
    },
    {
      title: 'Start',
      dataIndex: 'startTime',
      render: (v) => v || <Text type="secondary">—</Text>,
    },
    {
      title: 'End',
      dataIndex: 'endTime',
      render: (v) => v || <Text type="secondary">—</Text>,
    },
    {
      title: 'Reorder',
      width: 90,
      render: (_, r) => (
        <Space>
          <Button
            size="small"
            disabled={r.order === 1}
            onClick={() => moveSession(r.order, -1)}
          >↑</Button>
          <Button
            size="small"
            disabled={r.order === sessions.length}
            onClick={() => moveSession(r.order, 1)}
          >↓</Button>
        </Space>
      ),
    },
    {
      title: '',
      width: 44,
      render: (_, r) => (
        <Button
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => removeSession(r.order)}
        />
      ),
    },
  ];

  // Duplicate name check for UI warning
  const names = sessions.map((s) => s.name.toLowerCase().trim());
  const hasDuplicates = new Set(names).size !== names.length;

  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ marginBottom: 16 }}>✅ Attendance Configuration</Title>

      <Card style={{ maxWidth: 760 }} loading={loading}>
        {/* ── Year Selector ── */}
        <Form layout="vertical">
          <Form.Item label="Academic Year">
            <Select
              value={selectedYear}
              onChange={setSelectedYear}
              style={{ width: '100%' }}
              placeholder="Select year"
            >
              {years.map((y) => (
                <Select.Option key={y._id} value={y._id}>
                  {y.name}{y.isActive ? ' (Active)' : ''}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          {/* ── Mode ── */}
          <Form.Item label="Attendance Mode">
            <Select value={mode} onChange={setMode} style={{ width: '100%' }}>
              {MODE_OPTIONS.map((o) => (
                <Select.Option key={o.value} value={o.value}>{o.label}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          {/* ── Presets ── */}
          <Form.Item label="Quick Presets">
            <Space wrap>
              {PRESETS.map((p) => (
                <Button
                  key={p.key}
                  size="small"
                  icon={<ThunderboltOutlined />}
                  onClick={() => applyPreset(p)}
                >
                  {p.label}
                </Button>
              ))}
            </Space>
          </Form.Item>

          {/* ── Sessions Table ── */}
          <Form.Item label={`Sessions (${sessions.length}/10)`}>
            {hasDuplicates && (
              <Alert
                type="error"
                message="Duplicate session names detected — please fix before saving."
                style={{ marginBottom: 8 }}
              />
            )}

            <Table
              rowKey="order"
              columns={cols}
              dataSource={sessions}
              pagination={false}
              size="small"
              style={{ marginBottom: 12 }}
              locale={{ emptyText: 'No sessions — apply a preset or add manually' }}
            />

            {/* ── Add new session ── */}
            <Card
              size="small"
              style={{ background: '#f9f9ff', borderRadius: 8 }}
              title={<Text strong>Add Session</Text>}
            >
              <Space wrap align="end">
                <Form.Item label="Name" style={{ marginBottom: 0 }}>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. P7 or Lunch"
                    style={{ width: 140 }}
                    onPressEnter={addSession}
                  />
                </Form.Item>
                <Form.Item label="Start Time (optional)" style={{ marginBottom: 0 }}>
                  <TimePicker
                    value={newStart}
                    onChange={setNewStart}
                    format="HH:mm"
                    style={{ width: 110 }}
                  />
                </Form.Item>
                <Form.Item label="End Time (optional)" style={{ marginBottom: 0 }}>
                  <TimePicker
                    value={newEnd}
                    onChange={setNewEnd}
                    format="HH:mm"
                    style={{ width: 110 }}
                  />
                </Form.Item>
                <Form.Item label=" " style={{ marginBottom: 0 }}>
                  <Button
                    type="dashed"
                    icon={<PlusOutlined />}
                    onClick={addSession}
                    disabled={sessions.length >= 10}
                  >
                    Add
                  </Button>
                </Form.Item>
              </Space>
            </Card>
          </Form.Item>

          {sessions.length === 0 && (
            <Alert
              type="warning"
              message="Add at least one session before saving."
              style={{ marginBottom: 16 }}
            />
          )}

          <Button
            type="primary"
            onClick={save}
            loading={saving}
            disabled={hasDuplicates || sessions.length === 0}
          >
            Save Config
          </Button>
        </Form>
      </Card>
    </div>
  );
};

export default AttendanceConfig;
