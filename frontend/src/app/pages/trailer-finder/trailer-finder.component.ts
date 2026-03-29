import { Component } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';

interface Recommendation {
  slug: string;
  name: string;
  category: string;
  brand: string;
  price: string;
  gvwr: string;
  payload: string;
  image: string;
  reason: string;
}

@Component({
    selector: 'app-trailer-finder',
    imports: [FormsModule, RouterLink],
    templateUrl: './trailer-finder.component.html',
    styleUrls: ['./trailer-finder.component.scss']
})
export class TrailerFinderComponent {
  step = 0;
  loading = false;
  error = '';
  recommendations: Recommendation[] = [];

  answers = {
    hauling: '',
    weight: '',
    enclosure: '',
    budget: '',
    special: '',
  };

  haulingOptions = [
    { value: 'equipment', label: 'Equipment & Machinery', icon: '&#9881;' },
    { value: 'vehicles', label: 'Cars', icon: '&#9951;' },
    { value: 'cargo', label: 'Enclosed Cargo', icon: '&#9634;' },
    { value: 'materials', label: 'Landscaping & Materials', icon: '&#9752;' },
    { value: 'dump', label: 'Dump Loads & Debris', icon: '&#9660;' },
    { value: 'general', label: 'General / Utility', icon: '&#9733;' },
  ];

  weightOptions = [
    { value: 'under-3000', label: 'Under 3,000 lbs' },
    { value: '3000-7000', label: '3,000 - 7,000 lbs' },
    { value: '7000-14000', label: '7,000 - 14,000 lbs' },
    { value: 'over-14000', label: '14,000+ lbs' },
    { value: 'unsure', label: "I'm not sure" },
  ];

  enclosureOptions = [
    { value: 'enclosed', label: 'Enclosed', desc: 'Protected from weather' },
    { value: 'open', label: 'Open / Flatbed', desc: 'Easy loading access' },
    { value: 'either', label: 'No Preference', desc: 'Show me both' },
  ];

  budgetOptions = [
    { value: 'under-5000', label: 'Under $5,000' },
    { value: '5000-10000', label: '$5,000 - $10,000' },
    { value: '10000-15000', label: '$10,000 - $15,000' },
    { value: 'over-15000', label: '$15,000+' },
    { value: 'flexible', label: 'Flexible' },
  ];

  totalSteps = 5;

  next() {
    if (this.step < this.totalSteps - 1) {
      this.step++;
    }
  }

  back() {
    if (this.step > 0) {
      this.step--;
    }
  }

  selectHauling(value: string) {
    this.answers.hauling = value;
    this.next();
  }

  selectWeight(value: string) {
    this.answers.weight = value;
    this.next();
  }

  selectEnclosure(value: string) {
    this.answers.enclosure = value;
    this.next();
  }

  selectBudget(value: string) {
    this.answers.budget = value;
    this.next();
  }

  async submit() {
    this.loading = true;
    this.error = '';
    this.recommendations = [];

    try {
      const res = await fetch(`${environment.apiUrl}/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.answers),
      });

      if (!res.ok) throw new Error('Failed to get recommendations');

      const data = await res.json();
      this.recommendations = data.recommendations || [];

      if (this.recommendations.length === 0) {
        this.error = 'No matching trailers found. Try adjusting your requirements or give us a call!';
      }
    } catch {
      this.error = 'Something went wrong. Please try again or call us directly.';
    }

    this.loading = false;
  }

  restart() {
    this.step = 0;
    this.answers = { hauling: '', weight: '', enclosure: '', budget: '', special: '' };
    this.recommendations = [];
    this.error = '';
  }
}
