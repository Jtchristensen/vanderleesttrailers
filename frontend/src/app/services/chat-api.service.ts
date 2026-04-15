import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import type { ChatMessage } from './chat.service';

@Injectable({ providedIn: 'root' })
export class ChatApiService {
  private url = `${environment.apiUrl}/chat`;

  async sendMessage(sessionId: string, messages: ChatMessage[]): Promise<string> {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, messages }),
    });
    if (res.status === 429) throw new Error('rate_limited');
    if (!res.ok)            throw new Error('chat_failed');
    const data = await res.json();
    return data.reply as string;
  }
}
