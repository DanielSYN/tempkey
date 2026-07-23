"use client";

// Trello's key+token auth flow issues the token via a redirect to
// trello.com/1/authorize and returns it in the URL fragment (#token=...),
// which is only ever readable by JavaScript in the browser -- fragments are
// never sent to the server. So this whole flow lives client-side: on first
// load we send the browser to Trello's authorize page with return_url
// pointed back at this same page; on the way back we read the fragment and
// POST the token to /api/integrations/trello/callback ourselves.
//
// NEXT_PUBLIC_TRELLO_API_KEY mirrors TRELLO_API_KEY so the (public) API key
// is available for this client-side authorize URL -- see CLAUDE.md / setup
// notes.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function buildAuthorizationUrl(returnUrl: string): string {
  const params = new URLSearchParams({
    expiration: "never",
    name: "Tempkey",
    scope: "read,write,account",
    response_type: "token",
    key: process.env.NEXT_PUBLIC_TRELLO_API_KEY ?? "",
    return_url: returnUrl,
  });

  return `https://trello.com/1/authorize?${params.toString()}`;
}

export default function TrelloConnectPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "connecting" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || !hash.includes("token=")) return;

    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const token = params.get("token");

    if (!token) return;

    setStatus("connecting");

    fetch("/api/integrations/trello/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Failed to save Trello connection.");
        }
        // Strip the token out of the URL before navigating away.
        window.history.replaceState(null, "", window.location.pathname);
        router.push("/dashboard");
      })
      .catch((err) => {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Failed to save Trello connection.");
      });
  }, [router]);

  function handleConnect() {
    const returnUrl = window.location.href.split("#")[0];
    window.location.href = buildAuthorizationUrl(returnUrl);
  }

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 px-6 py-24">
      <h1 className="text-2xl font-semibold">Connect Trello</h1>
      <p className="text-sm text-slate-600">
        Tempkey uses Trello&apos;s legacy key+token auth so it can remove contractors from your
        Workspace and its boards when their contract ends.
      </p>
      {status === "connecting" && <p className="text-sm text-slate-600">Connecting...</p>}
      {status === "error" && error && <p className="text-sm text-red-600">{error}</p>}
      {status !== "connecting" && (
        <button
          type="button"
          onClick={handleConnect}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Connect Trello
        </button>
      )}
    </main>
  );
}
