import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  DoseStatusBadge,
  AccessibleModal,
  StatCard,
  PageHeader,
  Toast,
} from "@/components/ui";
import { AccessibilityProvider } from "@/contexts/accessibility-context";
import { DoseStatus } from "@/types/dose";

describe("Phase 2 Reusable Design System & Tokens", () => {
  describe("DoseStatusBadge", () => {
    const allSevenStates: DoseStatus[] = [
      "scheduled",
      "reminded",
      "taken",
      "not_yet",
      "unsure",
      "unconfirmed",
      "skipped",
    ];

    it.each(allSevenStates)("renders accurately for state: %s", (status) => {
      render(<DoseStatusBadge status={status} />);
      const badge = screen.getByRole("status");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute(
        "aria-label",
        expect.stringContaining("Dose status:")
      );
    });

    it("supports custom label and size options", () => {
      render(
        <DoseStatusBadge
          status="taken"
          size="lg"
          customLabel="Ingested at 8:05 AM"
        />
      );
      expect(screen.getByText("Ingested at 8:05 AM")).toBeInTheDocument();
      const badge = screen.getByRole("status");
      expect(badge.className).toContain("text-base");
    });
  });

  describe("AccessibleModal", () => {
    it("does not render when isOpen is false", () => {
      render(
        <AccessibleModal
          isOpen={false}
          onClose={vi.fn()}
          title="Medication Details"
        >
          <p>Hidden Content</p>
        </AccessibleModal>
      );
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("renders with proper ARIA attributes when isOpen is true", () => {
      render(
        <AccessibleModal
          isOpen={true}
          onClose={vi.fn()}
          title="Medication Details"
          description="View instructions and dosages"
        >
          <p>Visible Content</p>
        </AccessibleModal>
      );

      const dialog = screen.getByRole("dialog");
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute("aria-modal", "true");
      expect(screen.getByText("Medication Details")).toBeInTheDocument();
      expect(screen.getByText("View instructions and dosages")).toBeInTheDocument();
      expect(screen.getByText("Visible Content")).toBeInTheDocument();
    });

    it("invokes onClose when clicking close button or pressing Escape", () => {
      const handleClose = vi.fn();
      render(
        <AccessibleModal
          isOpen={true}
          onClose={handleClose}
          title="Modal Test"
        >
          <button>Focusable Element</button>
        </AccessibleModal>
      );

      // Close button click
      const closeButton = screen.getByLabelText("Close dialog");
      fireEvent.click(closeButton);
      expect(handleClose).toHaveBeenCalledTimes(1);

      // Escape key press
      fireEvent.keyDown(document, { key: "Escape" });
      expect(handleClose).toHaveBeenCalledTimes(2);
    });

    it("traps focus inside modal on Tab and Shift+Tab navigation", () => {
      render(
        <AccessibleModal
          isOpen={true}
          onClose={vi.fn()}
          title="Focus Trap Test"
        >
          <button data-testid="btn-first">First Button</button>
          <button data-testid="btn-second">Second Button</button>
        </AccessibleModal>
      );

      const closeBtn = screen.getByLabelText("Close dialog");
      const btnFirst = screen.getByTestId("btn-first");
      const btnSecond = screen.getByTestId("btn-second");

      // Set focus to the last element (btnSecond) and press Tab
      btnSecond.focus();
      expect(document.activeElement).toBe(btnSecond);

      fireEvent.keyDown(document, { key: "Tab", shiftKey: false });
      // When tabbing from the last element, focus wraps to the first focusable element (closeBtn)
      expect(document.activeElement).toBe(closeBtn);

      // Set focus to the first element (closeBtn) and press Shift+Tab
      closeBtn.focus();
      expect(document.activeElement).toBe(closeBtn);

      fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
      // When shift-tabbing from first element, focus wraps to last element (btnSecond)
      expect(document.activeElement).toBe(btnSecond);
    });

    it("restores focus to previous active element upon modal close", () => {
      function ModalWrapper() {
        const [isOpen, setIsOpen] = React.useState(false);
        return (
          <div>
            <button data-testid="trigger-btn" onClick={() => setIsOpen(true)}>
              Open Modal
            </button>
            <AccessibleModal
              isOpen={isOpen}
              onClose={() => setIsOpen(false)}
              title="Restoration Test"
            >
              <button onClick={() => setIsOpen(false)}>Done</button>
            </AccessibleModal>
          </div>
        );
      }

      render(<ModalWrapper />);
      const trigger = screen.getByTestId("trigger-btn");
      trigger.focus();
      expect(document.activeElement).toBe(trigger);

      // Open modal
      fireEvent.click(trigger);
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      // Close modal
      const closeBtn = screen.getByLabelText("Close dialog");
      fireEvent.click(closeBtn);

      // Focus must be restored back to trigger button
      expect(document.activeElement).toBe(trigger);
    });
  });

  describe("StatCard", () => {
    it("renders clinical values and subtext", () => {
      render(
        <StatCard
          title="Adherence Rate"
          value="85%"
          subtext="6 of 7 doses taken on schedule"
          badge={{ label: "Good", variant: "success" }}
        />
      );

      expect(screen.getByText("Adherence Rate")).toBeInTheDocument();
      expect(screen.getByText("85%")).toBeInTheDocument();
      expect(screen.getByText("6 of 7 doses taken on schedule")).toBeInTheDocument();
      expect(screen.getByText("Good")).toBeInTheDocument();
    });

    it("renders radial gauge when gaugePercentage is provided", () => {
      const { container } = render(
        <StatCard
          title="Adherence"
          value="92%"
          gaugePercentage={92}
        />
      );

      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
      expect(screen.getAllByText("92%").length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("PageHeader with Accessibility Controls", () => {
    it("renders dignified heading and verified role pill", () => {
      render(
        <AccessibilityProvider>
          <PageHeader
            title="Daily Care Schedule"
            subtitle="Review today's medications and check-in times"
            roleBadge="Elder Portal"
          />
        </AccessibilityProvider>
      );

      expect(screen.getByText("Daily Care Schedule")).toBeInTheDocument();
      expect(screen.getByText("Review today's medications and check-in times")).toBeInTheDocument();
      expect(screen.getByText("Elder Portal")).toBeInTheDocument();
      // Verifies absence of unverified HIPAA or encryption claims
      expect(screen.queryByText(/hipaa/i)).toBeNull();
      expect(screen.queryByText(/zero-knowledge/i)).toBeNull();
    });

    it("allows switching text size and toggling contrast", () => {
      render(
        <AccessibilityProvider>
          <PageHeader title="Header Test" />
        </AccessibilityProvider>
      );

      const largeTextBtn = screen.getByLabelText("Large text size");
      expect(largeTextBtn).toBeInTheDocument();
      fireEvent.click(largeTextBtn);

      const contrastBtn = screen.getByLabelText(/Toggle high contrast mode/);
      expect(contrastBtn).toBeInTheDocument();
      fireEvent.click(contrastBtn);
    });
  });

  describe("Toast Notification", () => {
    it("announces status updates with polite aria-live", () => {
      render(
        <Toast
          type="success"
          title="Dose Recorded"
          message="Lisinopril 10mg marked as taken."
        />
      );

      const toast = screen.getByRole("status");
      expect(toast).toBeInTheDocument();
      expect(toast).toHaveAttribute("aria-live", "polite");
      expect(screen.getByText("Dose Recorded")).toBeInTheDocument();
      expect(screen.getByText("Lisinopril 10mg marked as taken.")).toBeInTheDocument();
    });
  });
});
