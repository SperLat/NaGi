// Canned AI responses for mock mode. Real implementation lives in the
// ai-chat edge function — this is a demo surface only.
// Each intent has a response for every supported language so mock mode
// correctly reflects the elder's preferred_lang selection.

type AiIntent = 'greeting' | 'confused' | 'call_family' | 'weather' | 'task_help' | 'fallback';
type Lang = 'es' | 'pt' | 'en';

const RESPONSES: Record<AiIntent, Record<Lang, string>> = {
  greeting: {
    es: '¡Hola! Estoy aquí para ayudarte. ¿Qué necesitas hoy?',
    pt: 'Olá! Estou aqui para ajudar. O que você precisa hoje?',
    en: 'Hello. I am right here with you. What do you need today?',
  },
  confused: {
    es: 'No te preocupes, eso le pasa a todos. Vamos paso a paso. ¿Quieres que llamemos a tu familia?',
    pt: 'Não se preocupe, isso acontece com todos. Vamos passo a passo. Quer que eu ligue para sua família?',
    en: 'That is perfectly alright — everyone has moments like that. We will take it one small step at a time. Do you want to call your family?',
  },
  call_family: {
    es: 'Claro, te ayudo a llamar. ¿A quién quieres llamar primero?',
    pt: 'Claro, vou te ajudar a ligar. Para quem você quer ligar primeiro?',
    en: 'Of course. Who would you like to call first?',
  },
  weather: {
    es: 'Hoy el clima está agradable. Bueno para salir al jardín un rato.',
    pt: 'O tempo hoje está agradável. Bom para sair ao jardim um pouco.',
    en: 'It is a lovely day. A nice time to step outside if you feel like it.',
  },
  task_help: {
    es: 'Podemos hacer esto juntos. ¿Empezamos con el primer paso?',
    pt: 'Podemos fazer isso juntos. Vamos começar com o primeiro passo?',
    en: 'We can do this together, no rush. Let us start with one small step — are you ready?',
  },
  fallback: {
    es: 'Entendí. Si prefieres, puedes tocar el botón rojo para llamar a tu familia.',
    pt: 'Entendi. Se preferir, você pode tocar o botão vermelho para ligar para sua família.',
    en: 'I hear you. If you need someone right now, you can always tap the red button.',
  },
};

export function detectIntent(message: string): AiIntent {
  const m = message.toLowerCase();
  if (
    m.includes('hola') || m.includes('buenos') || m.includes('buenas') ||
    m.includes('hello') || m.includes('hi') ||
    m.includes('olá') || m.includes('oi')
  ) return 'greeting';
  if (
    m.includes('no entiendo') || m.includes('confundi') || m.includes('perdid') ||
    m.includes('confused') || m.includes("don't understand") ||
    m.includes('confuso') || m.includes('não entendo')
  ) return 'confused';
  if (
    m.includes('llam') || m.includes('hablar') ||
    m.includes('call') || m.includes('phone') ||
    m.includes('ligar') || m.includes('telefonar')
  ) return 'call_family';
  if (
    m.includes('clima') || m.includes('tiempo') || m.includes('lluev') ||
    m.includes('weather') || m.includes('rain') || m.includes('sunny') ||
    m.includes('tempo') || m.includes('chuv')
  ) return 'weather';
  if (
    m.includes('ayuda') || m.includes('cómo') || m.includes('como') ||
    m.includes('help') || m.includes('how') ||
    m.includes('ajuda') || m.includes('como faço')
  ) return 'task_help';
  return 'fallback';
}

/** Returns a canned response in the elder's language. Defaults to Spanish. */
export function getMockAiResponse(message: string, lang: Lang = 'es'): string {
  const intent = detectIntent(message);
  const L: Lang = lang === 'es' || lang === 'pt' || lang === 'en' ? lang : 'en';
  return RESPONSES[intent][L];
}
