import { describe, expect, it } from "vitest";
import { bookingConfirmationGate } from "./booking-confirmation";

const ready = {
  hasServices: true,
  hasSelectedService: true,
  hasSelectedDate: true,
  loading: false,
  availabilityError: false,
  slotVerified: true,
  slotAvailable: true,
};

describe("booking confirmation gate", () => {
  it("opens details only after service, date and verified slot selection", () => {
    expect(bookingConfirmationGate(ready)).toBe("ready");
  });

  it("preserves the service requirement before opening details", () => {
    expect(bookingConfirmationGate({ ...ready, hasSelectedService: false })).toBe("service_required");
  });

  it("rejects an unavailable or stale slot", () => {
    expect(bookingConfirmationGate({ ...ready, slotAvailable: false })).toBe("slot_required");
    expect(bookingConfirmationGate({ ...ready, slotVerified: false })).toBe("slot_required");
  });

  it("does not proceed while availability is loading or failed", () => {
    expect(bookingConfirmationGate({ ...ready, loading: true })).toBe("loading");
    expect(bookingConfirmationGate({ ...ready, availabilityError: true })).toBe("availability_error");
  });
});
