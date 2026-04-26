// Elder-facing UI strings, keyed by preferred_lang.
// Rule: NOTHING in the elder UI is hardcoded in any language.
// Add a new language by adding a key here — no other files need changing.

export type Lang = 'es' | 'pt' | 'en';

export interface ElderStrings {
  // Home screen
  greeting:       (firstName: string) => string;
  subtitle:       string;
  preparedBy:     (name: string) => string;
  companion:      string;           // fallback when intermediary name is unknown
  needHelp:       string;
  urgentHelpPrime: string;
  cards: {
    call_family: { label: string; prime: string };
    get_help:    { label: string; prime: string };
    my_day:      { label: string; prime: string };
    one_task:    { label: string; prime: string };
  };
  // Welcome screen
  welcomePrepared: (name: string | undefined) => string;
  start:           string;
  // Chat screen
  voiceOn:        string;
  voiceOff:       string;
  listening:      string;
  waitingVoice:   string;
  nagiSpeaking:   string;
  typeHere:       string;
  orTypeHere:     string;
  stop:           string;
  speak:          string;
  replay:         string;
  offlineMessage: string;
  // Empty chat state — first-time or no-history case
  chatEmptyTitle:    (firstName: string) => string;
  chatEmptySubtitle: string;
  // Privacy pill — daily share toggle
  privacyShared:        string;   // pill state when today's chat is visible to family
  privacyHidden:        string;   // pill state when today's chat is hidden from family
  privacyHideTitle:     string;   // confirmation modal title
  privacyHideMessage:   string;   // confirmation modal body when hiding
  privacyShareMessage:  string;   // confirmation modal body when re-sharing
  privacyConfirmHide:   string;
  privacyConfirmShare:  string;
  privacyCancel:        string;
}

const strings: Record<Lang, ElderStrings> = {
  es: {
    greeting:        (n) => `Hola, ${n}`,
    subtitle:        '¿Qué necesitas hoy?',
    preparedBy:      (n) => `Preparado por ${n}.`,
    companion:       'tu acompañante',
    needHelp:        'Necesito Ayuda',
    urgentHelpPrime: 'Necesito ayuda urgente.',
    cards: {
      call_family: { label: 'Llamar familia',  prime: 'Quiero llamar a alguien.' },
      get_help:    { label: 'Necesito ayuda',  prime: 'Necesito ayuda, por favor.' },
      my_day:      { label: 'Mi día',          prime: '¿Qué hay hoy?' },
      one_task:    { label: 'Una tarea',        prime: 'Ayúdame con una tarea.' },
    },
    welcomePrepared: (n) => n ? `${n} preparó esto para ti.` : 'Alguien preparó esto para ti.',
    start:           'Empezar',
    voiceOn:        'Voz ON',
    voiceOff:       'Voz OFF',
    listening:      'Escuchando…',
    waitingVoice:   'Esperando voz…',
    nagiSpeaking:   'Nagi está hablando…',
    typeHere:       'Escribe aquí…',
    orTypeHere:     'O escribe aquí…',
    stop:           'Detener',
    speak:          'Hablar',
    replay:         '▶ Repetir',
    offlineMessage: 'Ahora mismo no puedo responder. Llama a tu familia si necesitas ayuda.',
    chatEmptyTitle:    (n) => `Hola, ${n}.`,
    chatEmptySubtitle: 'Soy Nagi. Aquí estoy. ¿De qué te gustaría hablar?',
    privacyShared:        'Hoy se comparte con tu familia',
    privacyHidden:        'Hoy queda solo entre nosotros',
    privacyHideTitle:     '¿Ocultar la conversación de hoy?',
    privacyHideMessage:   'Tu familia verá que hablaste conmigo hoy, pero no lo que dijimos.',
    privacyShareMessage:  '¿Volver a compartir la conversación de hoy con tu familia?',
    privacyConfirmHide:   'Sí, mantener privado',
    privacyConfirmShare:  'Sí, compartir',
    privacyCancel:        'Cancelar',
  },

  pt: {
    greeting:        (n) => `Olá, ${n}`,
    subtitle:        'O que você precisa hoje?',
    preparedBy:      (n) => `Preparado por ${n}.`,
    companion:       'seu acompanhante',
    needHelp:        'Preciso de Ajuda',
    urgentHelpPrime: 'Preciso de ajuda urgente.',
    cards: {
      call_family: { label: 'Ligar família',   prime: 'Quero ligar para alguém.' },
      get_help:    { label: 'Preciso de ajuda', prime: 'Preciso de ajuda, por favor.' },
      my_day:      { label: 'Meu dia',          prime: 'O que tem hoje?' },
      one_task:    { label: 'Uma tarefa',        prime: 'Me ajude com uma tarefa.' },
    },
    welcomePrepared: (n) => n ? `${n} preparou isso para você.` : 'Alguém preparou isso para você.',
    start:           'Começar',
    voiceOn:        'Voz ON',
    voiceOff:       'Voz OFF',
    listening:      'Ouvindo…',
    waitingVoice:   'Aguardando voz…',
    nagiSpeaking:   'Nagi está falando…',
    typeHere:       'Escreva aqui…',
    orTypeHere:     'Ou escreva aqui…',
    stop:           'Parar',
    speak:          'Falar',
    replay:         '▶ Repetir',
    offlineMessage: 'Não consigo responder agora. Ligue para sua família se precisar de ajuda.',
    chatEmptyTitle:    (n) => `Olá, ${n}.`,
    chatEmptySubtitle: 'Sou o Nagi. Estou aqui. Sobre o que você gostaria de conversar?',
    privacyShared:        'Hoje é compartilhado com sua família',
    privacyHidden:        'Hoje fica só entre nós',
    privacyHideTitle:     'Ocultar a conversa de hoje?',
    privacyHideMessage:   'Sua família verá que você falou comigo hoje, mas não o que dissemos.',
    privacyShareMessage:  'Voltar a compartilhar a conversa de hoje com sua família?',
    privacyConfirmHide:   'Sim, manter privado',
    privacyConfirmShare:  'Sim, compartilhar',
    privacyCancel:        'Cancelar',
  },

  en: {
    greeting:        (n) => `Hello, ${n}`,
    subtitle:        'What do you need today?',
    preparedBy:      (n) => `Set up by ${n}.`,
    companion:       'your companion',
    needHelp:        'I Need Help',
    urgentHelpPrime: 'I need urgent help.',
    cards: {
      call_family: { label: 'Call family',  prime: 'I want to call someone.' },
      get_help:    { label: 'I need help',  prime: 'I need help, please.' },
      my_day:      { label: 'My day',       prime: 'What is going on today?' },
      one_task:    { label: 'A task',       prime: 'Help me with a task.' },
    },
    welcomePrepared: (n) => n ? `${n} set this up for you.` : 'Someone set this up for you.',
    start:           'Start',
    voiceOn:        'Voice ON',
    voiceOff:       'Voice OFF',
    listening:      'Listening…',
    waitingVoice:   'Waiting for voice…',
    nagiSpeaking:   'Nagi is speaking…',
    typeHere:       'Type here…',
    orTypeHere:     'Or type here…',
    stop:           'Stop',
    speak:          'Speak',
    replay:         '▶ Replay',
    offlineMessage: 'I cannot respond right now. Call your family if you need help.',
    chatEmptyTitle:    (n) => `Hello, ${n}.`,
    chatEmptySubtitle: "I'm Nagi. I'm here. What would you like to talk about?",
    privacyShared:        "Today is shared with your family",
    privacyHidden:        "Today stays just between us",
    privacyHideTitle:     "Hide today's conversation?",
    privacyHideMessage:   "Your family will see that you talked with me today, but not what we said.",
    privacyShareMessage:  "Share today's conversation with your family again?",
    privacyConfirmHide:   "Yes, keep private",
    privacyConfirmShare:  "Yes, share",
    privacyCancel:        "Cancel",
  },
};

/** Returns the string set for the given lang, falling back to English. */
export function useStrings(lang: string | undefined): ElderStrings {
  return strings[(lang as Lang) ?? 'en'] ?? strings.en;
}
