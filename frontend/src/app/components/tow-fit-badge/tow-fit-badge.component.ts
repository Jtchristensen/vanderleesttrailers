import { Component, Input } from '@angular/core';

import { TowCheckService, TowResult, TowVerdict } from '../../services/tow-check.service';

type BadgeState = TowVerdict | 'unknown';

/** Small "does this trailer fit my truck?" pill for use on trailer cards
 * (inventory, compare, favorites, trailer detail). Renders nothing until the
 * shopper has picked a tow vehicle via TowCheckService — see app-tow-fit-bar
 * for the vehicle picker that drives it. */
@Component({
    selector: 'app-tow-fit-badge',
    imports: [],
    templateUrl: './tow-fit-badge.component.html',
    styleUrls: ['./tow-fit-badge.component.scss']
})
export class TowFitBadgeComponent {
  @Input() trailer: any;
  /** Short generic label (no vehicle name) for tight spaces like the compare table cells. */
  @Input() compact = false;

  constructor(public towCheck: TowCheckService) {}

  get vehicleName(): string | null {
    return this.towCheck.vehicle()?.name ?? null;
  }

  get result(): TowResult | null {
    return this.towCheck.check(this.trailer?.gvwr);
  }

  /** null when no vehicle is selected — the badge stays hidden in that case. */
  get state(): BadgeState | null {
    if (!this.towCheck.vehicle()) return null;
    return this.result?.verdict ?? 'unknown';
  }

  get label(): string {
    if (this.compact) {
      switch (this.state) {
        case 'safe':    return 'Fits';
        case 'caution': return 'Close';
        case 'over':     return 'Over';
        case 'unknown':  return 'Unknown';
        default:         return '';
      }
    }
    switch (this.state) {
      case 'safe':    return `Fits your ${this.vehicleName}`;
      case 'caution': return 'Close to your limit';
      case 'over':     return "Over your truck's rating";
      case 'unknown':  return 'Fit unknown';
      default:         return '';
    }
  }

  get detail(): string {
    const r = this.result;
    const vehicle = this.vehicleName;
    switch (this.state) {
      case 'safe':
        return `This trailer's fully-loaded weight (GVWR ${r!.gvwr.toLocaleString()} lb) is under 80% of your ${vehicle}'s ${r!.capacity.toLocaleString()} lb tow rating — a comfortable margin for cargo, hills, and wind.`;
      case 'caution':
        return `This trailer is within your ${vehicle}'s rating but uses ${Math.round(r!.ratio * 100)}% of it, leaving little buffer for passengers, cargo, hills, or wind. Confirm your exact rating before towing at max load.`;
      case 'over':
        return `This trailer's loaded weight (GVWR ${r!.gvwr.toLocaleString()} lb) is more than your ${vehicle}'s ${r!.capacity.toLocaleString()} lb tow rating. Towing it would exceed the manufacturer's limit.`;
      case 'unknown':
        return "We don't have a verified loaded weight (GVWR) for this trailer, so we can't confirm fit. Contact us and we'll check.";
      default:
        return '';
    }
  }
}
