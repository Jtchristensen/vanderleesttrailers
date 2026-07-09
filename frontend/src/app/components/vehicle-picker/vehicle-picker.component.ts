import { Component, EventEmitter, OnInit, Output } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { TowCheckService, VEHICLE_PRESETS } from '../../services/tow-check.service';

/** Compact vehicle select + apply form, shared by the trailer-detail tow-check
 * panel and the inventory "Fits My Truck" bar. Reads/writes TowCheckService
 * directly so every embed stays in sync. */
@Component({
    selector: 'app-vehicle-picker',
    imports: [FormsModule],
    templateUrl: './vehicle-picker.component.html',
    styleUrls: ['./vehicle-picker.component.scss']
})
export class VehiclePickerComponent implements OnInit {
  /** Fires after a vehicle is successfully applied. */
  @Output() applied = new EventEmitter<void>();

  presets = VEHICLE_PRESETS;
  selectedPreset = '';
  customName = '';
  customCapacity: number | null = null;

  constructor(private towCheck: TowCheckService) {}

  ngOnInit() {
    const vehicle = this.towCheck.vehicle();
    const preset = vehicle && this.presets.find(p => p.name === vehicle.name && p.capacity === vehicle.capacity);
    this.selectedPreset = preset ? preset.name : vehicle ? 'custom' : '';
    this.customName = !preset && vehicle ? vehicle.name : '';
    this.customCapacity = !preset && vehicle ? vehicle.capacity : null;
  }

  get canApply(): boolean {
    if (!this.selectedPreset) return false;
    if (this.selectedPreset === 'custom') return !!this.customCapacity && this.customCapacity > 0;
    return true;
  }

  apply() {
    if (!this.canApply) return;
    if (this.selectedPreset === 'custom') {
      this.towCheck.setVehicle(this.customName.trim() || 'My vehicle', this.customCapacity!);
    } else {
      const preset = this.presets.find(p => p.name === this.selectedPreset);
      if (!preset) return;
      this.towCheck.setVehicle(preset.name, preset.capacity);
    }
    this.applied.emit();
  }
}
