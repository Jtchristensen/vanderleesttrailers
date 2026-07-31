import { Component, Input } from '@angular/core';

import { savings } from '../../utils/pricing';

/** "You Save $X" pill shown alongside a trailer's price wherever an MSRP is set
 * above the selling price (inventory, favorites, finder, trailer detail).
 * Renders nothing at all when there's no discount — see utils/pricing. */
@Component({
    selector: 'app-savings-badge',
    imports: [],
    templateUrl: './savings-badge.component.html',
    styleUrls: ['./savings-badge.component.scss']
})
export class SavingsBadgeComponent {
  @Input() trailer: any;
  /** Larger padding/type for the trailer detail page; cards use the default. */
  @Input() large = false;

  /** null when there's nothing to advertise — the badge stays hidden. */
  get amount(): number | null {
    return savings(this.trailer);
  }
}
