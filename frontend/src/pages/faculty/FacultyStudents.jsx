import React, { useEffect, useState } from 'react';
import FacultyLayout from '@/components/mobile/FacultyLayout';
import { studentAPI, schoolAPI } from '@/services/api';

const FacultyStudents = () => {
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null);

  useEffect(() => { loadClasses(); }, []);
  useEffect(() => { if (selectedClass) loadStudents(selectedClass); }, [selectedClass]);

  const loadClasses = async () => {
    try {
      const res = await schoolAPI.getClasses();
      const list = res?.data || [];
      setClasses(list);
      if (list.length > 0) setSelectedClass(list[0]._id);
    } catch {}
  };

  const loadStudents = async (classId) => {
    setLoading(true);
    try {
      const res = await studentAPI.getAll({ classId, isActive: true, limit: 200 });
      setStudents(res?.data?.students || res?.data || []);
    } catch {} finally { setLoading(false); }
  };

  const filtered = students.filter((s) =>
    !search || s.name?.toLowerCase().includes(search.toLowerCase()) || String(s.rollNo).includes(search)
  );

  return (
    <FacultyLayout title="Students" subtitle={`${filtered.length} students`}>
      {/* Class Selector */}
      <div className="m-form-group">
        <label className="m-label">Class</label>
        <select className="m-select" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
          {classes.map((c) => (
            <option key={c._id} value={c._id}>{c.name}{c.code ? ` · ${c.code}` : ''}</option>
          ))}
        </select>
      </div>

      {/* Search */}
      <div className="m-form-group">
        <input
          className="m-input"
          placeholder="🔍 Search by name or roll no..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? <div className="m-spinner" /> : filtered.length === 0 ? (
        <div className="m-empty">
          <div className="m-empty-icon">👨‍🎓</div>
          <div className="m-empty-text">No students found</div>
        </div>
      ) : (
        <div className="m-card" style={{ padding: '0 14px' }}>
          {filtered.map((s) => {
            const isOpen = expanded === s._id;
            return (
              <div key={s._id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                <button
                  onClick={() => setExpanded(isOpen ? null : s._id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                >
                  <div className="m-avatar-sm">{(s.name || 'S')[0].toUpperCase()}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: '#64748B' }}>Roll: {s.rollNo || '—'}</div>
                  </div>
                  <span style={{ color: '#94A3B8' }}>{isOpen ? '▲' : '▼'}</span>
                </button>

                {isOpen && (
                  <div style={{ paddingBottom: 12, paddingLeft: 52 }}>
                    {[
                      { label: 'Gender', value: s.gender },
                      { label: 'DOB', value: s.dob ? new Date(s.dob).toLocaleDateString('en-IN') : '—' },
                      { label: 'Phone', value: s.parentPhone || '—' },
                      { label: 'Blood Group', value: s.bloodGroup || '—' },
                      { label: 'Address', value: s.address || '—' },
                    ].map((f) => (
                      <div key={f.label} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: '#94A3B8', minWidth: 80 }}>{f.label}:</span>
                        <span style={{ fontSize: 12, color: '#0F172A', fontWeight: 500 }}>{f.value || '—'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </FacultyLayout>
  );
};

export default FacultyStudents;
