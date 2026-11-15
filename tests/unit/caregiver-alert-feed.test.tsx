import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AlertFeed } from "@/components/alert-feed";
import { CaregiverAlertDetails } from "@/app/actions/caregiver";

describe("Caregiver Alert Feed Component", () => {
  const mockAlerts: CaregiverAlertDetails[] = [
    {
      id: "alert-101",
      elder_id: "00000000-0000-0000-0000-000000000001",
      dose_log_id: "dose-log-1",
      alert_type: "unconfirmed_dose",
      urgency: "high",
      status: "open",
      created_at: "2026-11-15T09:00:00Z",
      medication_name: "Lisinopril",
      dosage: "10mg",
      scheduled_for: "2026-11-15T08:00:00Z",
      dose_status: "unconfirmed",
      elder_name: "Eleanor Vance",
      elder_phone: "+1 (555) 019-2834",
    },
    {
      id: "alert-102",
      elder_id: "00000000-0000-0000-0000-000000000001",
      dose_log_id: "dose-log-2",
      alert_type: "unsure_dose",
      urgency: "critical",
      status: "claimed",
      claimed_by: "00000000-0000-0000-0000-000000000002",
      claimed_by_name: "Sarah (Daughter)",
      created_at: "2026-11-15T12:00:00Z",
      medication_name: "Metformin",
      dosage: "500mg",
      scheduled_for: "2026-11-15T12:00:00Z",
      dose_status: "unsure",
      elder_name: "Eleanor Vance",
      elder_phone: "+1 (555) 019-2834",
      resolution_notes: "Elder felt dizzy",
    },
  ];

  it("returns null when alerts array is empty", () => {
    const { container } = render(
      <AlertFeed
        alerts={[]}
        onClaimAlert={vi.fn()}
        onResolveAlert={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders prominent alert banner with urgency indicators and counts", () => {
    render(
      <AlertFeed
        alerts={mockAlerts}
        elderName="Eleanor Vance"
        elderPhone="+1 (555) 019-2834"
        onClaimAlert={vi.fn()}
        onResolveAlert={vi.fn()}
      />
    );

    expect(
      screen.getByText(/Urgent Medication Escalation Feed/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/ACTION REQUIRED/i)).toBeInTheDocument();
    expect(
      screen.getByText(/1 Unclaimed • 1 In Progress/i)
    ).toBeInTheDocument();

    const callElderBtn = screen.getByLabelText(/Call Eleanor Vance/i);
    expect(callElderBtn).toHaveAttribute("href", "tel:+1 (555) 019-2834");
  });

  it("displays medication name, elder name, scheduled time, and dose state for each alert", () => {
    render(
      <AlertFeed
        alerts={mockAlerts}
        elderName="Eleanor Vance"
        elderPhone="+1 (555) 019-2834"
        onClaimAlert={vi.fn()}
        onResolveAlert={vi.fn()}
      />
    );

    // Alert 1 (Unconfirmed)
    expect(screen.getByText(/Lisinopril \(10mg\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Overdue Unconfirmed Dose/i)).toBeInTheDocument();
    expect(screen.getByText("unconfirmed")).toBeInTheDocument();

    // Alert 2 (Unsure)
    expect(screen.getByText(/Metformin \(500mg\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Unsure Dose Reported/i)).toBeInTheDocument();
    expect(screen.getByText("unsure")).toBeInTheDocument();
    expect(screen.getByText(/Note: "Elder felt dizzy"/i)).toBeInTheDocument();
  });

  it("allows 1-click responsibility claim for unclaimed alerts", () => {
    const onClaimMock = vi.fn();
    render(
      <AlertFeed
        alerts={mockAlerts}
        onClaimAlert={onClaimMock}
        onResolveAlert={vi.fn()}
      />
    );

    const claimBtn = screen.getByRole("button", { name: /Claim Responsibility/i });
    fireEvent.click(claimBtn);
    expect(onClaimMock).toHaveBeenCalledWith("alert-101");
  });

  it("shows claimed state and allows resolving claimed alerts", () => {
    const onResolveMock = vi.fn();
    render(
      <AlertFeed
        alerts={mockAlerts}
        onClaimAlert={vi.fn()}
        onResolveAlert={onResolveMock}
      />
    );

    expect(screen.getByText(/Claimed by Sarah \(Daughter\)/i)).toBeInTheDocument();
    const resolveBtn = screen.getByRole("button", { name: /Mark Resolved/i });
    fireEvent.click(resolveBtn);
    expect(onResolveMock).toHaveBeenCalledWith("alert-102", "dose-log-2");
  });
});
