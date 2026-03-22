import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FaqComponent } from '../../components/faq/faq.component';
import { SERVICES_CONTENT, SITE_INFO } from '../../data/site-content';

@Component({
  selector: 'app-services',
  standalone: true,
  imports: [CommonModule, RouterLink, FaqComponent],
  templateUrl: './services.component.html',
  styleUrls: ['./services.component.scss'],
})
export class ServicesComponent {
  content = SERVICES_CONTENT;
  site = SITE_INFO;
}
