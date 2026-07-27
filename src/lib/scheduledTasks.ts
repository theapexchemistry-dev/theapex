import { StorageService } from './storage';
import { sendEmailViaGmail, getAccessToken } from './auth';

/**
 * Scheduled Task: Runs on the 5th day of every month.
 * - Creates an in-app notification in each unpaid student's profile.
 * - ALSO sends an email reminder to every student who has a registered email,
 *   using the admin's cached Google (Gmail) OAuth token.
 *
 * If the admin is not signed into Google, emails are skipped but in-app
 * notifications are still created.
 */
export async function runMonthlyFeeReminderTask(forceRun = false): Promise<{
  ran: boolean;
  count: number;
  notifCount: number;
  emailCount: number;
  emailErrors: string[];
  message: string;
}> {
  const now = new Date();
  const currentDay = now.getDate();
  const currentMonth = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const storageKey = 'apex_last_fee_reminder_month';
  const lastRunMonth = localStorage.getItem(storageKey);

  if (!forceRun) {
    if (currentDay < 5) {
      return {
        ran: false,
        count: 0,
        notifCount: 0,
        emailCount: 0,
        emailErrors: [],
        message: `Scheduled task queued: Runs on the 5th day of every month. Today is day ${currentDay}.`
      };
    }
    if (lastRunMonth === currentMonthKey) {
      return {
        ran: false,
        count: 0,
        notifCount: 0,
        emailCount: 0,
        emailErrors: [],
        message: `Monthly fee reminder task for ${currentMonth} was already executed.`
      };
    }
  }

  const students = StorageService.getStudents();
  const batches = StorageService.getBatches();
  const feeRecords = StorageService.getFeeRecords();
  const websiteUrl = window.location.origin;

  let notifCount = 0;
  let emailCount = 0;
  const emailErrors: string[] = [];

  // Do we have an admin Gmail token? (set when admin signs in with Google, e.g. via Sync Calendar)
  const gmailToken = await getAccessToken();
  const canSendEmail = !!gmailToken;

  const emailJobs: Promise<void>[] = [];

  students.forEach(student => {
    // Find (or create) the fee record for the current month
    let currentMonthFee = feeRecords.find(
      f => f.studentId === student.id && f.month === currentMonth
    );
    if (!currentMonthFee) {
      currentMonthFee = StorageService.addFeeRecord({
        studentId: student.id,
        studentName: student.name,
        batchId: student.batchId,
        month: currentMonth,
        amount: student.fees,
        status: 'unpaid'
      });
    }

    if (currentMonthFee.status !== 'unpaid') return;

    const studentBatch = batches.find(b => b.id === student.batchId);
    const batchTitle = studentBatch ? studentBatch.title : student.batchTitle || 'Chemistry Batch';

    // De-dupe in-app notifications for the same month unless forceRun
    const existingNotifs = StorageService.getNotifications();
    const alreadyNotified = existingNotifs.some(
      n =>
        n.targetStudentId === student.id &&
        n.type === 'fee_reminder' &&
        n.title.includes(currentMonth)
    );

    if (alreadyNotified && !forceRun) return;

    // 1) In-app notification → student's profile
    StorageService.addNotification({
      title: `Monthly Fee Reminder - ${currentMonth}`,
      message: `Dear ${student.name}, your tuition fee of ₹${student.fees.toLocaleString()} for ${batchTitle} (${currentMonth}) is pending. Please visit your Fees Panel at ${websiteUrl} to pay via UPI.`,
      type: 'fee_reminder',
      timestamp: 'Scheduled 5th-Day Task',
      targetRole: 'student',
      targetStudentId: student.id,
      read: false
    });
    notifCount++;

    // 2) Email reminder → student's registered email
    if (canSendEmail && student.email) {
      const subject = `Fee Payment Reminder - ${currentMonth} | The Apex Chemistry`;
      const bodyHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #0B132B; margin-bottom: 4px;">The Apex Chemistry</h2>
          <p style="color: #64748b; margin-top: 0;">Monthly Fee Reminder</p>
          <p>Dear <strong>${student.name}</strong>,</p>
          <p>This is a gentle reminder that your tuition fee of
             <strong>₹${student.fees.toLocaleString()}</strong> for
             <strong>${batchTitle}</strong> for the month of
             <strong>${currentMonth}</strong> is currently <strong>pending</strong>.</p>
          <p>Please log in to your student portal and visit the
             <strong>Fees</strong> panel to complete the payment via UPI.</p>
          <p style="margin-top: 18px;">
            <a href="${websiteUrl}" style="background: #4f46e5; color: #fff; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-weight: bold;">
              Open Student Portal
            </a>
          </p>
          <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">
            Student ID: ${student.id}<br/>
            Batch: ${batchTitle}<br/>
            — Mr. Subhamoy Mondal, The Apex Chemistry
          </p>
        </div>
      `;

      emailJobs.push(
        sendEmailViaGmail(student.email as string, subject, bodyHtml, undefined, gmailToken || undefined)
          .then(res => {
            if (res.success) emailCount++;
            else emailErrors.push(`${student.name} (${student.email}): ${res.error}`);
          })
          .catch(err => {
            emailErrors.push(`${student.name} (${student.email}): ${err.message || 'unknown error'}`);
          })
      );
    }
  });

  // Fire all emails in parallel
  await Promise.all(emailJobs);

  localStorage.setItem(storageKey, currentMonthKey);

  let message = `Scheduled 5th-day fee reminder task executed for ${currentMonth}. `;
  message += `Sent ${notifCount} in-app notification(s)`;
  if (canSendEmail) {
    message += ` and ${emailCount} email(s) to registered student addresses.`;
    if (emailErrors.length) {
      message += ` ${emailErrors.length} email(s) failed: ${emailErrors.slice(0, 3).join('; ')}${emailErrors.length > 3 ? ' …' : ''}`;
    }
  } else {
    message += `. Emails were NOT sent — admin is not signed into Google. Click "Sync Calendar" (or sign in with Google) first to enable email reminders.`;
  }

  return { ran: true, count: notifCount, notifCount, emailCount, emailErrors, message };
}
