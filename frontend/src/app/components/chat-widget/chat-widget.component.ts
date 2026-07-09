import { Component, ElementRef, ViewChild, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd } from '@angular/router';
import { ChatService, ChatMessage } from '../../services/chat.service';
import { ChatApiService } from '../../services/chat-api.service';
import { TowCheckService } from '../../services/tow-check.service';

const STARTERS = ['Browse inventory', 'Financing options', 'Hours & location'];

@Component({
  selector: 'app-chat-widget',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-widget.component.html',
  styleUrls: ['./chat-widget.component.scss'],
})
export class ChatWidgetComponent {
  @ViewChild('messagesRef') messagesRef?: ElementRef<HTMLDivElement>;

  readonly starters = STARTERS;
  readonly visible = signal(true);
  readonly draft = signal('');
  readonly sending = signal(false);
  readonly error = signal<string | null>(null);

  readonly messages = computed(() => this.chat.messages());
  readonly isOpen  = computed(() => this.chat.isOpen());

  constructor(
    public chat: ChatService,
    private api: ChatApiService,
    private towCheck: TowCheckService,
    private router: Router,
  ) {
    this.visible.set(!router.url.startsWith('/admin'));
    router.events.subscribe(ev => {
      if (ev instanceof NavigationEnd) {
        this.visible.set(!ev.urlAfterRedirects.startsWith('/admin'));
      }
    });
  }

  openPanel() {
    this.chat.open();
    if (this.chat.messages().length === 0) {
      this.chat.appendMessage({
        role: 'assistant',
        content: "Hey there! I'm AI Trailer Man. I can help you find a trailer, check what's in stock, or answer questions about financing. What can I help with?",
      });
    }
  }

  closePanel() { this.chat.close(); }

  useStarter(text: string) {
    this.draft.set(text);
    this.send();
  }

  async send() {
    const text = this.draft().trim();
    if (!text || this.sending()) return;
    this.draft.set('');
    this.error.set(null);
    this.chat.appendMessage({ role: 'user', content: text });
    this.sending.set(true);
    try {
      const reply = await this.api.sendMessage(this.chat.sessionId, this.chat.messagesForSend(), this.towCheck.vehicle());
      this.chat.appendMessage({ role: 'assistant', content: reply });
    } catch (err: any) {
      const msg = err?.message === 'rate_limited'
        ? "You're sending messages very quickly — give it a minute."
        : "I'm having trouble right now. Please try again in a moment.";
      this.chat.appendMessage({ role: 'assistant', content: msg });
      this.error.set(err?.message ?? 'chat_failed');
    } finally {
      this.sending.set(false);
      queueMicrotask(() => this.scrollToBottom());
    }
  }

  private scrollToBottom() {
    const el = this.messagesRef?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }
}
