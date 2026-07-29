import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ContactComponent } from './contact.component';
import { ContactFormService } from '../../services/contact-form.service';

class FakeContactForm {
  submit = jasmine.createSpy('submit').and.resolveTo(undefined);
}

describe('ContactComponent', () => {
  let fixture: ComponentFixture<ContactComponent>;
  let component: ContactComponent;
  let fakeContactForm: FakeContactForm;

  beforeEach(async () => {
    fakeContactForm = new FakeContactForm();
    await TestBed.configureTestingModule({
      imports: [ContactComponent],
      providers: [{ provide: ContactFormService, useValue: fakeContactForm }],
    }).compileComponents();
    fixture = TestBed.createComponent(ContactComponent);
    component = fixture.componentInstance;
  });

  it('renders without throwing against sync-fallback content', () => {
    expect(() => fixture.detectChanges()).not.toThrow();
  });

  it('submits via ContactFormService, resets the form, and flips isSubmitted', async () => {
    component.formData = { name: 'A', phone: 'B', email: 'C', message: 'D', company: '' };
    await component.onSubmit();
    expect(fakeContactForm.submit).toHaveBeenCalledWith({
      name: 'A', email: 'C', phone: 'B', message: 'D', company: '',
    });
    expect(component.isSubmitting).toBeFalse();
    expect(component.isSubmitted).toBeTrue();
    expect(component.error).toBeFalse();
    expect(component.formData).toEqual({ name: '', phone: '', email: '', message: '', company: '' });
  });

  it('shows the error state when the submit fails', async () => {
    fakeContactForm.submit.and.rejectWith(new Error('boom'));
    component.formData = { name: 'A', phone: 'B', email: 'C', message: 'D', company: '' };
    await component.onSubmit();
    expect(component.error).toBeTrue();
    expect(component.isSubmitted).toBeFalse();
    expect(component.isSubmitting).toBeFalse();
  });
});
