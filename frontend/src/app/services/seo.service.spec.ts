import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, SeoService } from './seo.service';

@Component({ standalone: true, template: '<p>dummy</p>' })
class DummyComponent {}

describe('SeoService', () => {
  let titleSpy: jasmine.SpyObj<Title>;
  let metaSpy: jasmine.SpyObj<Meta>;

  beforeEach(() => {
    titleSpy = jasmine.createSpyObj<Title>('Title', ['setTitle']);
    metaSpy = jasmine.createSpyObj<Meta>('Meta', ['updateTag']);

    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: '',
            component: DummyComponent,
            data: { title: 'Home | VanderLeest Trailer Sales', description: 'Home page description.' },
          },
          {
            path: 'no-data',
            component: DummyComponent,
          },
          {
            // Mirrors the app's real routing style: a lazy-loaded standalone
            // component (loadComponent) with route data on the leaf route.
            path: 'lazy',
            loadComponent: () => Promise.resolve(DummyComponent),
            data: { title: 'Lazy | VanderLeest Trailer Sales', description: 'Lazy page description.' },
          },
        ]),
        { provide: Title, useValue: titleSpy },
        { provide: Meta, useValue: metaSpy },
      ],
    });
  });

  it('sets the title and description from the activated route data on navigation', async () => {
    TestBed.inject(SeoService); // instantiate so its NavigationEnd subscription starts
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('');

    expect(titleSpy.setTitle).toHaveBeenCalledWith('Home | VanderLeest Trailer Sales');
    expect(metaSpy.updateTag).toHaveBeenCalledWith({ name: 'description', content: 'Home page description.' });
  });

  it('reaches route data for a lazy-loaded (loadComponent) leaf route', async () => {
    TestBed.inject(SeoService);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('lazy');

    expect(titleSpy.setTitle).toHaveBeenCalledWith('Lazy | VanderLeest Trailer Sales');
    expect(metaSpy.updateTag).toHaveBeenCalledWith({ name: 'description', content: 'Lazy page description.' });
  });

  it('falls back to the site defaults when a route has no data', async () => {
    TestBed.inject(SeoService);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('no-data');

    expect(titleSpy.setTitle).toHaveBeenCalledWith(DEFAULT_TITLE);
    expect(metaSpy.updateTag).toHaveBeenCalledWith({ name: 'description', content: DEFAULT_DESCRIPTION });
  });

  it('updates the title again on a subsequent navigation', async () => {
    TestBed.inject(SeoService);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('');
    await harness.navigateByUrl('lazy');

    expect(titleSpy.setTitle).toHaveBeenCalledWith('Lazy | VanderLeest Trailer Sales');
    expect(titleSpy.setTitle).toHaveBeenCalledTimes(2);
  });
});
