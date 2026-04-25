/**
 * Tiny duration formatter — "just now", "14m ago", "3h ago", "2d ago".
 *
 * Lives in lib/ rather than next to a single screen because the dashboard,
 * activity log, team chat, notes journal, and digest all want the same
 * casual-time rendering. Single source of truth = no copy-paste drift.
 */
export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
