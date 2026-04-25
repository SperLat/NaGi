export interface CreateElderInput {
  organization_id: string;
  display_name: string;
  preferred_lang?: string;
}

export interface UpdateElderInput {
  display_name?: string;
  preferred_lang?: string;
  profile?: ElderProfile | Record<string, unknown>;
  ui_config?: ElderUiConfig;
  status?: Elder['status'];
}

/**
 * Structured "About this person" — drives the AI system prompt.
 *
 * Every field is optional so caregivers can fill in what they know and
 * leave the rest. The shape stays narrow on purpose: each field maps
 * cleanly to a line we render into the model's system context. Free-form
 * sprawl belongs in `communication_notes`, not in new fields.
 *
 * Stored in `elders.profile` (jsonb). Backward-compatible: legacy fields
 * (bio/interests/common_tasks) may still appear in older rows and are
 * preserved by the merge in `updateElder`.
 */
export interface ElderProfile {
  preferred_name?: string;
  spoken_languages?: string[];
  topics_they_enjoy?: string[];
  topics_to_avoid?: string[];
  communication_notes?: string;
  accessibility_notes?: string;
  emergency_contact?: { name: string; phone: string; relation: string };
}

export interface ElderUiConfig {
  home_cards?: string[];
  offline_message?: string;
  text_size?: 'lg' | 'xl' | '2xl';
  high_contrast?: boolean;
  voice_input?: boolean;
}

export interface ElderIntermediary {
  user_id: string;
  email: string;
  relation: string | null;
  created_at: string;
  accepted_at: string | null;
}

export interface PendingInvitation {
  elder_id: string;
  elder_name: string;
  org_name: string;
  inviter_email: string;
  relation: string | null;
  created_at: string;
}

export type InviteIntermediaryResult =
  | { status: 'added'; user_id: string }
  | { status: 'not_joined' }
  | { status: 'error'; message: string };

export interface Elder {
  id: string;
  organization_id: string;
  display_name: string;
  preferred_lang: string;
  profile: Record<string, unknown>;
  profile_version: number;
  ui_config: ElderUiConfig;
  status: 'active' | 'paused' | 'archived';
  created_at: string;
  updated_at: string;
}
