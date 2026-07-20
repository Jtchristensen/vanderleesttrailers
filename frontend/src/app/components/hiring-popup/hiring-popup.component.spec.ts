import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HiringPopupComponent } from './hiring-popup.component';
import { ContentService } from '../../services/content.service';
import { CareersService } from '../../services/careers.service';

class FakeContent {
  value: any = { enabled: true, headline: 'We\'re Hiring!', ctaLabel: 'Apply Now', position: 'General Application', email: 'vanderleesttrailers@gmail.com' };
  async getContent() { return this.value; }
}
class FakeCareers {
  apply = jasmine.createSpy('apply').and.resolveTo(undefined);
}

function setup(content: any) {
  const fakeContent = new FakeContent();
  fakeContent.value = content;
  const fakeCareers = new FakeCareers();
  TestBed.configureTestingModule({
    imports: [HiringPopupComponent],
    providers: [
      { provide: ContentService, useValue: fakeContent },
      { provide: CareersService, useValue: fakeCareers },
    ],
  });
  const fixture = TestBed.createComponent(HiringPopupComponent);
  return { fixture, fakeCareers };
}

// ngOnInit runs on the first detectChanges and loads content asynchronously —
// so render, wait for the promise to settle, then render again.
async function ready(fixture: ComponentFixture<HiringPopupComponent>) {
  fixture.detectChanges();      // triggers ngOnInit (async content load)
  await fixture.whenStable();   // wait for getContent() to resolve
  fixture.detectChanges();      // re-render with the resolved content
}

describe('HiringPopupComponent', () => {
  beforeEach(() => {
    localStorage.clear();
    // Suppress the 6s auto-open timer: while it is pending, fixture.whenStable()
    // never settles (Angular waits on all zone macrotasks). These tests drive
    // the modal explicitly, so we opt out of the timed auto-open.
    localStorage.setItem('vlt-hiring-dismissed', '1');
  });

  it('renders the reopen button when enabled', async () => {
    const { fixture } = setup({ enabled: true, headline: 'Hi', ctaLabel: 'Apply' });
    await ready(fixture);
    expect(fixture.nativeElement.querySelector('.hiring-fab')).toBeTruthy();
  });

  it('renders nothing when disabled', async () => {
    const { fixture } = setup({ enabled: false });
    await ready(fixture);
    expect(fixture.nativeElement.querySelector('.hiring-fab')).toBeNull();
    expect(fixture.nativeElement.querySelector('.hiring-overlay')).toBeNull();
  });

  it('opens the modal on button click', async () => {
    const { fixture } = setup({ enabled: true, headline: 'Hi', ctaLabel: 'Apply' });
    await ready(fixture);
    fixture.nativeElement.querySelector('.hiring-fab').click();
    fixture.detectChanges();
    expect(fixture.componentInstance.open).toBeTrue();
    expect(fixture.nativeElement.querySelector('.hiring-overlay')).toBeTruthy();
  });

  it('submits via CareersService and shows success', async () => {
    const { fixture, fakeCareers } = setup({ enabled: true, headline: 'Hi', ctaLabel: 'Apply', position: 'General Application' });
    await ready(fixture);
    const c = fixture.componentInstance;
    c.openModal();
    c.form = { name: 'Jane', email: 'j@e.com', phone: '1', message: '', company: '' };
    await c.submit();
    expect(fakeCareers.apply).toHaveBeenCalled();
    expect(c.submitted).toBeTrue();
    expect(localStorage.getItem('vlt-hiring-applied')).toBe('1');
  });

  it('shows the error state when the submit fails', async () => {
    const { fixture, fakeCareers } = setup({ enabled: true, headline: 'Hi', ctaLabel: 'Apply' });
    fakeCareers.apply.and.rejectWith(new Error('boom'));
    await ready(fixture);
    const c = fixture.componentInstance;
    c.openModal();
    c.form = { name: 'Jane', email: 'j@e.com', phone: '1', message: '', company: '' };
    await c.submit();
    expect(c.error).toBeTrue();
    expect(c.submitted).toBeFalse();
  });
});
