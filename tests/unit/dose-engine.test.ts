import { describe, it, expect } from "vitest";
import {
  validateDoseTransition,
  transitionDoseState,
  isDoseOverdue,
  evaluateDoseForUnconfirmed,
  calculateAdherenceMetrics,
  InvalidDoseTransitionError,
  DoseInvariantViolationError,
} from "@/services/dose-engine";
import { DoseRecord } from "@/types/dose";

describe("Deterministic Dose State Machine", () => {
  describe("Invariant Checks", () => {
    it("INVARIANT: System can NEVER mark a dose as taken", () => {
      expect(() =>
        transitionDoseState({
          doseId: "dose-1",
          fromStatus: "scheduled",
          toStatus: "taken",
          actorId: "system",
          actorRole: "system",
        })
      ).toThrow(DoseInvariantViolationError);
    });

    it("INVARIANT: Reminded state is NEVER proof of ingestion", () => {
      // Transition to reminded cannot yield taken
      const result = transitionDoseState({
        doseId: "dose-1",
        fromStatus: "scheduled",
        toStatus: "reminded",
        actorId: "system",
        actorRole: "system",
      });
      expect(result.currentStatus).toBe("reminded");
      expect(result.currentStatus).not.toBe("taken");
    });

    it("INVARIANT: System cannot report 'not_yet' on behalf of user", () => {
      expect(() =>
        transitionDoseState({
          doseId: "dose-1",
          fromStatus: "reminded",
          toStatus: "not_yet",
          actorId: "system",
          actorRole: "system",
        })
      ).toThrow(InvalidDoseTransitionError);
    });
  });

  describe("Valid State Transitions", () => {
    it("allows system to dispatch reminder from scheduled to reminded", () => {
      const result = transitionDoseState({
        doseId: "dose-1",
        fromStatus: "scheduled",
        toStatus: "reminded",
        actorId: "system",
        actorRole: "system",
      });
      expect(result.success).toBe(true);
      expect(result.currentStatus).toBe("reminded");
      expect(result.requiresCaregiverAlert).toBe(false);
    });

    it("allows elder to confirm ingestion from scheduled or reminded", () => {
      const res1 = transitionDoseState({
        doseId: "dose-1",
        fromStatus: "scheduled",
        toStatus: "taken",
        actorId: "elder-123",
        actorRole: "elder",
      });
      expect(res1.currentStatus).toBe("taken");

      const res2 = transitionDoseState({
        doseId: "dose-2",
        fromStatus: "reminded",
        toStatus: "taken",
        actorId: "elder-123",
        actorRole: "elder",
      });
      expect(res2.currentStatus).toBe("taken");
    });

    it("allows elder to request delay ('not_yet')", () => {
      const result = transitionDoseState({
        doseId: "dose-1",
        fromStatus: "reminded",
        toStatus: "not_yet",
        actorId: "elder-123",
        actorRole: "elder",
        notes: "Eating breakfast first",
      });
      expect(result.currentStatus).toBe("not_yet");
      expect(result.requiresCaregiverAlert).toBe(false);
    });

    it("flags immediate caregiver alert when elder reports 'unsure'", () => {
      const result = transitionDoseState({
        doseId: "dose-1",
        fromStatus: "reminded",
        toStatus: "unsure",
        actorId: "elder-123",
        actorRole: "elder",
        notes: "I don't remember if I took the red pill",
      });
      expect(result.currentStatus).toBe("unsure");
      expect(result.requiresCaregiverAlert).toBe(true);
    });

    it("REGRESSION: Caregiver follow-up or observation CANNOT change an unsure dose to 'taken'", () => {
      expect(() =>
        transitionDoseState({
          doseId: "dose-1",
          fromStatus: "unsure",
          toStatus: "taken",
          actorId: "caregiver-456",
          actorRole: "caregiver",
          notes: "Verified pill dispenser compartment is empty",
        })
      ).toThrow(DoseInvariantViolationError);
    });

    it("allows late verified ingestion from unconfirmed to taken by elder only", () => {
      const result = transitionDoseState({
        doseId: "dose-late",
        fromStatus: "unconfirmed",
        toStatus: "taken",
        actorId: "elder-123",
        actorRole: "elder",
        notes: "Took it late at 10:30am after doctor phone call",
      });
      expect(result.currentStatus).toBe("taken");
      expect(result.requiresCaregiverAlert).toBe(false);
    });

    it("REGRESSION: Caregiver phone follow-up CANNOT change an unconfirmed dose to 'taken'", () => {
      expect(() =>
        transitionDoseState({
          doseId: "dose-late-cg",
          fromStatus: "unconfirmed",
          toStatus: "taken",
          actorId: "caregiver-456",
          actorRole: "caregiver",
          notes: "Phoned elder and confirmed dose was swallowed",
        })
      ).toThrow(DoseInvariantViolationError);
    });

    it("allows caregiver human override on taken dose with explicit note", () => {
      const result = transitionDoseState({
        doseId: "dose-override",
        fromStatus: "taken",
        toStatus: "skipped",
        actorId: "caregiver-456",
        actorRole: "caregiver",
        notes: "Elder clicked 'Took it' by mistake; dose was withheld per nephrologist order",
      });
      expect(result.currentStatus).toBe("skipped");
      expect(result.requiresCaregiverAlert).toBe(true);
    });

    it("treats same-status transitions as idempotent valid no-ops", () => {
      const result = transitionDoseState({
        doseId: "dose-same",
        fromStatus: "scheduled",
        toStatus: "scheduled",
        actorId: "elder-123",
        actorRole: "elder",
      });
      expect(result.success).toBe(true);
      expect(result.requiresCaregiverAlert).toBe(false);
    });

    it("rejects illegal transitions with InvalidDoseTransitionError", () => {
      // Cannot transition from taken back to scheduled
      expect(() =>
        transitionDoseState({
          doseId: "dose-bad",
          fromStatus: "taken",
          toStatus: "scheduled",
          actorId: "elder-123",
          actorRole: "elder",
        })
      ).toThrow(InvalidDoseTransitionError);

      // Cannot transition from skipped to unsure
      expect(() =>
        transitionDoseState({
          doseId: "dose-bad-2",
          fromStatus: "skipped",
          toStatus: "unsure",
          actorId: "elder-123",
          actorRole: "elder",
        })
      ).toThrow(InvalidDoseTransitionError);
    });
  });

  describe("Grace Period & Unconfirmed Escalation", () => {
    it("correctly identifies doses within grace period vs overdue", () => {
      const scheduledTime = new Date("2026-11-15T08:00:00Z");
      const withinGrace = new Date("2026-11-15T08:30:00Z"); // +30m
      const exactlyAtGrace = new Date("2026-11-15T09:00:00Z"); // +60m
      const pastGrace = new Date("2026-11-15T09:15:00Z"); // +75m

      expect(isDoseOverdue(scheduledTime.toISOString(), withinGrace, 60)).toBe(false);
      expect(isDoseOverdue(scheduledTime.toISOString(), exactlyAtGrace, 60)).toBe(true);
      expect(isDoseOverdue(scheduledTime.toISOString(), pastGrace, 60)).toBe(true);
    });

    it("generates unconfirmed transition and flags caregiver alert when grace period expires", () => {
      const dose: DoseRecord = {
        id: "dose-overdue-1",
        scheduleId: "sched-1",
        medicationId: "med-1",
        elderId: "elder-1",
        medicationName: "Metformin",
        dosage: "500mg",
        scheduledFor: "2026-11-15T08:00:00Z",
        status: "reminded",
        createdAt: "2026-11-15T00:00:00Z",
        updatedAt: "2026-11-15T08:00:00Z",
      };

      const currentTime = new Date("2026-11-15T09:15:00Z"); // 75 mins later
      const transitionReq = evaluateDoseForUnconfirmed(dose, currentTime, 60);

      expect(transitionReq).not.toBeNull();
      expect(transitionReq?.toStatus).toBe("unconfirmed");

      const result = transitionDoseState(transitionReq!);
      expect(result.currentStatus).toBe("unconfirmed");
      expect(result.requiresCaregiverAlert).toBe(true);
    });

    it("does not generate unconfirmed transition if dose is already taken or skipped", () => {
      const dose: DoseRecord = {
        id: "dose-taken-1",
        scheduleId: "sched-1",
        medicationId: "med-1",
        elderId: "elder-1",
        medicationName: "Metformin",
        dosage: "500mg",
        scheduledFor: "2026-11-15T08:00:00Z",
        status: "taken",
        createdAt: "2026-11-15T00:00:00Z",
        updatedAt: "2026-11-15T08:05:00Z",
      };

      const currentTime = new Date("2026-11-15T10:00:00Z");
      expect(evaluateDoseForUnconfirmed(dose, currentTime, 60)).toBeNull();
    });
  });

  describe("Mathematical Adherence Calculation", () => {
    const fixedNow = new Date("2026-11-15T12:00:00Z");

    it("calculates 100% adherence when all closed doses are taken", () => {
      const doses = [
        { status: "taken" as const, scheduled_for: "2026-11-15T08:00:00Z" },
        { status: "taken" as const, scheduled_for: "2026-11-15T10:00:00Z" },
      ];

      const metrics = calculateAdherenceMetrics(doses, fixedNow, 60);
      expect(metrics.totalExpectedDoses).toBe(2);
      expect(metrics.takenDoses).toBe(2);
      expect(metrics.adherenceRate).toBe(100);
    });

    it("returns null and 'N/A' adherence in zero-dose edge case when no dose windows have closed", () => {
      // Future doses only
      const doses = [
        { status: "scheduled" as const, scheduled_for: "2026-11-15T14:00:00Z" },
        { status: "scheduled" as const, scheduled_for: "2026-11-15T18:00:00Z" },
      ];

      const metrics = calculateAdherenceMetrics(doses, fixedNow, 60);
      expect(metrics.totalExpectedDoses).toBe(0);
      expect(metrics.pendingOpenDoses).toBe(2);
      expect(metrics.adherenceRate).toBeNull();
      expect(metrics.adherenceRateDisplay).toBe("N/A");
    });

    it("returns 0% adherence when eligible doses exist but none are reported taken", () => {
      const doses = [
        { status: "unconfirmed" as const, scheduled_for: "2026-11-15T08:00:00Z" },
        { status: "skipped" as const, scheduled_for: "2026-11-15T09:00:00Z" },
      ];

      const metrics = calculateAdherenceMetrics(doses, fixedNow, 60);
      expect(metrics.totalExpectedDoses).toBe(2);
      expect(metrics.takenDoses).toBe(0);
      expect(metrics.adherenceRate).toBe(0);
      expect(metrics.adherenceRateDisplay).toBe("0%");
    });

    it("includes overdue unescalated 'scheduled' or 'reminded' doses in denominator", () => {
      // 08:00 dose is 4 hours past (grace window 60m ended at 09:00), still marked 'scheduled'
      const doses = [
        { status: "taken" as const, scheduled_for: "2026-11-15T07:00:00Z" },
        { status: "scheduled" as const, scheduled_for: "2026-11-15T08:00:00Z" }, // Overdue unescalated!
        { status: "reminded" as const, scheduled_for: "2026-11-15T09:00:00Z" }, // Overdue unescalated!
        { status: "scheduled" as const, scheduled_for: "2026-11-15T16:00:00Z" }, // Future: open window
      ];

      const metrics = calculateAdherenceMetrics(doses, fixedNow, 60);
      // Denominator: 1 taken + 2 overdue unescalated = 3. Future dose excluded.
      expect(metrics.totalExpectedDoses).toBe(3);
      expect(metrics.takenDoses).toBe(1);
      expect(metrics.overdueUnescalatedDoses).toBe(2);
      expect(metrics.pendingOpenDoses).toBe(1);
      // 1 / 3 = 33%
      expect(metrics.adherenceRate).toBe(33);
    });

    it("counts skipped, unconfirmed, and unsure in denominator with 0 numerator contribution", () => {
      const doses = [
        { status: "taken" as const, scheduled_for: "2026-11-15T06:00:00Z" },
        { status: "skipped" as const, scheduled_for: "2026-11-15T08:00:00Z" },
        { status: "unconfirmed" as const, scheduled_for: "2026-11-15T09:00:00Z" },
        { status: "unsure" as const, scheduled_for: "2026-11-15T10:00:00Z" },
      ];

      const metrics = calculateAdherenceMetrics(doses, fixedNow, 60);
      expect(metrics.totalExpectedDoses).toBe(4);
      expect(metrics.takenDoses).toBe(1);
      expect(metrics.skippedDoses).toBe(1);
      expect(metrics.unconfirmedDoses).toBe(1);
      expect(metrics.unsureDoses).toBe(1);
      // 1 / 4 = 25%
      expect(metrics.adherenceRate).toBe(25);
    });
  });
});
