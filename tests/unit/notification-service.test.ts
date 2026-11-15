import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  sendDoseReminderEmail,
  sendCaregiverAlertEmail,
  sendAppointmentReminderEmail,
  sendEmail,
  getDispatchedEmails,
  clearDispatchedEmails,
  setMockEmailTransport,
  isEmailProviderConfigured,
} from "@/services/notification-service";

describe("Notification Service & Pluggable Transports", () => {
  beforeEach(() => {
    clearDispatchedEmails();
    setMockEmailTransport(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("sendDoseReminderEmail", () => {
    it("dispatches reminder email and includes mandatory clinical invariant disclaimer", async () => {
      const res = await sendDoseReminderEmail({
        elderName: "Eleanor Vance",
        elderEmail: "eleanor.vance@example.org",
        medicationName: "Lisinopril",
        strength: "10mg",
        instructions: "Take with a full glass of water after breakfast",
        scheduledFor: "2026-11-15T08:00:00.000Z",
      });

      expect(res.success).toBe(true);
      const emails = getDispatchedEmails();
      expect(emails).toHaveLength(1);

      const sent = emails[0];
      expect(sent.to).toBe("eleanor.vance@example.org");
      expect(sent.subject).toContain("Lisinopril (10mg)");

      // Mandatory Invariant Check: Reminders must state they are NOT proof of ingestion
      expect(sent.html).toContain("IMPORTANT CLINICAL INVARIANT");
      expect(sent.html).toContain("does NOT record medication as taken");
      expect(sent.text).toContain("CLINICAL NOTICE");
      expect(sent.text).toContain("not proof of ingestion");
    });
  });

  describe("sendCaregiverAlertEmail", () => {
    it("dispatches urgent alert notification with reported notes and claim URL", async () => {
      const res = await sendCaregiverAlertEmail({
        caregiverName: "Sarah Vance",
        caregiverEmail: "sarah.vance@example.org",
        elderName: "Eleanor Vance",
        medicationName: "Metformin",
        strength: "500mg",
        scheduledFor: "2026-11-15T12:00:00.000Z",
        alertType: "unsure_dose",
        urgency: "high",
        reportedNotes: "Patient was confused about breakfast dose",
        claimUrl: "https://careledger.vercel.app/caregiver",
      });

      expect(res.success).toBe(true);
      const emails = getDispatchedEmails();
      expect(emails).toHaveLength(1);

      const sent = emails[0];
      expect(sent.to).toBe("sarah.vance@example.org");
      expect(sent.subject).toContain("[URGENT]");
      expect(sent.subject).toContain("Eleanor Vance");
      expect(sent.subject).toContain("Unsure Dose Reported");
      expect(sent.html).toContain("HIGH URGENCY CARE ALERT");
      expect(sent.html).toContain("Patient was confused about breakfast dose");
      expect(sent.html).toContain("Claim Responsibility in Dashboard");
    });

    it("handles unconfirmed overdue alert type properly", async () => {
      const res = await sendCaregiverAlertEmail({
        caregiverName: "Sarah Vance",
        caregiverEmail: "sarah.vance@example.org",
        elderName: "Eleanor Vance",
        medicationName: "Atorvastatin",
        strength: "20mg",
        scheduledFor: "2026-11-15T21:00:00.000Z",
        alertType: "unconfirmed_dose",
        urgency: "critical",
      });

      expect(res.success).toBe(true);
      const emails = getDispatchedEmails();
      expect(emails[0].subject).toContain("Unconfirmed Scheduled Dose");
      expect(emails[0].html).toContain("CRITICAL URGENCY");
    });
  });

  describe("sendAppointmentReminderEmail", () => {
    it("dispatches medical visit reminder with clinic location and companion guidance", async () => {
      const res = await sendAppointmentReminderEmail({
        elderName: "Eleanor Vance",
        recipientEmail: "eleanor.vance@example.org",
        title: "Cardiology Checkup",
        doctorName: "Dr. Robert Chen",
        clinicAddress: "St. Jude Heart Center, Suite 402",
        scheduledAt: "2026-11-20T10:00:00.000Z",
        companionNotes: "Bring blood pressure readings logbook",
      });

      expect(res.success).toBe(true);
      const emails = getDispatchedEmails();
      expect(emails).toHaveLength(1);

      const sent = emails[0];
      expect(sent.to).toBe("eleanor.vance@example.org");
      expect(sent.subject).toContain("Dr. Robert Chen");
      expect(sent.html).toContain("St. Jude Heart Center, Suite 402");
      expect(sent.html).toContain("Bring blood pressure readings logbook");
    });
  });

  describe("Reliability & Unconfigured Provider Handling", () => {
    it("never claims delivery if Resend is unconfigured and mock transport is disabled", async () => {
      setMockEmailTransport(false);
      const originalApiKey = process.env.RESEND_API_KEY;
      delete process.env.RESEND_API_KEY;

      try {
        expect(isEmailProviderConfigured()).toBe(false);
        const res = await sendEmail({
          to: "elder@example.org",
          subject: "Test",
          html: "<p>Test</p>",
          text: "Test",
        });

        expect(res.success).toBe(false);
        expect(res.error).toContain("Transactional email provider is unavailable");
      } finally {
        if (originalApiKey) process.env.RESEND_API_KEY = originalApiKey;
        setMockEmailTransport(true);
      }
    });

    it("reports delivery failure when Resend API returns an HTTP error", async () => {
      setMockEmailTransport(false);
      process.env.RESEND_API_KEY = "re_test_key_12345";

      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response("Invalid API Key or rate limited", { status: 401 })
      );

      try {
        const res = await sendEmail({
          to: "elder@example.org",
          subject: "Test",
          html: "<p>Test</p>",
          text: "Test",
        });

        expect(res.success).toBe(false);
        expect(res.error).toContain("Transactional email delivery failed: Invalid API Key");
      } finally {
        delete process.env.RESEND_API_KEY;
        setMockEmailTransport(true);
      }
    });
  });
});
