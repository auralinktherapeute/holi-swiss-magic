import { Sparkles, ArrowRight } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";

function openWaitlist() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("open-waitlist"));
}

/**
 * Thin elegant banner displayed under the header on every page.
 * Premium, reassuring — never alert-like.
 */
export function WaitlistBanner() {
  const { t } = useTranslation();
  return (
    <div
      className="w-full border-y border-purple-500/20 bg-purple-950/20 backdrop-blur-md"
      role="region"
      aria-label={t("waitlist.banner.aria")}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-2.5">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex items-start gap-2.5 min-w-0">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-purple-300" aria-hidden />
            <p className="text-[12px] sm:text-[13px] leading-relaxed text-purple-100/85">
              {t("waitlist.banner.message_pre")}{" "}
              <span className="text-purple-200 font-medium">Holiswiss</span>.
            </p>
          </div>
          <button
            type="button"
            onClick={openWaitlist}
            className="self-end sm:self-auto inline-flex items-center gap-1 rounded-md px-2 py-1 -mr-2 text-[11px] font-semibold uppercase tracking-widest text-purple-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 transition-colors whitespace-nowrap"
          >
            {t("waitlist.banner.cta")}
            <ArrowRight className="h-3 w-3" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}