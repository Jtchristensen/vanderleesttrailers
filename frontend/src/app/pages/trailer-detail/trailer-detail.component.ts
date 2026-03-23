import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ContentService } from '../../services/content.service';

@Component({
  selector: 'app-trailer-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './trailer-detail.component.html',
  styleUrls: ['./trailer-detail.component.scss'],
})
export class TrailerDetailComponent implements OnInit {
  trailer: any = null;
  site: any = {};
  loaded = false;
  notFound = false;
  activeImage = 0;

  constructor(private route: ActivatedRoute, private contentService: ContentService) {}

  async ngOnInit() {
    const slug = this.route.snapshot.paramMap.get('slug');
    if (!slug) {
      this.notFound = true;
      this.loaded = true;
      return;
    }

    const [trailer, site] = await Promise.all([
      this.contentService.getTrailer(slug),
      this.contentService.getContent('SITE_INFO'),
    ]);

    if (!trailer) {
      this.notFound = true;
    } else {
      this.trailer = trailer;
    }
    this.site = site;
    this.loaded = true;
  }

  setActiveImage(index: number) {
    this.activeImage = index;
  }

  nextImage() {
    if (this.trailer?.images?.length) {
      this.activeImage = (this.activeImage + 1) % this.trailer.images.length;
    }
  }

  prevImage() {
    if (this.trailer?.images?.length) {
      this.activeImage = (this.activeImage - 1 + this.trailer.images.length) % this.trailer.images.length;
    }
  }
}
