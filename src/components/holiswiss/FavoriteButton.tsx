import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export function FavoriteButton({
  therapistId,
  className = "",
  size = 4,
}: {
  therapistId: string;
  className?: string;
  size?: number;
}) {
  const { user } = useAuth();
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) {
      setActive(false);
      return;
    }
    let cancel = false;
    (supabase as any)
      .from("favorites")
      .select("id")
      .eq("user_id", user.id)
      .eq("therapist_id", therapistId)
      .maybeSingle()
      .then(({ data }: any) => {
        if (!cancel) setActive(!!data);
      });
    return () => {
      cancel = true;
    };
  }, [user, therapistId]);

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast.error("Connectez-vous pour ajouter ce thérapeute à vos favoris.");
      return;
    }
    if (busy) return;
    setBusy(true);
    if (active) {
      const { error } = await (supabase as any)
        .from("favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("therapist_id", therapistId);
      if (!error) {
        setActive(false);
        toast.success("Retiré des favoris");
      } else toast.error("Erreur");
    } else {
      const { error } = await (supabase as any)
        .from("favorites")
        .insert({ user_id: user.id, therapist_id: therapistId });
      if (!error) {
        setActive(true);
        toast.success("Ajouté aux favoris");
      } else toast.error("Erreur");
    }
    setBusy(false);
  };

  return (
    <motion.button
      whileTap={{ scale: 0.85 }}
      onClick={toggle}
      aria-label={active ? "Retirer des favoris" : "Ajouter aux favoris"}
      aria-pressed={active}
      className={`flex h-9 w-9 items-center justify-center rounded-full border transition ${
        active
          ? "border-rose-400/60 bg-rose-500/15 text-rose-300"
          : "border-[rgba(184,110,249,0.3)] bg-[rgba(184,110,249,0.08)] text-[#b86ef9] hover:bg-[rgba(184,110,249,0.15)]"
      } ${className}`}
      disabled={busy}
    >
      <Heart className={`h-${size} w-${size} ${active ? "fill-current" : ""}`} />
    </motion.button>
  );
}