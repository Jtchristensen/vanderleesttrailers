import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FAQ_CONTENT, IMAGES } from '../../data/site-content';

@Component({
  selector: 'app-faq',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './faq.component.html',
  styleUrls: ['./faq.component.scss'],
})
export class FaqComponent {
  faqs = FAQ_CONTENT;
  bgImage = IMAGES.hero.faq;
  openIndex: number | null = null;

  toggle(index: number) {
    this.openIndex = this.openIndex === index ? null : index;
  }
}
