"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type SlackOptions = { connected: true; channels: Array<{ id: string; name: string }>; error?: string } | { connected: false };
type GoogleOptions = { connected: true; files: Array<{ id: string; name: string; mimeType: string }>; error?: string } | { connected: false };
type TrelloWorkspace = {
  id: string;
  displayName: string;
  members: Array<{ id: string; fullName: string; username: string }>;
};
type TrelloOptions = { connected: true; workspaces: TrelloWorkspace[]; error?: string } | { connected: false };
type NotionOptions = { connected: true; pages: Array<{ id: string; title: string; url: string }>; error?: string } | { connected: false };

type IntegrationOptions = {
  slack: SlackOptions;
  google: GoogleOptions;
  trello: TrelloOptions;
  notion: NotionOptions;
};

type TrelloSelection = { organizationId: string; memberId: string } | null;

export default function NewContractorPage() {
  const router = useRouter();

  const [options, setOptions] = useState<IntegrationOptions | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [endDate, setEndDate] = useState("");

  const [slackChannelIds, setSlackChannelIds] = useState<string[]>([]);
  const [googleFileIds, setGoogleFileIds] = useState<string[]>([]);
  const [trelloSelection, setTrelloSelection] = useState<TrelloSelection>(null);
  const [notionPageIds, setNotionPageIds] = useState<string[]>([]);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/integrations/options")
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Failed to load integration options.");
        }
        return res.json();
      })
      .then((data: IntegrationOptions) => setOptions(data))
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Failed to load integration options."))
      .finally(() => setLoading(false));
  }, []);

  function toggle(list: string[], id: string, setList: (next: string[]) => void) {
    if (list.includes(id)) {
      setList(list.filter((existing) => existing !== id));
    } else {
      setList([...list, id]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (!options) return;

    const grants: Array<{ platform: string; scopeType: string; scopeRefs: unknown }> = [];

    if (slackChannelIds.length > 0) {
      grants.push({ platform: "SLACK", scopeType: "SLACK_CHANNELS", scopeRefs: { channelIds: slackChannelIds } });
    }
    if (googleFileIds.length > 0) {
      grants.push({ platform: "GOOGLE", scopeType: "GOOGLE_FILES", scopeRefs: { fileIds: googleFileIds } });
    }
    if (trelloSelection) {
      grants.push({
        platform: "TRELLO",
        scopeType: "TRELLO_BOARD",
        scopeRefs: { organizationId: trelloSelection.organizationId, memberId: trelloSelection.memberId },
      });
    }
    if (notionPageIds.length > 0 && options.notion.connected) {
      const pages = options.notion.pages.filter((page) => notionPageIds.includes(page.id));
      grants.push({
        platform: "NOTION",
        scopeType: "NOTION_PAGES",
        scopeRefs: { pageIds: pages.map((page) => page.id), pageTitles: pages.map((page) => page.title) },
      });
    }

    if (grants.length === 0) {
      setSubmitError("Select at least one item to grant access to.");
      return;
    }

    setSubmitting(true);

    const res = await fetch("/api/contractors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, endDate, grants }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setSubmitError(typeof data.error === "string" ? data.error : "Something went wrong.");
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    router.push("/dashboard");
  }

  if (loading) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-24">
        <p className="text-sm text-slate-600">Loading...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-16">
      <h1 className="text-2xl font-semibold">Add contractor</h1>

      {loadError && <p className="text-sm text-red-600">{loadError}</p>}

      <form onSubmit={handleSubmit} className="flex flex-col gap-8">
        <div className="flex flex-col gap-4">
          <input
            type="text"
            required
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
          />
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
          />
          <label className="flex flex-col gap-1 text-sm text-slate-600">
            End date
            <input
              type="date"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
        </div>

        {options && (
          <div className="flex flex-col gap-6">
            <h2 className="text-lg font-semibold">Access to grant</h2>

            {options.slack.connected ? (
              <fieldset className="flex flex-col gap-2 rounded-md border border-slate-200 p-4">
                <legend className="px-1 text-sm font-medium">Slack channels</legend>
                {options.slack.error ? (
                  <p className="text-xs text-red-600">{options.slack.error}</p>
                ) : options.slack.channels.length === 0 ? (
                  <p className="text-xs text-slate-500">No channels found.</p>
                ) : (
                  options.slack.channels.map((channel) => (
                    <label key={channel.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={slackChannelIds.includes(channel.id)}
                        onChange={() => toggle(slackChannelIds, channel.id, setSlackChannelIds)}
                      />
                      #{channel.name}
                    </label>
                  ))
                )}
              </fieldset>
            ) : (
              <UnconnectedNotice label="Slack" />
            )}

            {options.google.connected ? (
              <fieldset className="flex flex-col gap-2 rounded-md border border-slate-200 p-4">
                <legend className="px-1 text-sm font-medium">Google Drive files</legend>
                {options.google.error ? (
                  <p className="text-xs text-red-600">{options.google.error}</p>
                ) : options.google.files.length === 0 ? (
                  <p className="text-xs text-slate-500">No files found.</p>
                ) : (
                  options.google.files.map((file) => (
                    <label key={file.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={googleFileIds.includes(file.id)}
                        onChange={() => toggle(googleFileIds, file.id, setGoogleFileIds)}
                      />
                      {file.name}
                    </label>
                  ))
                )}
              </fieldset>
            ) : (
              <UnconnectedNotice label="Google Drive" />
            )}

            {options.trello.connected ? (
              <fieldset className="flex flex-col gap-4 rounded-md border border-slate-200 p-4">
                <legend className="px-1 text-sm font-medium">Trello member</legend>
                <p className="text-xs text-slate-500">
                  A contractor can only be a single Trello member in a single Workspace at a time.
                </p>
                {options.trello.error ? (
                  <p className="text-xs text-red-600">{options.trello.error}</p>
                ) : options.trello.workspaces.length === 0 ? (
                  <p className="text-xs text-slate-500">No Workspaces found.</p>
                ) : (
                  options.trello.workspaces.map((workspace) => (
                    <div key={workspace.id} className="flex flex-col gap-1">
                      <p className="text-xs font-medium text-slate-600">{workspace.displayName}</p>
                      {workspace.members.length === 0 ? (
                        <p className="text-xs text-slate-500">No members found.</p>
                      ) : (
                        workspace.members.map((member) => (
                          <label key={member.id} className="flex items-center gap-2 pl-2 text-sm">
                            <input
                              type="radio"
                              name="trello-member"
                              checked={
                                trelloSelection?.organizationId === workspace.id &&
                                trelloSelection?.memberId === member.id
                              }
                              onChange={() =>
                                setTrelloSelection({ organizationId: workspace.id, memberId: member.id })
                              }
                            />
                            {member.fullName} (@{member.username})
                          </label>
                        ))
                      )}
                    </div>
                  ))
                )}
              </fieldset>
            ) : (
              <UnconnectedNotice label="Trello" />
            )}

            {options.notion.connected ? (
              <fieldset className="flex flex-col gap-2 rounded-md border border-slate-200 p-4">
                <legend className="px-1 text-sm font-medium">Notion pages</legend>
                <p className="text-xs text-slate-500">
                  Notion doesn&apos;t support automatic removal &mdash; Tempkey will show you a checklist
                  instead when this contractor&apos;s access ends.
                </p>
                {options.notion.error ? (
                  <p className="text-xs text-red-600">{options.notion.error}</p>
                ) : options.notion.pages.length === 0 ? (
                  <p className="text-xs text-slate-500">No shared pages found.</p>
                ) : (
                  options.notion.pages.map((page) => (
                    <label key={page.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={notionPageIds.includes(page.id)}
                        onChange={() => toggle(notionPageIds, page.id, setNotionPageIds)}
                      />
                      {page.title}
                    </label>
                  ))
                )}
              </fieldset>
            ) : (
              <UnconnectedNotice label="Notion" />
            )}
          </div>
        )}

        {submitError && <p className="text-sm text-red-600">{submitError}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {submitting ? "Adding contractor..." : "Add contractor"}
        </button>
      </form>
    </main>
  );
}

function UnconnectedNotice({ label }: { label: string }) {
  return (
    <p className="text-xs text-slate-500">
      {label} isn&apos;t connected yet &mdash; connect it from the dashboard to grant access here.
    </p>
  );
}
