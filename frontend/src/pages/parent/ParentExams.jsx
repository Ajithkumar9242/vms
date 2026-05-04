import React, { useEffect, useState, useCallback } from 'react';
import ParentLayout from '@/components/mobile/ParentLayout';
import { examAPI, studentAPI } from '@/services/api';
import useAuthStore from '@/store/authStore';
import { downloadMarksheetPDF, exportResultsCSV, getGrade } from '@/utils/pdf';
import dayjs from 'dayjs';

const GRADE_COLOR = (pct) => {
  if (pct >= 90) return { bg: '#DCFCE7', color: '#16A34A', grade: 'A+' };
  if (pct >= 80) return { bg: '#D1FAE5', color: '#059669', grade: 'A'  };
  if (pct >= 70) return { bg: '#DBEAFE', color: '#2563EB', grade: 'B'  };
  if (pct >= 60) return { bg: '#EDE9FE', color: '#7C3AED', grade: 'C'  };
  if (pct >= 40) return { bg: '#FEF3C7', color: '#D97706', grade: 'D'  };
  return { bg: '#FEE2E2', color: '#DC2626', grade: 'F' };
};

const ParentExams = () => {
  const user = useAuthStore((s) => s.user);
  const [loading,    setLoading]   = useState(true);
  const [error,      setError]     = useState(null);
  const [studentId,  setStudentId] = useState(null);
  const [student,    setStudent]   = useState(null);
  const [results,    setResults]   = useState([]);
  const [selected,   setSelected]  = useState(null);
  const [exporting,  setExporting] = useState(false);

  useEffect(() => { resolveStudent(); }, []);

  const resolveStudent = useCallback(async () => {
    setLoading(true);
    setError(null);
    const linked = user?.linkedEntity?.linkedStudents?.[0];
    const sid = linked?._id || user?.studentId || user?.metadata?.studentId;
    if (sid) {
      setStudentId(sid);
      if (linked) setStudent(linked);
      await loadResults(sid);
    } else {
      try {
        const res = await studentAPI.getAll({ limit: 1 });
        const s   = res?.data?.students?.[0] || res?.data?.[0];
        if (s) { setStudentId(s._id); setStudent(s); await loadResults(s._id); }
        else   { setLoading(false); }
      } catch (e) { setError(e.message); setLoading(false); }
    }
  }, [user]);

  const loadResults = async (sid) => {
    setLoading(true);
    setError(null);
    try {
      const res  = await examAPI.getStudentResults(sid);
      const data = res?.data || res || {};

      // API returns { student, results } — normalize both shapes:
      //   new: { student: {...}, results: [{exam, subjects, ...}] }
      //   old: flat array of mark records
      const rawResults = Array.isArray(data)
        ? data
        : Array.isArray(data?.results)
        ? data.results
        : [];

      if (data?.student) setStudent((prev) => prev || data.student);

      // New shape: results already grouped by exam
      if (rawResults.length > 0 && rawResults[0]?.exam !== undefined) {
        // Shape: [{ exam: {examName}, subjects: [...], totalObtained, percentage, ... }]
        const mapped = rawResults.map((r, i) => ({
          examId:   r.exam?._id || i,
          examName: r.exam?.examName || r.exam?.name || 'Exam',
          examDate: r.exam?.startDate || r.exam?.examDate,
          subjects: (r.subjects || []).map((s) => ({
            _id:          s.subject?._id || s._id,
            subjectName:  s.subject?.name || 'Subject',
            marksObtained: s.marksObtained ?? 0,
            maxMarks:      s.maxMarks      ?? 100,
            passingMarks:  (r.exam?.passingMarks) ?? 35,
          })),
        }));
        setResults(mapped);
        return;
      }

      // Old shape: flat array of mark records grouped by examId
      const examMap = {};
      rawResults.forEach((r) => {
        const eid = r.examId?._id || r.examId;
        if (!examMap[eid]) {
          examMap[eid] = {
            examId:   eid,
            examName: r.examId?.name || 'Exam',
            examDate: r.examId?.examDate,
            subjects: [],
          };
        }
        examMap[eid].subjects.push({
          ...r,
          subjectName:   r.subjectId?.name || 'Subject',
          marksObtained: r.marksObtained ?? 0,
          maxMarks:      r.maxMarks       ?? 100,
          passingMarks:  r.passingMarks   ?? 40,
        });
      });
      setResults(Object.values(examMap));
    } catch (e) {
      setError(e.message || 'Failed to load results.');
    } finally {
      setLoading(false);
    }
  };

  const calcTotal = (subjects) => {
    const got = subjects.reduce((s, r) => s + (r.marksObtained || 0), 0);
    const max = subjects.reduce((s, r) => s + (r.maxMarks      || 100), 0);
    return { got, max, pct: max > 0 ? Math.round((got / max) * 100) : 0 };
  };

  const handlePDF = () => {
    setExporting(true);
    try {
      downloadMarksheetPDF({
        student:    student || { name: user?.name },
        classInfo:  student?.classId || {},
        exams:      results,
        schoolName: 'VMS School',
      });
    } catch (e) {
      console.error('PDF error:', e);
    } finally {
      setExporting(false);
    }
  };

  const handleCSV = () => {
    exportResultsCSV(results, student || { name: user?.name });
  };

  return (
    <ParentLayout title="Exam Results" subtitle="Subject-wise grades">

      {/* Export Bar */}
      {results.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <button
            className="m-btn m-btn-primary"
            style={{ flex: 1 }}
            onClick={handlePDF}
            disabled={exporting}
          >
            {exporting ? '⏳...' : '📄 Download Marksheet'}
          </button>
          <button
            className="m-btn m-btn-outline"
            style={{ flex: 1 }}
            onClick={handleCSV}
          >
            📊 Export CSV
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="m-card" style={{ borderLeft: '3px solid #EF4444', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: '#DC2626', marginBottom: 8 }}>{error}</div>
          <button className="m-btn m-btn-outline" onClick={resolveStudent}>Retry</button>
        </div>
      )}

      {loading ? (
        <div className="m-spinner" />
      ) : results.length === 0 ? (
        <div className="m-empty">
          <div className="m-empty-icon">📝</div>
          <div className="m-empty-text">No exam results available yet</div>
        </div>
      ) : (
        results.map((exam, i) => {
          const { got, max, pct } = calcTotal(exam.subjects);
          const gc    = GRADE_COLOR(pct);
          const isOpen = selected === i;
          return (
            <div key={exam.examId || i} className="m-card" style={{ marginBottom: 10 }}>
              {/* Exam Header — tap to expand */}
              <button
                onClick={() => setSelected(isOpen ? null : i)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                <div style={{ textAlign: 'left' }}>
                  <div className="m-card-title">{exam.examName}</div>
                  <div className="m-card-sub">
                    {exam.examDate ? dayjs(exam.examDate).format('DD MMM YYYY') : `${exam.subjects.length} subjects`}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: gc.color }}>{pct}%</div>
                    <span className="m-badge" style={{ background: gc.bg, color: gc.color }}>{gc.grade}</span>
                  </div>
                  <span style={{ color: '#94A3B8', fontSize: 18 }}>{isOpen ? '▲' : '▼'}</span>
                </div>
              </button>

              {/* Progress */}
              <div className="m-progress-bar" style={{ marginTop: 10 }}>
                <div className="m-progress-fill" style={{ width: `${pct}%`, background: gc.color }} />
              </div>
              <div style={{ fontSize: 11, color: '#64748B', textAlign: 'right', marginTop: 3 }}>
                {got} / {max} marks
              </div>

              {/* Subject Breakdown */}
              {isOpen && (
                <div style={{ marginTop: 12, borderTop: '1px solid #F1F5F9', paddingTop: 12 }}>
                  {exam.subjects.map((s, j) => {
                    const subPct = s.maxMarks > 0 ? Math.round((s.marksObtained / s.maxMarks) * 100) : 0;
                    const sc = GRADE_COLOR(subPct);
                    const passed = s.marksObtained >= s.passingMarks;
                    return (
                      <div key={s._id || j} className="m-subject-row">
                        <div style={{ flex: 1 }}>
                          <div className="m-subject-name">{s.subjectName}</div>
                          <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>
                            Max: {s.maxMarks} · Pass: {s.passingMarks}
                          </div>
                          <div className="m-progress-bar" style={{ margin: '4px 0 0', height: 4 }}>
                            <div className="m-progress-fill" style={{ width: `${subPct}%`, background: sc.color, height: 4 }} />
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                          <div className="m-subject-score" style={{ color: sc.color }}>
                            {s.marksObtained}/{s.maxMarks}
                          </div>
                          <span className="m-badge" style={{ background: sc.bg, color: sc.color, fontSize: 10 }}>
                            {sc.grade}
                          </span>
                          <div style={{ fontSize: 10, marginTop: 2, color: passed ? '#16A34A' : '#DC2626', fontWeight: 600 }}>
                            {passed ? 'PASS' : 'FAIL'}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Total Row */}
                  <div style={{
                    marginTop: 12, padding: '10px 12px',
                    background: gc.bg, borderRadius: 10,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: gc.color }}>TOTAL</div>
                      <div style={{ fontSize: 11, color: gc.color, opacity: 0.8 }}>{exam.subjects.length} subjects</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: gc.color }}>{got}/{max}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: gc.color }}>{pct}% · Grade {gc.grade}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </ParentLayout>
  );
};

export default ParentExams;
