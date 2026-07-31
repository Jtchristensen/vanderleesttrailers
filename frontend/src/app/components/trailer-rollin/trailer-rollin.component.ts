import { AfterViewInit, Component, ElementRef, HostListener, OnInit } from '@angular/core';

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
export class TrailerRollinComponent implements OnInit, AfterViewInit {
  /** bounds for the px of scroll the whole sequence plays over */
  private static readonly MIN_RANGE = 560;
  private static readonly MAX_RANGE = 900;

  private reduced = false;

  constructor(private host: ElementRef<HTMLElement>) {}

  ngOnInit(): void {
    this.reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }

  ngAfterViewInit(): void {
    this.measure();
    this.update();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.measure();
    this.update();
  }

  /**
   * Geometry that depends on the viewport, not on scroll — so it is read here
   * on resize rather than in update(), which runs on every scroll event.
   *
   * The SVG is letterboxed (preserveAspectRatio="meet"), so shrinking it does
   * not just make the rig smaller: it widens how much of the user-coordinate
   * space is on screen either side of the 1000-unit viewBox. Distances that
   * have to reach off-screen therefore can't be constants.
   */
  private measure(): void {
    const box = this.host.nativeElement.querySelector<HTMLElement>('.rollin');
    if (!box) return;

    const w = box.clientWidth;
    const scale = Math.min(w / 1000, box.clientHeight / 380);
    if (!(scale > 0)) return;

    // user units visible beyond each side of the viewBox
    const overhang = (w / scale - 1000) / 2;

    const s = this.host.nativeElement.style;
    // Far enough for the rig's tail (x ~950 including the draft streaks) to
    // clear the visible edge. Shared by the approach and the pull-out: the
    // truck alone needs less, and starting further out costs nothing.
    s.setProperty('--rigTravel', Math.round(950 + overhang + 60).toString());
    // Keeps the badge on the coupler (x=362) — as the overhang grows, the
    // centred viewBox content drifts toward the middle of the screen.
    s.setProperty('--couplerX', `${((362 + overhang) / (1000 + 2 * overhang)) * 100}%`);
  }

  @HostListener('window:scroll')
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
