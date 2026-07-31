import { Component, ElementRef, HostListener, OnInit } from '@angular/core';

/**
 * Scroll-driven "back up & hitch" animation layered over the home hero: the
 * truck reverses to the parked trailer, whose nose then drops onto the ball.
 *
 * Progress is the fraction of the hero that has scrolled past the top of the
 * viewport, clamped to 0..1 over PROGRESS_RANGE px. Everything is expressed as
 * CSS custom properties so the browser does the interpolation on the compositor
 * — no per-frame layout, no animation library.
 */
@Component({
    selector: 'app-trailer-rollin',
    imports: [],
    templateUrl: './trailer-rollin.component.html',
    styleUrls: ['./trailer-rollin.component.scss']
})
export class TrailerRollinComponent implements OnInit {
  /** px of scroll over which the whole sequence plays */
  private static readonly PROGRESS_RANGE = 760;

  private reduced = false;

  constructor(private host: ElementRef<HTMLElement>) {}

  ngOnInit(): void {
    this.reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    this.update();
  }

  @HostListener('window:scroll')
  @HostListener('window:resize')
  update(): void {
    const el = this.host.nativeElement.parentElement; // the .hero section
    if (!el) return;

    const p = this.reduced
      ? 1
      : clamp(-el.getBoundingClientRect().top / TrailerRollinComponent.PROGRESS_RANGE);

    // roll: easeInOutCubic across the first 70% of the scroll (the truck backing up)
    const rt = seg(p, 0, 0.7);
    const roll = rt < 0.5 ? 4 * rt ** 3 : 1 - Math.pow(-2 * rt + 2, 3) / 2;
    const drop = outBack(seg(p, 0.68, 0.86));
    const lock = seg(p, 0.84, 0.96);

    const s = this.host.nativeElement.style;
    s.setProperty('--roll', roll.toFixed(4));
    s.setProperty('--drop', drop.toFixed(4));
    s.setProperty('--lock', lock.toFixed(3));
    s.setProperty('--lockScale', (0.9 + outBack(lock) * 0.1).toFixed(3));

    // hand the hero its video-dimming ramp (see the .hero__video patch)
    el.style.setProperty('--dim', outCubic(seg(p, 0, 0.5)).toFixed(3));
  }
}

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
const outCubic = (t: number) => 1 - Math.pow(1 - t, 3);
/** easeOutBack — the one bouncy moment in the system (the coupler seating) */
const outBack = (t: number) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);
