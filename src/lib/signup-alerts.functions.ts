import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin.functions";

const stageSchema = z.enum([
  "signup_error",
  "role_missing",
  "email_unconfirmed",
  "dashboard_denied",
]);

/**
 * Signale un blocage d'inscription thérapeute. Volontairement appelable sans
 * session : le cas « échec d'inscription » se produit avant toute session.
 * La déduplication côté serveur (6 h par compte/étape) évite tout spam.
 */
export const reportTherapistSignupBlocked = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      userId: z.string().uuid().nullish(),
      email: z.string().email().max(180).nullish(),
      stage: stageSchema,
      detail: z.string().max(300).nullish(),
    }),
  )
  .handler(async ({ data }) => {
    const { reportSignupBlock } = await import("@/lib/signup-alerts.server");
    return reportSignupBlock(data);
  });

/** Liste des inscriptions thérapeutes bloquées (admin). */
export const listBlockedTherapistSignups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { scanBlockedSignups } = await import("@/lib/signup-alerts.server");
    return { items: await scanBlockedSignups(30) };
  });

/** Débloque un compte en lui attribuant le rôle thérapeute (admin). */
export const repairBlockedTherapistSignup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ userId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { repairSignup } = await import("@/lib/signup-alerts.server");
    return repairSignup(data.userId);
  });
