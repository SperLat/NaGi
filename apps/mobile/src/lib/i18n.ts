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
  },
};

/** Returns the string set for the given lang, falling back to English. */
export function useStrings(lang: string | undefined): ElderStrings {
  return strings[(lang as Lang) ?? 'en'] ?? strings.en;
}
