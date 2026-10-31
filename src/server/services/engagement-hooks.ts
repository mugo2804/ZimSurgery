import 'server-only';

// Integration points for patient engagement (Phase 5). Kept separate so scheduling code
// does not depend on messaging providers.
export async function onAppointmentBooked(_appointmentId: string): Promise<void> {
  // Phase 5: queue the booking confirmation (FEATURES §E)
}
