export type MomentSource = 'elder' | 'caregiver' | 'nagi';

export interface ElderMoment {
  id: string;
  organization_id: string;
  elder_id: string;
  occurred_on: string;            // 'YYYY-MM-DD'
  kind: string | null;
  body: string;
  is_private: boolean;
  source: MomentSource;
  created_by: string | null;
  created_at: string;
}

export interface CreateMomentInput {
  organization_id: string;
  elder_id: string;
  body: string;
  kind?: string | null;
  occurred_on?: string;            // defaults to today server-side
  is_private?: boolean;
}
