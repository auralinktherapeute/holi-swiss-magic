import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/$lang/therapeutes/$slug")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/$lang/therapeute/$slug",
      params: { lang: params.lang, slug: params.slug },
      replace: true,
    });
  },
  head: () => ({
    meta: [{ name: "robots", content: "noindex" }],
  }),
});