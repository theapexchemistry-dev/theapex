import nodemailer from 'nodemailer';

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

let cachedTransporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (cachedTransporter) return cachedTransporter;
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    throw new Error('Gmail credentials not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD env vars in Vercel.');
  }
  cachedTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD }
  });
  return cachedTransporter;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' });

  try {
    const { to, subject, bodyHtml, attachment } = req.body || {};

    if (!Array.isArray(to) || to.length === 0) return res.status(400).json({ error: 'No recipients provided.' });
    if (!subject || !bodyHtml) return res.status(400).json({ error: 'Subject and body are required.' });

    const transporter = getTransporter();

    try { await transporter.verify(); } catch (verifyErr: any) {
      return res.status(500).json({
        error: 'Gmail auth failed. Check GMAIL_USER and GMAIL_APP_PASSWORD env vars in Vercel, and that 2-Step Verification + App Password are set up.'
      });
    }

    let sentCount = 0;
    const failedEmails: string[] = [];

    for (const recipient of to) {
      try {
        const mailOptions: any = {
          from: `"The Apex Chemistry" <${GMAIL_USER}>`,
          to: recipient,
          subject,
          html: bodyHtml
        };

        if (attachment && attachment.filename && attachment.content) {
          const base64Match = attachment.content.match(/^data:[^;]+;base64,(.*)$/);
          const base64Data = base64Match ? base64Match[1] : attachment.content;
          mailOptions.attachments = [{
            filename: attachment.filename,
            content: Buffer.from(base64Data, 'base64'),
            contentType: attachment.mimeType || 'application/octet-stream'
          }];
        }

        await transporter.sendMail(mailOptions);
        sentCount++;
      } catch (sendErr: any) {
        console.error(`Failed to send to ${recipient}:`, sendErr.message);
        failedEmails.push(recipient);
      }
    }

    return res.status(200).json({
      success: sentCount > 0,
      sentCount,
      failedEmails,
      error: sentCount === 0 ? 'Failed to send to all recipients.' : undefined
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, sentCount: 0, failedEmails: [], error: err.message });
  }
}
