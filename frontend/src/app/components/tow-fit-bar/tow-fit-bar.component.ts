import { Component, EventEmitter, Input, Output } from '@angular/core';

import { VehiclePickerComponent } from '../vehicle-picker/vehicle-picker.component';
import { TowCheckService } from '../../services/tow-check.service';

/** Sitewide "pick your tow vehicle" widget for list pages. Once a vehicle is
 * saved, every app-tow-fit-badge on the page lights up automatically since
 * they all read the same TowCheckService. Also owns the "only show trailers
 * I can tow" filter toggle so the picker and the filter live in one place. */
@Component({
    selector: 'app-tow-fit-bar',
    imports: [VehiclePickerComponent],
    templateUrl: './tow-fit-bar.component.html',
    styleUrls: ['./tow-fit-bar.component.scss']
})
export class TowFitBarComponent {
  /** Trailers currently shown after all filters (category/search + this one). */
  @Input() shownCount: number | null = null;
  /** Trailers that would show with the tow-fit filter off (category/search only). */
  @Input() totalCount: number | null = null;

  @Input() filterOnlyTowable = false;
  @Output() filterOnlyTowableChange = new EventEmitter<boolean>();

  editing = false;

  constructor(public towCheck: TowCheckService) {}

  get isFiltering(): boolean {
    return this.filterOnlyTowable && this.shownCount !== null && this.totalCount !== null && this.shownCount !== this.totalCount;
  }

  toggleFilter() {
    this.filterOnlyTowableChange.emit(!this.filterOnlyTowable);
  }

  showAll() {
    this.filterOnlyTowableChange.emit(false);
  }

  changeVehicle() {
    this.editing = true;
  }

  clearVehicle() {
    this.towCheck.clear();
    this.filterOnlyTowableChange.emit(false);
  }
}
