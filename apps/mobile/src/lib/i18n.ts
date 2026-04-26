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
    call_family:   { label: string; prime: string; welcome: string };
    get_help:      { label: string; prime: string; welcome: string };
    my_day:        { label: string; prime: string; welcome: string };
    one_task:      { label: string; prime: string; welcome: string };
    pastimes:      { label: string; prime: string; welcome: string };
    proud_moments: { label: string; prime: string; welcome: string };
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
  // Pill reminders — kiosk pill on home and the reminder event screen.
  // Brand stance: invitation, not nag. "Did you take it?" not "Don't forget!".
  pillReminderHome:     (label: string) => string;
  pillReminderTitle:    string;          // screen heading: "Hora de tu pastilla"
  pillReminderQuestion: string;          // "¿Tomaste tu pastilla?"
  pillTookIt:           string;          // primary green button — "Tomé"
  pillLater:            string;          // snooze 10m button — "Más tarde"
  pillSkipped:          string;          // accept-warmly button — "Salté hoy"
  pillSnoozed:          (mins: number) => string;
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
      call_family: { label: 'Llamar familia',  prime: 'Quiero llamar a alguien.', welcome: 'Cuéntame a quién quieres llamar.' },
      get_help:    { label: 'Necesito ayuda',  prime: 'Necesito ayuda, por favor.', welcome: '¿En qué te puedo ayudar?' },
      my_day:      { label: 'Mi día',          prime: '¿Qué hay hoy?', welcome: 'Veamos qué trae el día.' },
      one_task:    { label: 'Una tarea',        prime: 'Ayúdame con una tarea.', welcome: 'Cuéntame qué tienes en mente.' },
      pastimes:    { label: 'Para disfrutar',  prime: 'Quiero hacer algo agradable. Mira mis topics_they_enjoy y propón con calidez una o dos opciones, en tono de invitación: "¿Te gustaría...?". Si digo que no, acéptalo con cariño y sin insistir.', welcome: 'Vamos a buscar algo agradable que te apetezca hacer.' },
      proud_moments: { label: 'Cuéntame', prime: 'Estoy aquí cuando quieras contarme algo lindo del día. Abre con calidez, sin interrogar — algo como "Estoy aquí cuando quieras contarme algo. ¿Cómo va el día?". Escucha. Si surge un momento concreto que valga la pena recordar (un paseo, una visita, una comida, un recuerdo), llama a la herramienta record_moment con un body en mis palabras y un kind sensato. Si no surge nada, eso también está bien — acepta el silencio con calidez, sin presionar.', welcome: 'Comparte conmigo algo lindo de hoy que quieras celebrar.' },
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
    pillReminderHome:     (label) => `💊 Hora de tu pastilla: ${label}`,
    pillReminderTitle:    'Hora de tu pastilla',
    pillReminderQuestion: '¿La tomaste?',
    pillTookIt:           'Sí, la tomé',
    pillLater:            'En un ratito',
    pillSkipped:          'Hoy no',
    pillSnoozed:          (m) => `Te recuerdo en ${m} minutos.`,
  },

  pt: {
    greeting:        (n) => `Olá, ${n}`,
    subtitle:        'O que você precisa hoje?',
    preparedBy:      (n) => `Preparado por ${n}.`,
    companion:       'seu acompanhante',
    needHelp:        'Preciso de Ajuda',
    urgentHelpPrime: 'Preciso de ajuda urgente.',
    cards: {
      call_family: { label: 'Ligar família',   prime: 'Quero ligar para alguém.', welcome: 'Me conta para quem você quer ligar.' },
      get_help:    { label: 'Preciso de ajuda', prime: 'Preciso de ajuda, por favor.', welcome: 'Em que posso te ajudar?' },
      my_day:      { label: 'Meu dia',          prime: 'O que tem hoje?', welcome: 'Vamos ver o que o dia traz.' },
      one_task:    { label: 'Uma tarefa',        prime: 'Me ajude com uma tarefa.', welcome: 'Me conta o que você tem em mente.' },
      pastimes:    { label: 'Para desfrutar',   prime: 'Quero fazer algo agradável. Olhe meus topics_they_enjoy e proponha com carinho uma ou duas opções, em tom de convite: "Você gostaria...?". Se eu disser não, aceite com carinho e sem insistir.', welcome: 'Vamos achar algo gostoso para fazer.' },
      proud_moments: { label: 'Me conta', prime: 'Estou aqui quando você quiser me contar algo bonito do dia. Abra com carinho, sem interrogar — algo como "Estou aqui quando você quiser me contar algo. Como está o dia?". Escute. Se surgir um momento concreto que valha a pena lembrar (um passeio, uma visita, uma refeição, uma memória), chame a ferramenta record_moment com um body nas minhas palavras e um kind sensato. Se nada surgir, tudo bem — aceite o silêncio com carinho, sem pressionar.', welcome: 'Me conta algo bonito de hoje que você queira celebrar.' },
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
    pillReminderHome:     (label) => `💊 Hora do seu remédio: ${label}`,
    pillReminderTitle:    'Hora do seu remédio',
    pillReminderQuestion: 'Você tomou?',
    pillTookIt:           'Sim, tomei',
    pillLater:            'Daqui a pouco',
    pillSkipped:          'Hoje não',
    pillSnoozed:          (m) => `Te lembro em ${m} minutos.`,
  },

  en: {
    greeting:        (n) => `Hello, ${n}`,
    subtitle:        'What do you need today?',
    preparedBy:      (n) => `Set up by ${n}.`,
    companion:       'your companion',
    needHelp:        'I Need Help',
    urgentHelpPrime: 'I need urgent help.',
    cards: {
      call_family: { label: 'Call family',  prime: 'I want to call someone.', welcome: 'Tell me who you would like to call.' },
      get_help:    { label: 'I need help',  prime: 'I need help, please.', welcome: 'How can I help you today?' },
      my_day:      { label: 'My day',       prime: 'What is going on today?', welcome: "Let's see what today brings." },
      one_task:    { label: 'A task',       prime: 'Help me with a task.', welcome: "Tell me what's on your mind." },
      pastimes:    { label: 'To enjoy',     prime: 'I would like to do something pleasant. Look at my topics_they_enjoy and warmly propose one or two options, as an invitation: "Would you like to...?". If I say no, accept it warmly and do not insist.', welcome: "Let's find something nice for you to enjoy." },
      proud_moments: { label: 'Tell me', prime: "I'm here whenever you'd like to share something lovely from your day. Open warmly, without interrogating — something like \"I'm here when you want to tell me something. How is the day?\". Listen. If a concrete moment worth remembering surfaces (a walk, a visit, a meal, a memory), call the record_moment tool with a body in my own words and a sensible kind. If nothing surfaces, that's fine too — accept silence warmly, without pressing.", welcome: "Share with me something lovely from today you'd like to celebrate." },
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
    pillReminderHome:     (label) => `💊 Time for your pill: ${label}`,
    pillReminderTitle:    'Time for your pill',
    pillReminderQuestion: 'Did you take it?',
    pillTookIt:           'Yes, I took it',
    pillLater:            'In a little while',
    pillSkipped:          'Not today',
    pillSnoozed:          (m) => `I'll remind you in ${m} minutes.`,
  },
};

/** Returns the string set for the given lang, falling back to English. */
export function useStrings(lang: string | undefined): ElderStrings {
  return strings[(lang as Lang) ?? 'en'] ?? strings.en;
}
