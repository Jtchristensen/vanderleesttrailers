import { TestBed, ComponentFixture, fakeAsync, tick } from '@angular/core/testing';
import { ContactComponent } from './contact.component';

describe('ContactComponent', () => {
  let fixture: ComponentFixture<ContactComponent>;
  let component: ContactComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContactComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(ContactComponent);
    component = fixture.componentInstance;
  });

  it('renders without throwing against sync-fallback content', () => {
    expect(() => fixture.detectChanges()).not.toThrow();
  });

  it('resets the form and flips isSubmitted after submit', fakeAsync(() => {
    component.formData = { name: 'A', phone: 'B', email: 'C', message: 'D' };
    component.onSubmit();
    expect(component.isSubmitting).toBeTrue();
    tick(1000);
    expect(component.isSubmitting).toBeFalse();
    expect(component.isSubmitted).toBeTrue();
    expect(component.formData).toEqual({ name: '', phone: '', email: '', message: '' });
  }));
});
