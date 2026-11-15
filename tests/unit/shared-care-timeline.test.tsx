import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SharedCareTimeline } from "@/components/shared-care-timeline";
import { TimelineItem } from "@/services/timeline-service";

describe("SharedCareTimeline Component", () => {
  const mockItems: TimelineItem[] = [
    {
      id: "item-1",
      timestamp: "2026-11-15T08:30:00Z",
      category: "medication",
      action: "update_dose_status",
      title: "Lisinopril Confirmed Taken",
      description: "Reported dose ingestion affirmatively via elder touch interface.",
      actorRole: "elder",
      actorName: "Eleanor Vance",
      entityType: "dose_log",
      entityId: "00000000-0000-0000-0000-000000000001",
      oldValues: { status: "scheduled" },
      newValues: { status: "taken", actor_role: "elder" },
      changedFields: ["status", "actor_role"],
    },
    {
      id: "item-2",
      timestamp: "2026-11-15T07:00:00Z",
      category: "alert",
      action: "claim_alert",
      title: "Alert Responsibility Claimed",
      description: "Sarah (Primary Caregiver) claimed responsibility to follow up.",
      actorRole: "caregiver",
      actorName: "Sarah (Daughter)",
      entityType: "caregiver_alert",
      entityId: "00000000-0000-0000-0000-000000000002",
      oldValues: { status: "open", claimed_by: null },
      newValues: { status: "claimed", claimed_by: "caregiver-uuid" },
      changedFields: ["status", "claimed_by"],
    },
    {
      id: "item-3",
      timestamp: "2026-11-14T14:00:00Z",
      category: "appointment",
      action: "create_appointment",
      title: "Appointment Scheduled: Dr. Robert Vance — Cardiology",
      description: "Memorial Health Suite 304",
      actorRole: "caregiver",
      actorName: "Sarah (Daughter)",
      entityType: "appointment",
      entityId: "00000000-0000-0000-0000-000000000003",
      oldValues: null,
      newValues: { title: "Cardiology", status: "upcoming" },
      changedFields: ["title", "status"],
    },
  ];

  it("renders all timeline items and actor badges", () => {
    render(<SharedCareTimeline items={mockItems} elderName="Eleanor Vance" />);

    expect(screen.getByText(/Care Activity for Eleanor Vance/i)).toBeInTheDocument();
    expect(screen.getByText("Lisinopril Confirmed Taken")).toBeInTheDocument();
    expect(screen.getByText("Alert Responsibility Claimed")).toBeInTheDocument();
    expect(screen.getByText(/Appointment Scheduled: Dr. Robert Vance/i)).toBeInTheDocument();

    expect(screen.getByText("Elder (Eleanor Vance)")).toBeInTheDocument();
    expect(screen.getAllByText("Caregiver (Sarah (Daughter))").length).toBeGreaterThanOrEqual(1);
  });

  it("filters items by category tab", () => {
    render(<SharedCareTimeline items={mockItems} elderName="Eleanor Vance" />);

    // Click "Medications" filter
    const medBtn = screen.getByRole("button", { name: "Medications" });
    fireEvent.click(medBtn);

    expect(screen.getByText("Lisinopril Confirmed Taken")).toBeInTheDocument();
    expect(screen.queryByText("Alert Responsibility Claimed")).not.toBeInTheDocument();
    expect(screen.queryByText(/Appointment Scheduled/i)).not.toBeInTheDocument();

    // Click "Alerts & Claims" filter
    const alertBtn = screen.getByRole("button", { name: "Alerts & Claims" });
    fireEvent.click(alertBtn);

    expect(screen.getByText("Alert Responsibility Claimed")).toBeInTheDocument();
    expect(screen.queryByText("Lisinopril Confirmed Taken")).not.toBeInTheDocument();
  });

  it("expands audit diff viewer to inspect previous vs new state", () => {
    render(<SharedCareTimeline items={mockItems} elderName="Eleanor Vance" />);

    const inspectBtn = screen.getAllByRole("button", { name: /Inspect Audit Diff/i })[0];
    fireEvent.click(inspectBtn);

    expect(screen.getByText("← Previous State")).toBeInTheDocument();
    expect(screen.getByText("→ New Verified State")).toBeInTheDocument();
    expect(screen.getByText(/"scheduled"/)).toBeInTheDocument();
    expect(screen.getByText(/"taken"/)).toBeInTheDocument();
  });
});
