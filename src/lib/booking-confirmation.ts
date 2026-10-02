export type BookingConfirmationGate =
  | "ready"
  | "service_required"
  | "slot_required"
  | "loading"
  | "availability_error";

/**
 * Pure guard for entering the contact-details step.
 * It never writes a booking; persistence remains exclusively in final submit.
 */
export function bookingConfirmationGate(input: {
  hasServices: boolean;
  hasSelectedService: boolean;
  hasSelectedDate: boolean;
  loading: boolean;
  availabilityError: boolean;
  slotVerified: boolean;
  slotAvailable: boolean;
}): BookingConfirmationGate {
  if (input.hasServices && !input.hasSelectedService) return "service_required";
  if (!input.hasSelectedDate) return "slot_required";
  if (input.loading) return "loading";
  if (input.availabilityError) return "availability_error";
  if (!input.slotVerified || !input.slotAvailable) return "slot_required";
  return "ready";
}
