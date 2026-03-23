import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FaqComponent } from '../../components/faq/faq.component';
import { LoanCalculatorComponent } from '../../components/loan-calculator/loan-calculator.component';
import { ContentService } from '../../services/content.service';

@Component({
  selector: 'app-financing',
  standalone: true,
  imports: [CommonModule, RouterLink, FaqComponent, LoanCalculatorComponent],
  templateUrl: './financing.component.html',
  styleUrls: ['./financing.component.scss'],
})
export class FinancingComponent implements OnInit {
  content: any = {};
  site: any = {};
  loaded = false;

  constructor(private contentService: ContentService) {}

  async ngOnInit() {
    const [content, site] = await Promise.all([
      this.contentService.getContent('FINANCING'),
      this.contentService.getContent('SITE_INFO'),
    ]);
    this.content = content;
    this.site = site;
    this.loaded = true;
  }
}
