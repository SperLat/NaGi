export type ActivityKind = 'ai_turn' | 'ui_action' | 'error' | 'offline_ai_unavailable';

export interface ActivityLog {
  id: string;
  elder_id: string;
  organization_id: string;
  kind: ActivityKind;
  payload: Record<string, unknown>;
  client_ts: string;
  server_ts?: string;
  device_id: string;
  /**
   * True when the elder has marked this turn (or its day) as private.
   * Family-facing surfaces show a placeholder instead of substance.
   * Elder-facing AI recall still reads through it — Nagi remembers
   * privately even when the family doesn't.
   */
  is_private: boolean;
}
