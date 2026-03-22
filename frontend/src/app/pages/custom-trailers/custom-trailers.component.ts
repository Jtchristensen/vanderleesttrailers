import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CUSTOM_TRAILERS_CONTENT, SITE_INFO } from '../../data/site-content';

@Component({
  selector: 'app-custom-trailers',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './custom-trailers.component.html',
  styleUrls: ['./custom-trailers.component.scss'],
})
export class CustomTrailersComponent {
  content = CUSTOM_TRAILERS_CONTENT;
  site = SITE_INFO;
}
