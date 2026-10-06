import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type PlaceSuggestion = {
  id: string;
  primary: string;
  secondary: string;
};

type GoogleAutocompleteResponse = {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: string;
      text?: { text?: string };
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
    };
  }>;
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

export const autocompleteSwissAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { query: string; countries?: string[]; sessionToken: string }) => {
    const query = String(input?.query ?? "").trim();
    const sessionToken = String(input?.sessionToken ?? "").trim();
    const countries = (input?.countries ?? ["ch"])
      .map((country) => String(country).trim().toLowerCase())
      .filter((country) => /^[a-z]{2}$/.test(country))
      .slice(0, 5);

    if (query.length < 3 || query.length > 160) throw new Error("Invalid address query");
    if (!/^[0-9a-f-]{36}$/i.test(sessionToken)) throw new Error("Invalid session token");

    return { query, sessionToken, countries: countries.length > 0 ? countries : ["ch"] };
  })
  .handler(async ({ data }) => {
    const lovableKey = process.env["LOVABLE_API_KEY"];
    const connectionKey = process.env["GOOGLE_MAPS_API_KEY"];
    if (!lovableKey || !connectionKey) throw new Error("Google Maps connection is unavailable");

    const response = await fetch(`${GATEWAY_URL}/places/v1/places:autocomplete`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": connectionKey,
        "Content-Type": "application/json",
        "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat.mainText.text,suggestions.placePrediction.structuredFormat.secondaryText.text",
      },
      body: JSON.stringify({
        input: data.query,
        sessionToken: data.sessionToken,
        includedRegionCodes: data.countries,
        languageCode: "fr",
        locationBias: {
          rectangle: {
            low: { latitude: 45.8, longitude: 5.9 },
            high: { latitude: 47.9, longitude: 10.6 },
          },
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Google Places request failed [${response.status}]: ${errorBody}`);
      throw new Error(`Google Places request failed [${response.status}]`);
    }

    const payload = (await response.json()) as GoogleAutocompleteResponse;
    const suggestions: PlaceSuggestion[] = (payload.suggestions ?? []).flatMap((suggestion) => {
      const prediction = suggestion.placePrediction;
      const id = prediction?.placeId?.trim();
      const primary = prediction?.structuredFormat?.mainText?.text?.trim()
        || prediction?.text?.text?.trim();
      if (!id || !primary) return [];
      return [{
        id,
        primary,
        secondary: prediction?.structuredFormat?.secondaryText?.text?.trim() ?? "",
      }];
    });

    return { suggestions };
  });