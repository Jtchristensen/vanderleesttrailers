import { Component, OnInit, HostListener } from '@angular/core';

import { TowCheckComponent } from '../../components/tow-check/tow-check.component';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ContentService } from '../../services/content.service';

@Component({
    selector: 'app-trailer-detail',
    imports: [RouterLink, TowCheckComponent],
    templateUrl: './trailer-detail.component.html',
    styleUrls: ['./trailer-detail.component.scss']
})
export class TrailerDetailComponent implements OnInit {
  trailer: any = null;
  site: any = ContentService.getContentSync('SITE_INFO');
  loaded = false;
  notFound = false;
  activeImage = 0;
  lightboxOpen = false;

  constructor(private route: ActivatedRoute, private contentService: ContentService) {}

  openLightbox() {
    if (!this.trailer?.images?.length) return;
    this.lightboxOpen = true;
    document.body.style.overflow = 'hidden';
  }

  closeLightbox() {
    this.lightboxOpen = false;
    document.body.style.overflow = '';
  }

  @HostListener('window:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    if (!this.lightboxOpen) return;
    if (e.key === 'Escape') this.closeLightbox();
    else if (e.key === 'ArrowRight') this.nextImage();
    else if (e.key === 'ArrowLeft') this.prevImage();
  }

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
