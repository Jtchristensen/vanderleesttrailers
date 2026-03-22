import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CONTACT_CONTENT, SITE_INFO } from '../../data/site-content';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.scss'],
})
export class ContactComponent {
  content = CONTACT_CONTENT;
  site = SITE_INFO;

  formData = {
    name: '',
    phone: '',
    email: '',
    message: '',
  };

  isSubmitted = false;
  isSubmitting = false;

  onSubmit() {
    this.isSubmitting = true;
    // Simulate form submission - replace with actual API call
    setTimeout(() => {
      this.isSubmitting = false;
      this.isSubmitted = true;
      this.formData = { name: '', phone: '', email: '', message: '' };
    }, 1000);
  }
}
