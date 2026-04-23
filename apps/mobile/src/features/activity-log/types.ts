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
}
