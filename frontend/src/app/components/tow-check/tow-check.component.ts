import { Component, Input } from '@angular/core';

import { VehiclePickerComponent } from '../vehicle-picker/vehicle-picker.component';
import { TowCheckService, TowResult } from '../../services/tow-check.service';

@Component({
    selector: 'app-tow-check',
    imports: [VehiclePickerComponent],
    templateUrl: './tow-check.component.html',
    styleUrls: ['./tow-check.component.scss']
})
export class TowCheckComponent {
  /** The trailer whose GVWR is checked against the shopper's tow vehicle. */
  @Input() trailer: any;

  editing = false;

  constructor(public towCheck: TowCheckService) {}

  get result(): TowResult | null {
    return this.towCheck.check(this.trailer?.gvwr);
  }

  get hasGvwr(): boolean {
    return TowCheckService.parseWeight(this.trailer?.gvwr) !== null;
  }

  startEditing() {
    this.editing = true;
  }

  percent(result: TowResult): number {
    return Math.round(result.ratio * 100);
  }

  verdictHeadline(result: TowResult): string {
    switch (result.verdict) {
      case 'safe': return 'Good match for your vehicle';
      case 'caution': return 'Close to your limit';
      case 'over': return 'Over your towing capacity';
    }
  }

  verdictDetail(result: TowResult): string {
    const gvwr = result.gvwr.toLocaleString('en-US');
    const capacity = result.capacity.toLocaleString('en-US');
    switch (result.verdict) {
      case 'safe':
        return `Fully loaded (${gvwr} lbs GVWR), this trailer stays comfortably under your ${capacity} lb rating.`;
      case 'caution':
        return `Fully loaded (${gvwr} lbs GVWR), this trailer uses ${Math.round(result.ratio * 100)}% of your ${capacity} lb rating — fine for lighter loads, but little margin at max.`;
      case 'over':
        return `Fully loaded (${gvwr} lbs GVWR), this trailer exceeds your ${capacity} lb rating. Consider a lighter model or give us a call for options.`;
    }
  }
}
