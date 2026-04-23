export interface HelpRequest {
  id: string;
  elder_id: string;
  organization_id: string;
  status: 'pending' | 'acknowledged';
  created_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  // Joined from elders table when listed
  elder_name?: string;
}
