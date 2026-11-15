export interface EmailMessage {
  to: string;
  from?: string;
  subject: string;
  html: string;
  text: string;
  tags?: Record<string, string>;
}

export interface DoseReminderEmailData {
  elderName: string;
  elderEmail: string;
  medicationName: string;
  strength: string;
  instructions: string;
  scheduledFor: string;
  actionUrl?: string;
}

export interface CaregiverAlertEmailData {
  caregiverName: string;
  caregiverEmail: string;
  elderName: string;
  medicationName: string;
  strength: string;
  scheduledFor: string;
  alertType: "unsure_dose" | "unconfirmed_dose" | "missed_appointment";
  urgency: "medium" | "high" | "critical";
  reportedNotes?: string | null;
  claimUrl?: string;
}

export interface AppointmentReminderEmailData {
  elderName: string;
  recipientEmail: string;
  title: string;
  doctorName: string;
  clinicAddress?: string | null;
  scheduledAt: string;
  companionNotes?: string | null;
}

// In-Memory store for unit tests and local inspectability
const dispatchedEmails: EmailMessage[] = [];
let mockTransportEnabled = process.env.NODE_ENV === "test";

export function getDispatchedEmails(): EmailMessage[] {
  return [...dispatchedEmails];
}

export function clearDispatchedEmails(): void {
  dispatchedEmails.length = 0;
}

/**
 * Explicitly toggles mock email transport for test harnesses.
 * Production environments must never claim delivery without a verified provider.
 */
export function setMockEmailTransport(enabled: boolean): void {
  mockTransportEnabled = enabled;
}

/**
 * Returns whether transactional email delivery is configured and active.
 */
export function isEmailProviderConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY) || mockTransportEnabled;
}

/**
 * Dispatches an email via Resend API if configured, or records to in-memory mock store
 * ONLY if explicit mock transport is enabled for testing.
 * Never claims delivery if Resend is unconfigured or fails.
 */
export async function sendEmail(message: EmailMessage): Promise<{ success: boolean; error?: string }> {
  const fromAddress = message.from || process.env.EMAIL_FROM || "CareLedger Notifications <notifications@careledger.org>";
  const payload: EmailMessage = {
    ...message,
    from: fromAddress,
  };

  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [payload.to],
          subject: payload.subject,
          html: payload.html,
          text: payload.text,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.warn("Resend API returned error:", errorBody);
        return { success: false, error: `Transactional email delivery failed: ${errorBody}` };
      }
      dispatchedEmails.push(payload);
      return { success: true };
    } catch (err: any) {
      console.warn("Resend email dispatch error:", err.message);
      return { success: false, error: `Transactional email network error: ${err.message}` };
    }
  }

  // Explicit mock transport enabled for unit testing
  if (mockTransportEnabled) {
    dispatchedEmails.push(payload);
    return { success: true };
  }

  // Never claim delivery if provider is unconfigured
  return {
    success: false,
    error: "Transactional email provider is unavailable (RESEND_API_KEY is not configured). Email was not delivered.",
  };
}

/**
 * Sends a dose reminder email to an elder.
 * Invariant: Reminders explicitly disclaim that receiving an email is NOT proof of ingestion.
 */
export async function sendDoseReminderEmail(
  data: DoseReminderEmailData
): Promise<{ success: boolean; error?: string }> {
  const timeFormatted = new Date(data.scheduledFor).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  const subject = `Medication Reminder: ${data.medicationName} (${data.strength})`;
  const actionUrl = data.actionUrl || "https://careledger.vercel.app/elder";

  const html = `
    <!DOCTYPE html>
    <html>
      <body style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 24px; color: #0f172a;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; border: 2px solid #cbd5e1;">
          <h1 style="font-size: 26px; font-weight: 800; color: #1e3a8a; margin-top: 0;">
            Hello ${data.elderName},
          </h1>
          <p style="font-size: 18px; line-height: 1.5; color: #334155;">
            It is time for your scheduled medication:
          </p>

          <div style="background-color: #eff6ff; border-left: 6px solid #2563eb; padding: 20px; border-radius: 8px; margin: 24px 0;">
            <p style="font-size: 24px; font-weight: 800; color: #1e3a8a; margin: 0 0 8px 0;">
              ${data.medicationName} - ${data.strength}
            </p>
            <p style="font-size: 18px; font-weight: bold; color: #1e40af; margin: 0 0 8px 0;">
              ⏰ Scheduled for: ${timeFormatted}
            </p>
            <p style="font-size: 16px; color: #1e293b; margin: 0;">
              👉 <strong>Instructions:</strong> ${data.instructions}
            </p>
          </div>

          <div style="text-align: center; margin: 32px 0;">
            <a href="${actionUrl}" style="display: inline-block; background-color: #059669; color: #ffffff; font-size: 20px; font-weight: bold; text-decoration: none; padding: 16px 32px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
              Open CareLedger to Confirm
            </a>
          </div>

          <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-top: 32px;">
            <p style="font-size: 14px; font-weight: bold; color: #991b1b; margin: 0;">
              ⚠️ IMPORTANT CLINICAL INVARIANT:
            </p>
            <p style="font-size: 13px; color: #7f1d1d; margin: 4px 0 0 0;">
              Opening or receiving this reminder does NOT record medication as taken. You must affirmatively confirm ingestion in your dashboard.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
Hello ${data.elderName},

It is time for your medication:
${data.medicationName} (${data.strength})
Scheduled for: ${timeFormatted}
Instructions: ${data.instructions}

Open CareLedger to confirm: ${actionUrl}

CLINICAL NOTICE: Opening or receiving this reminder is not proof of ingestion. Please confirm in your dashboard after taking your dose.
  `.trim();

  return sendEmail({
    to: data.elderEmail,
    subject,
    html,
    text,
    tags: { type: "dose_reminder", medication: data.medicationName },
  });
}

/**
 * Sends an urgent alert email to a caregiver regarding an unresolved dose.
 */
export async function sendCaregiverAlertEmail(
  data: CaregiverAlertEmailData
): Promise<{ success: boolean; error?: string }> {
  const isUnsure = data.alertType === "unsure_dose";
  const alertTitle = isUnsure ? "Unsure Dose Reported" : "Unconfirmed Scheduled Dose";
  const subject = `[URGENT] CareLedger Alert: ${data.elderName} — ${alertTitle}`;
  const claimUrl = data.claimUrl || "https://careledger.vercel.app/caregiver";

  const html = `
    <!DOCTYPE html>
    <html>
      <body style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 24px; color: #0f172a;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; border: 2px solid #f87171;">
          <div style="background-color: #fee2e2; border-radius: 8px; padding: 8px 16px; display: inline-block; font-weight: 800; color: #b91c1c; font-size: 14px; text-transform: uppercase;">
            ${data.urgency.toUpperCase()} URGENCY CARE ALERT
          </div>

          <h1 style="font-size: 24px; font-weight: 800; color: #991b1b; margin: 16px 0 8px 0;">
            ${data.elderName}: ${alertTitle}
          </h1>

          <p style="font-size: 16px; color: #334155; line-height: 1.5;">
            Hello ${data.caregiverName}, an unresolved medication event requires caregiver review:
          </p>

          <div style="background-color: #fff1f2; border-left: 6px solid #e11d48; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="font-size: 20px; font-weight: 800; color: #881337; margin: 0 0 6px 0;">
              ${data.medicationName} (${data.strength})
            </p>
            <p style="font-size: 15px; color: #4c0519; margin: 0 0 6px 0;">
              Scheduled: ${new Date(data.scheduledFor).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </p>
            ${data.reportedNotes ? `<p style="font-size: 15px; font-style: italic; color: #9f1239; margin: 6px 0 0 0;">Reported Note: "${data.reportedNotes}"</p>` : ""}
          </div>

          <div style="text-align: center; margin: 28px 0;">
            <a href="${claimUrl}" style="display: inline-block; background-color: #b91c1c; color: #ffffff; font-size: 18px; font-weight: bold; text-decoration: none; padding: 14px 28px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
              Claim Responsibility in Dashboard
            </a>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
[URGENT] CareLedger Alert: ${data.elderName} - ${alertTitle}
Hello ${data.caregiverName},

An unresolved medication event requires caregiver review:
Medication: ${data.medicationName} (${data.strength})
Scheduled for: ${data.scheduledFor}
${data.reportedNotes ? `Note: ${data.reportedNotes}` : ""}

Claim responsibility in CareLedger: ${claimUrl}
  `.trim();

  return sendEmail({
    to: data.caregiverEmail,
    subject,
    html,
    text,
    tags: { type: "caregiver_alert", elder: data.elderName },
  });
}

/**
 * Sends an appointment confirmation or reminder email.
 */
export async function sendAppointmentReminderEmail(
  data: AppointmentReminderEmailData
): Promise<{ success: boolean; error?: string }> {
  const subject = `Upcoming Doctor Visit: ${data.title} with ${data.doctorName}`;
  const dateStr = new Date(data.scheduledAt).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const timeStr = new Date(data.scheduledAt).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  const html = `
    <!DOCTYPE html>
    <html>
      <body style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 24px; color: #0f172a;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; border: 2px solid #cbd5e1;">
          <h1 style="font-size: 24px; font-weight: 800; color: #6b21a8; margin-top: 0;">
            Upcoming Doctor Visit for ${data.elderName}
          </h1>

          <div style="background-color: #faf5ff; border-left: 6px solid #9333ea; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="font-size: 22px; font-weight: 800; color: #581c87; margin: 0 0 6px 0;">
              ${data.title}
            </p>
            <p style="font-size: 16px; font-weight: bold; color: #6b21a8; margin: 0 0 6px 0;">
              👨‍⚕️ ${data.doctorName}
            </p>
            <p style="font-size: 16px; color: #3b0764; margin: 0 0 6px 0;">
              🗓️ ${dateStr} at ${timeStr}
            </p>
            ${data.clinicAddress ? `<p style="font-size: 15px; color: #4c1d95; margin: 0 0 6px 0;">📍 Location: ${data.clinicAddress}</p>` : ""}
            ${data.companionNotes ? `<p style="font-size: 15px; font-style: italic; color: #581c87; margin: 6px 0 0 0;">💡 Companion Notes: ${data.companionNotes}</p>` : ""}
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
Upcoming Doctor Visit for ${data.elderName}
Title: ${data.title}
Doctor: ${data.doctorName}
Date: ${dateStr} at ${timeStr}
Location: ${data.clinicAddress || "Not specified"}
Companion Notes: ${data.companionNotes || "None"}
  `.trim();

  return sendEmail({
    to: data.recipientEmail,
    subject,
    html,
    text,
    tags: { type: "appointment_reminder" },
  });
}
