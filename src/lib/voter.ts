// Browser-side voter fingerprint. Persisted in localStorage as a random UUID.
// Server functions read this via the request body — we don't set a server cookie
// because that would tie voting identity to first-party origins only.

const KEY = "mesc_voter_id";

export function getVoterId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(KEY, id);
  }
  return id;
}

export const MAX_VOTES_PER_ATTENDEE = 5;
