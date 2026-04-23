export interface CreateElderInput {
  organization_id: string;
  display_name: string;
  preferred_lang?: string;
}

export interface UpdateElderInput {
  display_name?: string;
  preferred_lang?: string;
  profile?: Record<string, unknown>;
  ui_config?: ElderUiConfig;
  status?: Elder['status'];
}

export interface ElderUiConfig {
  home_cards?: string[];
  offline_message?: string;
  text_size?: 'lg' | 'xl' | '2xl';
  high_contrast?: boolean;
  voice_input?: boolean;
}

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
