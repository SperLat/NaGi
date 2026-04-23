export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatTurn {
  id: string;
  elderId: string;
  messages: ChatMessage[];
  response: string;
  createdAt: string;
}
