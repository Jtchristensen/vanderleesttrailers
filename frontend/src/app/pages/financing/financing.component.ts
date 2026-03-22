import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FaqComponent } from '../../components/faq/faq.component';
import { FINANCING_CONTENT, SITE_INFO } from '../../data/site-content';

@Component({
  selector: 'app-financing',
  standalone: true,
  imports: [CommonModule, RouterLink, FaqComponent],
  templateUrl: './financing.component.html',
  styleUrls: ['./financing.component.scss'],
})
export class FinancingComponent {
  content = FINANCING_CONTENT;
  site = SITE_INFO;
}
