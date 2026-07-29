import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

export interface ContactSubmissionPayload {
  name: string;
  email: string;
  phone: string;
  message?: string;
  company?: string; // honeypot — always empty for real users
}

@Injectable({ providedIn: 'root' })
export class ContactFormService {
  private apiUrl = environment.apiUrl;

  async submit(data: ContactSubmissionPayload): Promise<void> {
    const res = await fetch(`${this.apiUrl}/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  }
}
