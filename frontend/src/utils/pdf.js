/**
 * VMS ERP — PDF Generation Utilities
 * Uses jsPDF + jspdf-autotable for fee receipts.
 * All generation is client-side — no backend PDF dependency.
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import dayjs from 'dayjs';

// ─── Colour palette (matches mobile CSS) ────────────────────
const NAVY   = [27, 58, 92];   // var(--color-primary-dark)
const ACCENT = [37, 99, 235];  // var(--color-primary)
const GREEN  = [22, 163, 74];  // #16A34A
const RED    = [220, 38, 38];  // #DC2626
const GREY   = [100, 116, 139]; // #64748B
const LGREY  = [241, 245, 249]; // #F1F5F9
const WHITE  = [255, 255, 255];

/**
 * Shared helpers
 */
const addSchoolHeader = (doc, schoolName = 'VMS School') => {
  const W = doc.internal.pageSize.getWidth();

  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.rect(0, 0, W, 28, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.text(schoolName, 14, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(200, 210, 230);
  doc.text('Excellence in Education', 14, 18);

  doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  doc.rect(0, 28, W, 2, 'F');
};

const addPageNumber = (doc) => {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(GREY[0], GREY[1], GREY[2]);
    doc.text(`Page ${i} of ${total}`, W - 14, H - 8, { align: 'right' });
    doc.text(`Generated: ${dayjs().format('DD MMM YYYY, hh:mm A')}`, 14, H - 8);
  }
};

const labelValue = (doc, x, y, label, value, valueColor = null) => {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(GREY[0], GREY[1], GREY[2]);
  doc.text(label, x, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  if (valueColor) {
    doc.setTextColor(valueColor[0], valueColor[1], valueColor[2]);
  } else {
    doc.setTextColor(15, 23, 42);
  }
  doc.text(String(value ?? '—'), x, y + 5);
};


// ════════════════════════════════════════════════════════════
//  FEE RECEIPT PDF
// ════════════════════════════════════════════════════════════
/**
 * Generate and download a fee receipt PDF.
 *
 * @param {Object} opts
 * @param {Object} opts.student        — { name, rollNo }
 * @param {Object} opts.classInfo      — { name } (class name)
 * @param {Object} opts.summary        — { totalFee, totalPaid, totalDue, status }
 * @param {Object} opts.invoice        — { invoiceNumber, dueDate, feeItems }
 * @param {Array}  opts.payments       — array of payment records
 * @param {string} [opts.schoolName]   — school display name
 */
export const downloadFeeReceiptPDF = ({
  student,
  classInfo,
  summary,
  invoice,
  payments = [],
  schoolName = 'VMS School',
}) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();

  // ── Header ───────────────────────────────────────────────
  addSchoolHeader(doc, schoolName);

  // ── Title ────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text('FEE RECEIPT', W / 2, 40, { align: 'center' });

  // Receipt badge
  doc.setFillColor(LGREY[0], LGREY[1], LGREY[2]);
  doc.roundedRect(W - 60, 35, 46, 10, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text(`Invoice: ${invoice?.invoiceNumber || 'N/A'}`, W - 37, 41, { align: 'center' });

  // ── Student Info Row ──────────────────────────────────────
  doc.setFillColor(LGREY[0], LGREY[1], LGREY[2]);
  doc.rect(14, 48, W - 28, 26, 'F');

  labelValue(doc, 18, 55, 'STUDENT NAME', student?.name || '—');
  labelValue(doc, 18, 68, 'CLASS', classInfo?.name || '—');
  labelValue(doc, W / 2, 55, 'ROLL NO.', student?.rollNo || '—');
  labelValue(doc, W / 2, 68, 'DATE', dayjs().format('DD MMM YYYY'));

  // ── Fee Summary Boxes ─────────────────────────────────────
  const bx = 14, by = 80, bw = (W - 28) / 3 - 3, bh = 20;
  [
    { label: 'Total Fees',   value: `₹${(summary?.totalFee  || 0).toLocaleString('en-IN')}`, color: NAVY  },
    { label: 'Amount Paid',  value: `₹${(summary?.totalPaid || 0).toLocaleString('en-IN')}`, color: GREEN },
    { label: 'Balance Due',  value: `₹${(summary?.totalDue  || 0).toLocaleString('en-IN')}`, color: summary?.totalDue > 0 ? RED : GREEN },
  ].forEach((box, i) => {
    const x = bx + i * (bw + 3);
    doc.setFillColor(box.color[0], box.color[1], box.color[2]);
    doc.roundedRect(x, by, bw, bh, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
    doc.text(box.value, x + bw / 2, by + 8, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(box.label, x + bw / 2, by + 15, { align: 'center' });
  });

  // Status stamp
  const stamp = summary?.status === 'Paid' ? 'PAID' : '';
  if (stamp) {
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: 0.3 }));
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(36);
    doc.setTextColor(22, 163, 74);
    doc.text(stamp, W / 2, by + 14, { align: 'center', angle: 15 });
    doc.restoreGraphicsState();
    doc.setTextColor(15, 23, 42); // reset
  }

  // ── Payment History Table ─────────────────────────────────
  const tableStartY = by + bh + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text('Payment History', 14, tableStartY);

  const rows = payments.map((p, i) => [
    i + 1,
    dayjs(p.paidAt).format('DD MMM YYYY'),
    p.paymentMode?.toUpperCase() || '—',
    p.transactionId?.slice(0, 18) || p.receiptNumber || '—',
    `₹${(p.amount || 0).toLocaleString('en-IN')}`,
    p.status?.toUpperCase() || '—',
  ]);

  autoTable(doc, {
    startY: tableStartY + 4,
    head: [['#', 'Date', 'Mode', 'Transaction / Receipt', 'Amount', 'Status']],
    body: rows.length ? rows : [['\u2014', '\u2014', '\u2014', 'No payments recorded', '\u2014', '\u2014']],
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 8 },
      4: { halign: 'right', fontStyle: 'bold' },
      5: { halign: 'center' },
    },
    margin: { left: 14, right: 14 },
  });

  // ── Footer note ───────────────────────────────────────────
  const finalY = (doc.lastAutoTable?.finalY || 150) + 10;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(GREY[0], GREY[1], GREY[2]);
  doc.text('This is a computer-generated receipt. No signature required.', W / 2, finalY, { align: 'center' });

  if (invoice?.dueDate) {
    doc.text(`Fee due date: ${dayjs(invoice.dueDate).format('DD MMM YYYY')}`, W / 2, finalY + 5, { align: 'center' });
  }

  addPageNumber(doc);

  const filename = `FeeReceipt_${student?.name?.replace(/\s+/g, '_') || 'Student'}_${dayjs().format('DDMMMYYYY')}.pdf`;
  doc.save(filename);
};

// ════════════════════════════════════════════════════════════
//  CSV EXPORT
// ════════════════════════════════════════════════════════════

/**
 * Download a CSV file from a 2D array.
 * @param {string}   filename
 * @param {string[]} headers
 * @param {Array[]}  rows
 */
export const downloadCSV = (filename, headers, rows) => {
  const escape = (v) => {
    const str = String(v ?? '');
    return str.includes(',') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };
  const lines = [
    headers.map(escape).join(','),
    ...rows.map((r) => r.map(escape).join(',')),
  ];
  const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

/**
 * Export attendance records to CSV.
 * @param {Array}  records  — attendance records
 * @param {string} classLabel
 * @param {string} dateFrom
 * @param {string} dateTo
 */
export const exportAttendanceCSV = (records, classLabel = '', dateFrom = '', dateTo = '') => {
  const headers = ['Date', 'Student Name', 'Roll No', 'Session', 'Status'];
  const rows = records.map((r) => [
    dayjs(r.date).format('DD/MM/YYYY'),
    r.studentId?.name || r.studentName || '—',
    r.studentId?.rollNo || r.rollNo || '—',
    r.session || 'Full Day',
    r.status || '—',
  ]);
  const fname = `Attendance_${classLabel.replace(/\s+/g, '_')}_${dateFrom}_${dateTo}.csv`;
  downloadCSV(fname, headers, rows);
};

/**
 * Export exam results to CSV.
 * @param {Array}  exams    — grouped exam data
 * @param {Object} student  — { name }
 */
export const exportResultsCSV = (exams, student) => {
  const headers = ['Exam', 'Subject', 'Max Marks', 'Passing Marks', 'Marks Obtained', 'Percentage', 'Grade'];
  const rows = [];
  exams.forEach((exam) => {
    exam.subjects.forEach((s) => {
      const pct = s.maxMarks > 0 ? Math.round(((s.marksObtained ?? 0) / s.maxMarks) * 100) : 0;
      rows.push([
        exam.examName,
        s.subjectName || s.subjectId?.name || '—',
        s.maxMarks ?? '—',
        s.passingMarks ?? '—',
        s.marksObtained ?? '—',
        `${pct}%`,
        getGrade(pct),
      ]);
    });
  });
  const fname = `Results_${(student?.name || 'Student').replace(/\s+/g, '_')}_${dayjs().format('DDMMMYYYY')}.csv`;
  downloadCSV(fname, headers, rows);
};

// ─── Grade helper (exported) ─────────────────────────────────
export const getGrade = (pct) => {
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B';
  if (pct >= 60) return 'C';
  if (pct >= 40) return 'D';
  return 'F';
};
