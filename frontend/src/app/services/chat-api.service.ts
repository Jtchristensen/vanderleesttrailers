import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import type { ChatMessage } from './chat.service';
import type { TowVehicle } from './tow-check.service';

@Injectable({ providedIn: 'root' })
export class ChatApiService {
  private url = `${environment.apiUrl}/chat`;

  /** vehicle: the shopper's saved tow vehicle (if any), so Matt can factor
   * towing fit into recommendations without a dedicated tool round-trip. */
  async sendMessage(sessionId: string, messages: ChatMessage[], vehicle?: TowVehicle | null): Promise<string> {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, messages, vehicle: vehicle ?? null }),
    });
    if (res.status === 429) throw new Error('rate_limited');
    if (!res.ok)            throw new Error('chat_failed');
    const data = await res.json();
    return data.reply as string;
  }
}
