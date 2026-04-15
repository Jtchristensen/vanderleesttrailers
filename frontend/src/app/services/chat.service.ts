import { Injectable, signal } from '@angular/core';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface Persisted {
  sessionId: string;
  messages: ChatMessage[];
}

const STORAGE_KEY = 'vl_chat_v1';
const MAX_SEND = 20;

function randomSessionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  readonly sessionId: string;
  private readonly _messages = signal<ChatMessage[]>([]);
  private readonly _open = signal(false);

  constructor() {
    const restored = this.loadFromStorage();
    this.sessionId = restored?.sessionId ?? randomSessionId();
    if (restored?.messages?.length) {
      this._messages.set(restored.messages);
    }
  }

  messages(): ChatMessage[]      { return this._messages(); }
  isOpen(): boolean              { return this._open(); }
  open()                          { this._open.set(true); }
  close()                         { this._open.set(false); }
  toggle()                        { this._open.update(v => !v); }

  appendMessage(msg: ChatMessage) {
    this._messages.update(list => [...list, msg]);
    this.persist();
  }

  messagesForSend(): ChatMessage[] {
    const all = this._messages();
    const trimmed = all.length <= MAX_SEND ? all : all.slice(-MAX_SEND);
    // Bedrock Converse requires the first message to be a user turn.
    // Our local greeting is assistant-role for UX only — strip any leading
    // assistant messages so the model sees a valid conversation.
    let start = 0;
    while (start < trimmed.length && trimmed[start].role !== 'user') start++;
    return trimmed.slice(start);
  }

  reset() {
    this._messages.set([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }

  private persist() {
    try {
      const payload: Persisted = { sessionId: this.sessionId, messages: this._messages() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Storage may be unavailable (private browsing). Acceptable to no-op.
    }
  }

  private loadFromStorage(): Persisted | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.sessionId || !Array.isArray(parsed.messages)) return null;
      return parsed;
    } catch {
      return null;
    }
  }
}
