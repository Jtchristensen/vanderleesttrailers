import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

export interface ApplicationPayload {
  name: string;
  email: string;
  phone: string;
  message?: string;
  position?: string;
  company?: string; // honeypot — always empty for real users
}

@Injectable({ providedIn: 'root' })
export class CareersService {
  private apiUrl = environment.apiUrl;

  async apply(data: ApplicationPayload): Promise<void> {
    const res = await fetch(`${this.apiUrl}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  }
}
