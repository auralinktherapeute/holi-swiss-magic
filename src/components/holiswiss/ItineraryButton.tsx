import { Navigation2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

export function ItineraryButton({
  address,
  city,
  canton,
  postalCode,
  title,
}: {
  address?: string | null;
  city?: string | null;
  canton?: string | null;
  postalCode?: string | null;
  title?: string;
}) {
  const full = [address, postalCode, city, canton, "Suisse"]
    .filter(Boolean)
    .join(", ");
  const q = encodeURIComponent(full);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={title ?? "Itinéraire"}
          title={title ?? "Itinéraire"}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(184,110,249,0.3)] bg-[rgba(184,110,249,0.08)] text-[#b86ef9] hover:bg-[rgba(184,110,249,0.15)] transition"
        >
          <Navigation2 className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="border-[rgba(184,110,249,0.25)] bg-[#1a0a2e] text-white"
      >
        <DropdownMenuItem asChild>
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${q}`}
            target="_blank"
            rel="noreferrer"
            className="cursor-pointer focus:bg-[rgba(184,110,249,0.15)]"
          >
            Google Maps
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a
            href={`https://maps.apple.com/?daddr=${q}`}
            target="_blank"
            rel="noreferrer"
            className="cursor-pointer focus:bg-[rgba(184,110,249,0.15)]"
          >
            Apple Plans
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a
            href={`https://www.waze.com/ul?q=${q}&navigate=yes`}
            target="_blank"
            rel="noreferrer"
            className="cursor-pointer focus:bg-[rgba(184,110,249,0.15)]"
          >
            Waze
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}