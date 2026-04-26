export type ConnectionStatus = 'pending' | 'active' | 'paused' | 'declined';

export interface ElderConnection {
  id: string;
  elder_a_id: string;
  elder_b_id: string;
  proposed_by: string;
  proposed_at: string;
  accepted_by: string | null;
  accepted_at: string | null;
  status: ConnectionStatus;
}

/** Per-caller view of a pending invite — returned by list_my_pending_elder_connections RPC. */
export interface PendingElderConnection {
  connection_id: string;
  my_elder_id: string;
  my_elder_name: string;
  other_elder_id: string;
  other_elder_name: string;
  proposed_at: string;
  proposer_email: string;
}
