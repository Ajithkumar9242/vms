const PDFDocument = require('pdfkit');

// Native date formatter (dayjs not installed on backend)
const fmt = (date, includeTime = false) => {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const day  = String(d.getDate()).padStart(2, '0');
  const mon  = months[d.getMonth()];
  const year = d.getFullYear();
  if (!includeTime) return `${day} ${mon} ${year}`;
  const hh = String(d.getHours() % 12 || 12).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ap = d.getHours() >= 12 ? 'PM' : 'AM';
  return `${day} ${mon} ${year}, ${hh}:${mm} ${ap}`;
};

// ─── Color Palette ───────────────────────────────────────────
const COLORS = {
  primary:   '#1B3A5C',
  accent:    '#2563EB',
  success:   '#16A34A',
  danger:    '#DC2626',
  warning:   '#D97706',
  gray:      '#64748B',
  lightGray: '#F1F5F9',
  border:    '#E2E8F0',
  text:      '#0F172A',
};

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [0, 0, 0];
}

function applyColor(doc, hex) {
  doc.fillColor(hexToRgb(hex));
}

/**
 * Draw a horizontal divider line.
 */
function drawLine(doc, y, color = COLORS.border) {
  const yPos = y !== undefined ? y : doc.y;
  doc.moveTo(50, yPos).lineTo(550, yPos).strokeColor(hexToRgb(color)).lineWidth(0.5).stroke();
}

/**
 * Draw a table row: [ [label, value], ... ]
 */
function drawTableRow(doc, cols, y, isHeader = false) {
  const colWidth = 500 / cols.length;
  cols.forEach((col, i) => {
    const x = 50 + i * colWidth;
    if (isHeader) {
      doc.rect(x, y - 2, colWidth, 18).fill(hexToRgb(COLORS.primary));
      applyColor(doc, '#FFFFFF');
      doc.fontSize(9).font('Helvetica-Bold').text(col, x + 4, y + 1, { width: colWidth - 8 });
    } else {
      applyColor(doc, COLORS.text);
      doc.fontSize(9).font('Helvetica').text(col, x + 4, y + 1, { width: colWidth - 8 });
    }
  });
  return y + 20;
}

// ═══════════════════════════════════════════════════════════
//  INVOICE PDF
// ═══════════════════════════════════════════════════════════
/**
 * Generate a professional invoice PDF.
 * @param {Object} invoice  - populated FeeInvoice mongoose doc or plain object
 * @param {Object} school   - SchoolSetting document
 * @returns {PDFDocument}
 */
function generateInvoicePDF(invoice, school) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  const schoolName  = school?.schoolName || school?.name || 'VMS School ERP';
  const schoolAddr  = school?.address || '123 Education Lane, Learning City';
  const schoolPhone = school?.phone || '';
  const schoolEmail = school?.email || '';

  const student = invoice.studentId || {};
  const cls     = invoice.classId   || {};
  const ay      = invoice.academicYearId || {};
  const profile = invoice.feeProfileId || {};

  // ─── Header Band ─────────────────────────────────────────
  doc.rect(0, 0, 595, 80).fill(hexToRgb(COLORS.primary));

  applyColor(doc, '#FFFFFF');
  doc.fontSize(20).font('Helvetica-Bold').text(schoolName, 50, 20, { width: 400 });
  doc.fontSize(9).font('Helvetica').text(schoolAddr, 50, 46);
  if (schoolPhone) doc.text(`📞 ${schoolPhone}  ${schoolEmail ? '✉ ' + schoolEmail : ''}`, 50, 57);

  // Right side: FEE INVOICE label
  applyColor(doc, '#93C5FD');
  doc.fontSize(11).font('Helvetica-Bold').text('FEE INVOICE', 400, 20, { width: 145, align: 'right' });
  applyColor(doc, '#FFFFFF');
  doc.fontSize(9).font('Helvetica').text(invoice.invoiceNumber || '—', 400, 36, { width: 145, align: 'right' });

  doc.moveDown(4);

  // ─── Status Badge ─────────────────────────────────────────
  const statusColor = invoice.status === 'paid'
    ? COLORS.success : invoice.status === 'partial'
    ? COLORS.warning : COLORS.danger;
  doc.rect(430, 90, 115, 22).fill(hexToRgb(statusColor));
  applyColor(doc, '#FFFFFF');
  doc.fontSize(9).font('Helvetica-Bold')
     .text((invoice.status || 'UNPAID').toUpperCase(), 432, 96, { width: 111, align: 'center' });

  // ─── Student Info Box ─────────────────────────────────────
  doc.y = 100;
  applyColor(doc, COLORS.primary);
  doc.fontSize(11).font('Helvetica-Bold').text('Student Details', 50, 100);
  drawLine(doc, 115);
  doc.y = 120;

  const infoRows = [
    ['Student Name', student.name || '—',   'Class',          cls.name || '—'],
    ['Roll No',      student.rollNo || '—',  'Academic Year',  ay.name || '—'],
    ['Parent Name',  student.parentName || '—', 'Due Date',   invoice.dueDate ? fmt(invoice.dueDate) : '—'],
    ['Invoice No',   invoice.invoiceNumber || '—', 'Generated', fmt(invoice.createdAt || new Date())],
  ];

  infoRows.forEach(([l1, v1, l2, v2]) => {
    const y = doc.y;
    applyColor(doc, COLORS.gray);
    doc.fontSize(8).font('Helvetica').text(l1 + ':', 50, y);
    applyColor(doc, COLORS.text);
    doc.fontSize(9).font('Helvetica-Bold').text(v1, 150, y, { width: 170 });

    applyColor(doc, COLORS.gray);
    doc.fontSize(8).font('Helvetica').text(l2 + ':', 330, y);
    applyColor(doc, COLORS.text);
    doc.fontSize(9).font('Helvetica-Bold').text(v2, 420, y, { width: 130 });

    doc.y = y + 16;
  });

  doc.moveDown(0.5);
  drawLine(doc);
  doc.moveDown(0.5);

  // ─── Fee Breakdown Table ──────────────────────────────────
  applyColor(doc, COLORS.primary);
  doc.fontSize(11).font('Helvetica-Bold').text('Fee Breakdown');
  doc.moveDown(0.3);

  let tableY = doc.y;
  tableY = drawTableRow(doc, ['#', 'Fee Component', 'Type', 'Amount (₹)'], tableY, true);

  const components = profile?.selectedComponents || invoice.feeItems || [];

  if (components.length > 0) {
    components.forEach((comp, i) => {
      const bg = i % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
      doc.rect(50, tableY - 2, 500, 18).fill(hexToRgb(bg));
      applyColor(doc, COLORS.text);
      const name   = comp.name    || comp.label    || `Fee ${i + 1}`;
      const type   = comp.recurringType || 'yearly';
      const amount = (comp.amount || 0).toLocaleString('en-IN');
      tableY = drawTableRow(doc, [String(i + 1), name, type, `₹${amount}`], tableY);
    });
  } else {
    // Single total row
    doc.rect(50, tableY - 2, 500, 18).fill(hexToRgb('#F8FAFC'));
    applyColor(doc, COLORS.text);
    tableY = drawTableRow(doc, ['1', 'Annual Fee', 'yearly', `₹${(invoice.totalAmount || 0).toLocaleString('en-IN')}`], tableY);
  }

  drawLine(doc, tableY);
  doc.y = tableY + 5;
  doc.moveDown(0.5);

  // ─── Summary Totals ───────────────────────────────────────
  const summaryRows = [
    ['Gross Total',       invoice.totalAmount   || 0, COLORS.text,    false],
    ['Discount',          -(invoice.discountAmount || 0), COLORS.success, true],
    ['Late Fee / Penalty', invoice.penaltyAmount  || 0, COLORS.danger,  true],
    ['Amount Paid',       -(invoice.paidAmount   || 0), COLORS.success, true],
    ['Balance Due',        invoice.dueAmount     || 0, invoice.dueAmount > 0 ? COLORS.danger : COLORS.success, false],
  ];

  summaryRows.forEach(([label, value, color, indent]) => {
    if (value === 0 && label !== 'Balance Due' && label !== 'Gross Total') return;
    const y = doc.y;
    const displayVal = Math.abs(value);
    const prefix     = value < 0 ? '-' : '';
    const lx         = indent ? 330 : 310;
    applyColor(doc, COLORS.gray);
    doc.fontSize(9).font('Helvetica').text(label, lx, y, { width: 130 });
    applyColor(doc, color);
    doc.fontSize(label === 'Balance Due' ? 11 : 9)
       .font(label === 'Balance Due' ? 'Helvetica-Bold' : 'Helvetica')
       .text(`${prefix}₹${displayVal.toLocaleString('en-IN')}`, 460, y, { width: 90, align: 'right' });
    doc.y = y + (label === 'Balance Due' ? 16 : 14);
  });

  doc.moveDown(0.5);
  drawLine(doc);

  // ─── Installment Detail (if any) ─────────────────────────
  if (invoice.installments && invoice.installments.length > 0) {
    doc.moveDown(0.7);
    applyColor(doc, COLORS.primary);
    doc.fontSize(11).font('Helvetica-Bold').text('Installment Details');
    doc.moveDown(0.3);

    let iy = doc.y;
    iy = drawTableRow(doc, ['#', 'Label', 'Due Date', 'Amount', 'Paid', 'Status'], iy, true);

    invoice.installments.forEach((inst, i) => {
      const bg = i % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
      doc.rect(50, iy - 2, 500, 18).fill(hexToRgb(bg));
      applyColor(doc, COLORS.text);
      iy = drawTableRow(doc, [
        String(inst.installmentNo || i + 1),
        inst.label || `Installment ${i + 1}`,
        inst.dueDate ? fmt(inst.dueDate) : '—',
        `₹${(inst.amount || 0).toLocaleString('en-IN')}`,
        `₹${(inst.paidAmount || 0).toLocaleString('en-IN')}`,
        (inst.status || 'pending').toUpperCase(),
      ], iy);
    });
  }

  // ─── Footer ───────────────────────────────────────────────
  doc.moveDown(2);
  drawLine(doc);
  doc.moveDown(0.5);
  applyColor(doc, COLORS.gray);
  doc.fontSize(8).font('Helvetica-Oblique')
     .text('This is a computer-generated invoice. No physical signature required.', { align: 'center' });
  doc.fontSize(8).font('Helvetica').text(`Generated on ${fmt(new Date(), true)}`, { align: 'center' });

  if (invoice.locked) {
    applyColor(doc, COLORS.danger);
    doc.fontSize(8).font('Helvetica-Bold').text('⚠ LOCKED — This invoice cannot be modified.', { align: 'center' });
  }

  return doc;
}

// ═══════════════════════════════════════════════════════════
//  RECEIPT PDF
// ═══════════════════════════════════════════════════════════
/**
 * Generate a professional payment receipt PDF.
 */
function generateReceiptPDF(payment, invoice, school) {
  const doc = new PDFDocument({ margin: 50, size: 'A5' });

  const schoolName = school?.schoolName || school?.name || 'VMS School ERP';
  const student    = payment.studentId || {};
  const cls        = invoice?.classId  || student.classId || {};

  // ─── Header ──────────────────────────────────────────────
  doc.rect(0, 0, 420, 70).fill(hexToRgb(COLORS.primary));
  applyColor(doc, '#FFFFFF');
  doc.fontSize(16).font('Helvetica-Bold').text(schoolName, 30, 15, { width: 260 });
  doc.fontSize(8).font('Helvetica').text('PAYMENT RECEIPT', 30, 38);
  doc.fontSize(8).text(payment.receiptNumber || '—', 30, 50);

  // Stamp-like circle
  doc.circle(360, 35, 28).fill(hexToRgb('#2563EB'));
  applyColor(doc, '#FFFFFF');
  doc.fontSize(8).font('Helvetica-Bold').text('PAID', 335, 30, { width: 52, align: 'center' });

  doc.y = 85;

  // ─── Student Info ─────────────────────────────────────────
  const infoRows = [
    ['Student',  student.name || '—'],
    ['Class',    cls.name     || '—'],
    ['Roll No',  student.rollNo || '—'],
    ['Date',     fmt(payment.paidAt || payment.createdAt, true)],
    ['Payment Mode', (payment.paymentMode || '—').toUpperCase()],
  ];

  if (payment.transactionId) infoRows.push(['Transaction ID', payment.transactionId]);
  if (payment.collectedBy?.name) infoRows.push(['Collected By', payment.collectedBy.name]);

  infoRows.forEach(([label, value]) => {
    const y = doc.y;
    applyColor(doc, COLORS.gray);
    doc.fontSize(8).font('Helvetica').text(label + ':', 30, y, { width: 110 });
    applyColor(doc, COLORS.text);
    doc.fontSize(8).font('Helvetica-Bold').text(value, 140, y, { width: 250 });
    doc.y = y + 14;
  });

  doc.moveDown(0.5);
  drawLine(doc);
  doc.moveDown(0.5);

  // ─── Amount Highlight ─────────────────────────────────────
  doc.rect(30, doc.y, 360, 40).fill(hexToRgb(COLORS.accent));
  applyColor(doc, '#FFFFFF');
  doc.fontSize(11).font('Helvetica').text('Amount Paid', 40, doc.y + 5, { width: 180 });
  doc.fontSize(18).font('Helvetica-Bold').text(
    `₹${(payment.amount || 0).toLocaleString('en-IN')}`,
    40, doc.y - 14, { width: 340, align: 'right' }
  );
  doc.y += 40;
  doc.moveDown(0.5);

  // Remaining due (if invoice available)
  if (invoice) {
    const due = invoice.dueAmount || 0;
    const dueColor = due > 0 ? COLORS.danger : COLORS.success;
    const y = doc.y;
    applyColor(doc, COLORS.gray);
    doc.fontSize(9).font('Helvetica').text('Balance Due After Payment:', 30, y, { width: 220 });
    applyColor(doc, dueColor);
    doc.fontSize(10).font('Helvetica-Bold').text(`₹${due.toLocaleString('en-IN')}`, 250, y, { width: 140, align: 'right' });
    doc.y = y + 16;
  }

  doc.moveDown(1);
  drawLine(doc);
  doc.moveDown(0.5);
  applyColor(doc, COLORS.gray);
  doc.fontSize(7).font('Helvetica-Oblique')
     .text('This is a computer-generated receipt. No physical signature required.', { align: 'center' });

  return doc;
}

module.exports = { generateInvoicePDF, generateReceiptPDF };
