import jsPDF from 'jspdf';
import { Student, FeeRecord, Test, StudentSubmission } from '../types';

export function generateFeeReceiptPDF(student: Student, feeRecords: FeeRecord[], singleRecord?: FeeRecord) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Page dimensions: 210mm x 297mm
  // Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 210, 38, 'F');

  // Amber Accent Line
  doc.setFillColor(251, 191, 36); // amber-400
  doc.rect(0, 38, 210, 2, 'F');

  // Title Text
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('THE APEX CHEMISTRY', 14, 16);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(226, 232, 240);
  doc.text('Excellence in Chemistry Education | Faculty: Suvomoy Mandal', 14, 23);
  doc.text('UPI ID: suvoyom@oksbi | Institute Fees Portal', 14, 29);

  // Document Badge
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(251, 191, 36);
  doc.text(singleRecord ? 'PAYMENT RECEIPT' : 'FEE STATEMENT', 196, 16, { align: 'right' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  const dateStr = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  doc.text(`Date: ${dateStr}`, 196, 23, { align: 'right' });
  doc.text(`Ref: RCPT-${student.id.toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`, 196, 29, { align: 'right' });

  // Student Profile Summary Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 45, 182, 34, 3, 3, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text('STUDENT INFORMATION', 18, 52);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Student Name:', 18, 60);
  doc.text('Student ID:', 18, 66);
  doc.text('Class / Grade:', 18, 72);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text(student.name, 45, 60);
  doc.text(student.id, 45, 66);
  doc.text(student.className, 45, 72);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Batch:', 110, 60);
  doc.text('Phone:', 110, 66);
  doc.text('Joining Date:', 110, 72);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text(student.batchTitle || 'Apex Chemistry Batch', 132, 60);
  doc.text(student.phone || '—', 132, 66);
  doc.text(student.joiningDate || '—', 132, 72);

  // Table Header
  let startY = 86;
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.rect(14, startY, 182, 8, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text('Academic Month', 18, startY + 5.5);
  doc.text('Amount', 72, startY + 5.5);
  doc.text('Status', 112, startY + 5.5);
  doc.text('Date / Transaction Ref', 150, startY + 5.5);

  startY += 8;

  const recordsToDisplay = singleRecord ? [singleRecord] : feeRecords;

  recordsToDisplay.forEach((record, index) => {
    const rowY = startY + (index * 9);

    if (index % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, rowY, 182, 9, 'F');
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(record.month, 18, rowY + 6);

    doc.setFont('helvetica', 'normal');
    doc.text(`Rs. ${record.amount.toLocaleString('en-IN')}`, 72, rowY + 6);

    if (record.status === 'paid') {
      doc.setTextColor(16, 185, 129);
      doc.setFont('helvetica', 'bold');
      doc.text('PAID / CLEARED', 112, rowY + 6);
    } else if (record.status === 'pending_verification') {
      doc.setTextColor(217, 119, 6);
      doc.setFont('helvetica', 'bold');
      doc.text('PENDING VERIF.', 112, rowY + 6);
    } else {
      doc.setTextColor(225, 29, 72);
      doc.setFont('helvetica', 'bold');
      doc.text('UNPAID', 112, rowY + 6);
    }

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(record.paidDate || record.transactionRef || '—', 150, rowY + 6);

    doc.setDrawColor(226, 232, 240);
    doc.line(14, rowY + 9, 196, rowY + 9);
  });

  const totalY = startY + (recordsToDisplay.length * 9) + 6;

  // Financial Summary Card
  const totalAmount = recordsToDisplay.reduce((sum, r) => sum + r.amount, 0);
  const totalPaid = recordsToDisplay.filter(r => r.status === 'paid').reduce((sum, r) => sum + r.amount, 0);
  const totalDue = recordsToDisplay.filter(r => r.status === 'unpaid').reduce((sum, r) => sum + r.amount, 0);

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(110, totalY, 86, 28, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Total Fees Billed:', 114, totalY + 7);
  doc.text('Total Amount Cleared:', 114, totalY + 14);
  doc.text('Outstanding Dues:', 114, totalY + 21);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`Rs. ${totalAmount.toLocaleString('en-IN')}`, 192, totalY + 7, { align: 'right' });

  doc.setTextColor(16, 185, 129);
  doc.text(`Rs. ${totalPaid.toLocaleString('en-IN')}`, 192, totalY + 14, { align: 'right' });

  doc.setTextColor(225, 29, 72);
  doc.text(`Rs. ${totalDue.toLocaleString('en-IN')}`, 192, totalY + 21, { align: 'right' });

  // Verification Footer
  const footerY = Math.max(totalY + 38, 235);

  doc.setDrawColor(203, 213, 225);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(14, footerY, 196, footerY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('THE APEX CHEMISTRY - ACADEMIC PORTAL', 14, footerY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('This is an official computer-generated fee statement and receipt.', 14, footerY + 11);
  doc.text('For support or queries regarding fee credits, contact: suvoyom@oksbi', 14, footerY + 15);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text('Suvomoy Mandal', 196, footerY + 11, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Authorized Faculty & Director', 196, footerY + 15, { align: 'right' });

  // Save File
  const safeStudentName = student.name.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = singleRecord
    ? `Fee_Receipt_${safeStudentName}_${singleRecord.month.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
    : `Fee_Receipt_Statement_${safeStudentName}.pdf`;

  doc.save(filename);
}

/**
 * Generates an official, high-resolution PDF report of student's test submission,
 * including scorecard, rank, question-by-question response, correct options, and solutions.
 */
export function generateTestResponsePDF(student: Student, test: Test, submission: StudentSubmission) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - (margin * 2);

  function drawHeader(pageNum: number, totalPagesPlaceholder = '') {
    // Header Banner
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, pageWidth, 36, 'F');

    // Amber Accent Line
    doc.setFillColor(251, 191, 36); // amber-400
    doc.rect(0, 36, pageWidth, 2, 'F');

    // Title Text
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('THE APEX CHEMISTRY', margin, 14);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(226, 232, 240);
    doc.text('Excellence in Chemistry Education | Faculty: Mr. Subhamoy Mondal', margin, 21);
    doc.text(`Official Academic Test Assessment & Response Sheet`, margin, 27);

    // Document Badge
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(251, 191, 36);
    doc.text('TEST SCORECARD & REPORT', pageWidth - margin, 14, { align: 'right' });

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225);
    const dateStr = test.date || new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    doc.text(`Test Date: ${dateStr}`, pageWidth - margin, 21, { align: 'right' });
    doc.text(`Ref: APEX-TEST-${test.id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8)}`, pageWidth - margin, 27, { align: 'right' });
  }

  function drawFooter(pageNum: number) {
    const footerY = pageHeight - 12;
    doc.setDrawColor(226, 232, 240);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text('THE APEX CHEMISTRY • OFFICIAL EXAMINATION PORTAL', margin, footerY);

    doc.setFont('helvetica', 'normal');
    doc.text(`Page ${pageNum}`, pageWidth - margin, footerY, { align: 'right' });
  }

  let currentPage = 1;
  drawHeader(currentPage);

  // 1. Student & Test Profile Summary Card
  let currentY = 44;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, currentY, contentWidth, 34, 3, 3, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('STUDENT & EXAMINATION DETAILS', margin + 4, currentY + 6);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Student Name:', margin + 4, currentY + 14);
  doc.text('Student ID:', margin + 4, currentY + 21);
  doc.text('Class / Batch:', margin + 4, currentY + 28);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text(student.name || '—', margin + 28, currentY + 14);
  doc.text(student.id || '—', margin + 28, currentY + 21);
  doc.text(`${student.className || test.className || 'Chemistry Batch'} (${test.batchTitle || student.batchTitle || 'Main'})`, margin + 28, currentY + 28);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Test Title:', margin + 96, currentY + 14);
  doc.text('Topic / Chapter:', margin + 96, currentY + 21);
  doc.text('Duration & Time:', margin + 96, currentY + 28);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  const truncatedTitle = test.title.length > 32 ? test.title.substring(0, 32) + '...' : test.title;
  doc.text(truncatedTitle, margin + 124, currentY + 14);
  doc.text(test.topic || 'General Chemistry', margin + 124, currentY + 21);
  
  const timeTakenStr = submission.timeSpentSeconds
    ? `${Math.floor(submission.timeSpentSeconds / 60)}m ${submission.timeSpentSeconds % 60}s / ${test.durationMinutes || 30}m`
    : `${test.durationMinutes || 30} mins`;
  doc.text(timeTakenStr, margin + 124, currentY + 28);

  // 2. Scorecard & Performance Metrics Box
  currentY += 38;
  const percentage = test.totalMarks > 0 ? Math.round((submission.score / test.totalMarks) * 100) : 0;
  
  doc.setFillColor(238, 242, 255); // indigo-50
  doc.setDrawColor(199, 210, 254); // indigo-200
  doc.roundedRect(margin, currentY, contentWidth, 26, 3, 3, 'FD');

  // Score Box
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(79, 70, 229);
  doc.text('MARKS SCORED', margin + 12, currentY + 8, { align: 'center' });
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(`${submission.score} / ${test.totalMarks}`, margin + 12, currentY + 18, { align: 'center' });

  // Rank Box
  doc.setFontSize(8);
  doc.setTextColor(217, 119, 6); // amber-600
  doc.text('CLASS RANK', margin + 46, currentY + 8, { align: 'center' });
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(`#${submission.rank || 1}`, margin + 46, currentY + 18, { align: 'center' });

  // Percentage Box
  doc.setFontSize(8);
  doc.setTextColor(79, 70, 229);
  doc.text('PERCENTAGE', margin + 80, currentY + 8, { align: 'center' });
  doc.setFontSize(14);
  doc.setTextColor(percentage >= 75 ? 16 : percentage >= 50 ? 79 : 225, percentage >= 75 ? 185 : percentage >= 50 ? 70 : 29, percentage >= 75 ? 129 : percentage >= 50 ? 229 : 72);
  doc.text(`${percentage}%`, margin + 80, currentY + 18, { align: 'center' });

  // Correct / Wrong / Skipped
  doc.setFontSize(8);
  doc.setTextColor(16, 185, 129); // green
  doc.text('CORRECT', margin + 114, currentY + 8, { align: 'center' });
  doc.setFontSize(12);
  doc.text(`${submission.correctCount || 0}`, margin + 114, currentY + 17, { align: 'center' });

  doc.setFontSize(8);
  doc.setTextColor(225, 29, 72); // red
  doc.text('INCORRECT', margin + 144, currentY + 8, { align: 'center' });
  doc.setFontSize(12);
  doc.text(`${submission.wrongCount || 0}`, margin + 144, currentY + 17, { align: 'center' });

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139); // gray
  doc.text('UNANSWERED', margin + 172, currentY + 8, { align: 'center' });
  doc.setFontSize(12);
  doc.text(`${submission.unansweredCount || 0}`, margin + 172, currentY + 17, { align: 'center' });

  // 3. Question-by-Question Response Review
  currentY += 32;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('QUESTION-BY-QUESTION RESPONSE & SOLUTIONS', margin, currentY);

  currentY += 4;

  const questions = test.questions || [];
  const optionsLabels = ['A', 'B', 'C', 'D'];

  questions.forEach((q, idx) => {
    const studentChoice = submission.answers?.[q.id] ?? -1;
    const isAttempted = studentChoice !== -1 && studentChoice !== undefined;
    const isCorrect = isAttempted && studentChoice === q.correctOption;
    const isWrong = isAttempted && !isCorrect;

    // Estimate height needed for this question item
    const splitQuestionText = doc.splitTextToSize(`Q${idx + 1}. ${q.question}`, contentWidth - 8);
    const questionTextHeight = splitQuestionText.length * 4.2;
    const optionsHeight = q.options.length * 5;
    const explanationText = q.explanation ? doc.splitTextToSize(`Solution: ${q.explanation}`, contentWidth - 12) : [];
    const explanationHeight = explanationText.length > 0 ? (explanationText.length * 3.8 + 6) : 0;
    const totalBoxHeight = questionTextHeight + optionsHeight + explanationHeight + 14;

    // If box would overflow the page, start a new page
    if (currentY + totalBoxHeight > pageHeight - 18) {
      drawFooter(currentPage);
      doc.addPage();
      currentPage++;
      drawHeader(currentPage);
      currentY = 44;
    }

    // Question Box Background
    doc.setFillColor(isCorrect ? 240 : isWrong ? 254 : 248, isCorrect ? 253 : isWrong ? 242 : 250, isCorrect ? 244 : isWrong ? 242 : 252);
    doc.setDrawColor(isCorrect ? 187 : isWrong ? 254 : 226, isCorrect ? 247 : isWrong ? 202 : 232, isCorrect ? 208 : isWrong ? 202 : 240);
    doc.roundedRect(margin, currentY, contentWidth, totalBoxHeight, 2, 2, 'FD');

    // Question Header & Status Badge
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(splitQuestionText, margin + 4, currentY + 5.5);

    // Status Badge at top right
    let statusText = 'UNANSWERED (0)';
    doc.setTextColor(100, 116, 139);
    if (isCorrect) {
      statusText = 'CORRECT (+marks)';
      doc.setTextColor(16, 185, 129);
    } else if (isWrong) {
      statusText = 'INCORRECT (-marks)';
      doc.setTextColor(225, 29, 72);
    }
    doc.setFontSize(7.5);
    doc.text(statusText, pageWidth - margin - 4, currentY + 5.5, { align: 'right' });

    let optY = currentY + questionTextHeight + 4;

    // Render Options
    q.options.forEach((opt, optIdx) => {
      const isSelected = studentChoice === optIdx;
      const isThisCorrect = q.correctOption === optIdx;

      let prefix = `(${optionsLabels[optIdx]}) `;
      let optColor: [number, number, number] = [51, 65, 85];
      let optFont: 'bold' | 'normal' = 'normal';

      if (isThisCorrect) {
        prefix += '✓ [CORRECT] ';
        optColor = [16, 185, 129];
        optFont = 'bold';
      }
      if (isSelected && !isThisCorrect) {
        prefix += '✗ [YOUR CHOICE] ';
        optColor = [225, 29, 72];
        optFont = 'bold';
      } else if (isSelected && isThisCorrect) {
        prefix += '[YOUR CHOICE] ';
      }

      doc.setFont('helvetica', optFont);
      doc.setFontSize(8);
      doc.setTextColor(optColor[0], optColor[1], optColor[2]);
      
      const splitOpt = doc.splitTextToSize(`${prefix}${opt}`, contentWidth - 12);
      doc.text(splitOpt, margin + 6, optY + 3.5);
      optY += Math.max(splitOpt.length * 4.2, 5);
    });

    // Render Explanation if available
    if (explanationText.length > 0) {
      optY += 1;
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(margin + 4, optY, contentWidth - 8, explanationHeight - 1, 1.5, 1.5, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(explanationText, margin + 7, optY + 4);
    }

    currentY += totalBoxHeight + 3.5;
  });

  drawFooter(currentPage);

  // Save File
  const safeStudentName = (student.name || 'Student').replace(/[^a-zA-Z0-9]/g, '_');
  const safeTestTitle = (test.title || 'Test').replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Apex_Chemistry_Test_Report_${safeStudentName}_${safeTestTitle}.pdf`);
}

