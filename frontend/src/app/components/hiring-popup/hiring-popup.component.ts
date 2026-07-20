import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ContentService } from '../../services/content.service';
import { CareersService } from '../../services/careers.service';

@Component({
  selector: 'app-hiring-popup',
  imports: [FormsModule],
  templateUrl: './hiring-popup.component.html',
  styleUrls: ['./hiring-popup.component.scss'],
})
export class HiringPopupComponent implements OnInit, OnDestroy {
  content: any = ContentService.getContentSync('CAREERS');
  open = false;
  submitting = false;
  submitted = false;
  error = false;

  form = { name: '', email: '', phone: '', message: '', company: '' };

  private static readonly DISMISS_KEY = 'vlt-hiring-dismissed';
  private static readonly APPLIED_KEY = 'vlt-hiring-applied';
  private static readonly AUTO_DELAY_MS = 6000;
  private autoTimer: any = null;

  constructor(private contentService: ContentService, private careers: CareersService) {}

  get enabled(): boolean {
    return !!this.content?.enabled;
  }

  async ngOnInit() {
    try {
      this.content = await this.contentService.getContent('CAREERS');
    } catch {
      // keep the static fallback already in this.content
    }
    if (this.enabled && !this.hasSeen()) {
      this.autoTimer = setTimeout(() => this.openModal(), HiringPopupComponent.AUTO_DELAY_MS);
    }
  }

  ngOnDestroy() {
    if (this.autoTimer) clearTimeout(this.autoTimer);
  }

  private hasSeen(): boolean {
    try {
      return (
        localStorage.getItem(HiringPopupComponent.DISMISS_KEY) === '1' ||
        localStorage.getItem(HiringPopupComponent.APPLIED_KEY) === '1'
      );
    } catch {
      return false;
    }
  }

  private remember(key: string) {
    try {
      localStorage.setItem(key, '1');
    } catch {
      // localStorage unavailable (private mode) — non-fatal
    }
  }

  openModal() {
    if (this.autoTimer) {
      clearTimeout(this.autoTimer);
      this.autoTimer = null;
    }
    this.open = true;
  }

  dismiss() {
    this.open = false;
    this.remember(HiringPopupComponent.DISMISS_KEY);
  }

  @HostListener('document:keydown.escape')
  onEsc() {
    if (this.open && !this.submitting) this.dismiss();
  }

  async submit() {
    if (this.submitting) return;
    this.submitting = true;
    this.error = false;
    try {
      await this.careers.apply({
        name: this.form.name,
        email: this.form.email,
        phone: this.form.phone,
        message: this.form.message,
        company: this.form.company,
        position: this.content?.position || 'General Application',
      });
      this.submitted = true;
      this.remember(HiringPopupComponent.APPLIED_KEY);
    } catch {
      this.error = true;
    } finally {
      this.submitting = false;
    }
  }
}
