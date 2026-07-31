import { Component, ElementRef, HostListener, OnInit } from '@angular/core';

/**
 * Scroll-driven "back up, hitch & haul out" animation layered over the home
 * hero: the truck reverses to the parked trailer, the nose drops onto the ball,
 * and the coupled rig pulls out to the left as you keep scrolling.
 *
 * Progress is the fraction of the hero that has scrolled past the top of the
 * viewport, clamped to 0..1 over a range derived from the hero's own height so
 * the rig is gone by the time the hero is. Everything is expressed as CSS
 * custom properties so the browser does the interpolation on the compositor
 * — no per-frame layout, no animation library.
 */
@Component({
    selector: 'app-trailer-rollin',
    imports: [],
    templateUrl: './trailer-rollin.component.html',
    styleUrls: ['./trailer-rollin.component.scss']
})
export class TrailerRollinComponent implements OnInit {
  /** bounds for the px of scroll the whole sequence plays over */
  private static readonly MIN_RANGE = 560;
  private static readonly MAX_RANGE = 900;

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

    // Tie the range to the hero so the rig has pulled out by the time the hero
    // itself has scrolled off — no animating to an empty stage.
    const range = Math.max(
      TrailerRollinComponent.MIN_RANGE,
      Math.min(TrailerRollinComponent.MAX_RANGE, el.offsetHeight * 0.85)
    );

    // Reduced motion parks the whole thing at "hitched" — never at "driven
    // away", which would leave the hero bare.
    const p = this.reduced ? HITCHED : clamp(-el.getBoundingClientRect().top / range);

    // roll: easeInOutCubic across the first half of the scroll (backing up)
    const rt = seg(p, 0, 0.5);
    const roll = rt < 0.5 ? 4 * rt ** 3 : 1 - Math.pow(-2 * rt + 2, 3) / 2;
    const drop = outBack(seg(p, 0.48, 0.62));
    // easeInQuad — distance under constant acceleration, i.e. a rig pulling
    // away from a standstill. Steeper curves park it in place then teleport.
    const away = inQuad(seg(p, 0.7, 1));
    // badge holds through p 0.64..0.78 before the rig takes it with them
    const lock = seg(p, 0.56, 0.64) * (1 - seg(p, 0.78, 0.88));

    const s = this.host.nativeElement.style;
    s.setProperty('--roll', roll.toFixed(4));
    s.setProperty('--drop', drop.toFixed(4));
    s.setProperty('--away', away.toFixed(4));
    s.setProperty('--lock', lock.toFixed(3));
    s.setProperty('--lockScale', (0.9 + outBack(clamp(lock)) * 0.1).toFixed(3));

    // hand the hero its video-dimming ramp (see the .hero__video patch)
    el.style.setProperty('--dim', outCubic(seg(p, 0, 0.4)).toFixed(3));
  }
}

/** progress at which the rig is coupled and the badge is up, before it leaves */
const HITCHED = 0.7;

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
const outCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const inQuad = (t: number) => t * t;
/** easeOutBack — the one bouncy moment in the system (the coupler seating) */
const outBack = (t: number) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);
