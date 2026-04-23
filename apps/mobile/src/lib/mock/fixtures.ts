export const MOCK_ORG_ID = 'org-demo-0001';
export const MOCK_USER_ID = 'user-demo-0001';

export const MOCK_USER = {
  id: MOCK_USER_ID,
  email: 'mock-intermediary@local',
  created_at: '2026-04-22T00:00:00Z',
};

const MOCK_ORG = {
  id: MOCK_ORG_ID,
  name: 'Familia Demo',
  kind: 'family',
  created_at: '2026-04-22T00:00:00Z',
};

const MOCK_ELDERS = [
  {
    id: 'elder-demo-0001',
    organization_id: MOCK_ORG_ID,
    display_name: 'Abuela Rosa',
    preferred_lang: 'es',
    profile: {
      bio: 'Profesora jubilada. Le gusta el jardín y las telenovelas.',
      interests: ['jardinería', 'familia', 'telenovelas'],
      common_tasks: ['llamar familia', 'ver el clima'],
    },
    profile_version: 1,
    ui_config: {
      home_cards: ['call_family', 'get_help', 'my_day', 'one_task'],
      offline_message: 'Estoy aquí contigo. Llama a tu hija si necesitas ayuda.',
      text_size: 'xl',
      high_contrast: false,
      voice_input: true,
    },
    status: 'active',
    created_at: '2026-04-22T00:00:00Z',
    updated_at: '2026-04-22T00:00:00Z',
  },
  {
    id: 'elder-demo-0002',
    organization_id: MOCK_ORG_ID,
    display_name: 'Grandma Helen',
    preferred_lang: 'en',
    profile: {
      bio: 'Retired teacher. Loves gardening and calling her grandchildren.',
      interests: ['gardening', 'family', 'crosswords'],
      common_tasks: ['call family', 'check the weather'],
    },
    profile_version: 1,
    ui_config: {
      home_cards: ['call_family', 'get_help', 'my_day', 'one_task'],
      offline_message: 'I cannot respond right now. Please call your family if you need help.',
      text_size: 'xl',
      high_contrast: false,
      voice_input: true,
    },
    status: 'active',
    created_at: '2026-04-22T00:00:00Z',
    updated_at: '2026-04-22T00:00:00Z',
  },
  {
    id: 'elder-demo-0003',
    organization_id: MOCK_ORG_ID,
    display_name: 'Vovó Beatriz',
    preferred_lang: 'pt',
    profile: {
      bio: 'Professora aposentada. Gosta de flores e conversar com a família.',
      interests: ['flores', 'família', 'novelas'],
      common_tasks: ['ligar família', 'ver o tempo'],
    },
    profile_version: 1,
    ui_config: {
      home_cards: ['call_family', 'get_help', 'my_day', 'one_task'],
      offline_message: 'Não consigo responder agora. Por favor, ligue para sua família se precisar de ajuda.',
      text_size: 'xl',
      high_contrast: false,
      voice_input: true,
    },
    status: 'active',
    created_at: '2026-04-22T00:00:00Z',
    updated_at: '2026-04-22T00:00:00Z',
  },
];

const MOCK_ORG_MEMBERS = [
  {
    organization_id: MOCK_ORG_ID,
    user_id: MOCK_USER_ID,
    role: 'admin',
    created_at: '2026-04-22T00:00:00Z',
  },
];

const MOCK_ELDER_INTERMEDIARIES = [
  {
    elder_id: 'elder-demo-0001',
    user_id: MOCK_USER_ID,
    relation: 'hija',
    created_at: '2026-04-22T00:00:00Z',
  },
  {
    elder_id: 'elder-demo-0002',
    user_id: MOCK_USER_ID,
    relation: 'daughter',
    created_at: '2026-04-22T00:00:00Z',
  },
  {
    elder_id: 'elder-demo-0003',
    user_id: MOCK_USER_ID,
    relation: 'filha',
    created_at: '2026-04-22T00:00:00Z',
  },
];

// Keyed by table name — passed to MockDb.seed() at startup.
export const MOCK_SEED = {
  organizations: [MOCK_ORG],
  organization_members: MOCK_ORG_MEMBERS,
  elders: MOCK_ELDERS,
  elder_intermediaries: MOCK_ELDER_INTERMEDIARIES,
  activity_log: [],
  ai_interactions: [],
};
