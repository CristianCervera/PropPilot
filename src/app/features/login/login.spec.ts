import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Auth } from '../../core/auth';
import { Login } from './login';

describe('Login', () => {
  const login = vi.fn();

  beforeEach(() => {
    login.mockReset();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: Auth, useValue: { login } }],
    });
  });

  async function fill(password: string) {
    const fixture = TestBed.createComponent(Login);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    const input = el.querySelector<HTMLInputElement>('input[name=password]')!;
    input.value = password;
    input.dispatchEvent(new Event('input'));
    return { fixture, el, form: el.querySelector('form')! };
  }

  it('signs in with the demo email prefilled and goes to the dashboard', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    login.mockResolvedValue(undefined);
    const { fixture, form } = await fill('proppilot');

    form.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(login).toHaveBeenCalledWith('admin@proppilot.dev', 'proppilot');
    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('shows the API error and re-enables the button', async () => {
    login.mockRejectedValue(new HttpErrorResponse({ status: 401, error: { message: 'Credenciales incorrectas' } }));
    const { fixture, el, form } = await fill('mal');

    form.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(el.querySelector('[role=alert]')!.textContent!.trim()).toBe('Credenciales incorrectas');
    expect(el.querySelector<HTMLButtonElement>('button[type=submit]')!.disabled).toBe(false);
  });
});
