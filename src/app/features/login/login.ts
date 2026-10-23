import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { errorMessage } from '../../core/api';
import { Auth } from '../../core/auth';
import { TKey, TPipe } from '../../core/i18n';
import { Icon } from '../../shared/icon';
import { LangSwitch } from '../../shared/lang-switch';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, Icon, LangSwitch, TPipe],
  template: `
    <div class="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section class="relative hidden overflow-hidden lg:block">
        <div class="absolute inset-0 bg-[radial-gradient(600px_400px_at_30%_30%,rgb(139_92_246/0.35),transparent),radial-gradient(500px_400px_at_80%_80%,rgb(230_79_176/0.25),transparent)]"></div>
        <div class="relative flex h-full flex-col justify-between p-12">
          <div class="flex items-center gap-3">
            <img src="logo.webp" alt="" class="size-11 rounded-xl" />
            <span class="h-display text-xl font-bold">PropPilot</span>
          </div>
          <div class="max-w-lg">
            <img src="logo.webp" [alt]="'login.logoAlt' | t" class="mb-10 size-56 rounded-[2.5rem] shadow-[0_30px_90px_-20px_rgb(192_79_216/0.7)]" />
            <h1 class="h-display text-4xl leading-tight font-semibold">
              {{ 'login.heroTitle' | t }}<br /><span class="ai-text">{{ 'login.heroAccent' | t }}</span>
            </h1>
            <p class="mt-4 text-muted">
              {{ 'login.heroText' | t }}
            </p>
            <ul class="mt-8 grid gap-3 text-sm text-muted">
              @for (f of features; track f) {
                <li class="flex items-center gap-2.5"><app-icon name="sparkles" [size]="15" class="text-violet-soft" /> {{ f | t }}</li>
              }
            </ul>
          </div>
          <p class="text-xs text-faint">© {{ year }} PropPilot</p>
        </div>
      </section>

      <section class="relative flex items-center justify-center p-6">
        <app-lang-switch class="absolute top-5 right-5" />
        <form class="panel w-full max-w-sm p-7 animate-fade-up" (submit)="submit($event)">
          <img src="logo.webp" alt="" class="mb-5 size-12 rounded-xl lg:hidden" />
          <h2 class="h-display text-2xl font-semibold">{{ 'login.welcome' | t }}</h2>
          <p class="mt-1 text-sm text-muted">{{ 'login.subtitle' | t }}</p>

          <label class="mt-7 block">
            <span class="label">{{ 'login.email' | t }}</span>
            <input class="input mt-1.5" type="email" name="email" autocomplete="username" [(ngModel)]="email" required />
          </label>
          <label class="mt-4 block">
            <span class="label">{{ 'login.password' | t }}</span>
            <input class="input mt-1.5" type="password" name="password" autocomplete="current-password" [(ngModel)]="password" required />
          </label>

          @if (error()) {
            <p class="mt-4 rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad" role="alert">{{ error() }}</p>
          }

          <button class="btn btn-primary mt-6 w-full" type="submit" [disabled]="loading()">
            {{ (loading() ? 'login.submitting' : 'login.submit') | t }}
          </button>
          <p class="mt-5 rounded-lg border border-dashed border-[var(--line-strong)] px-3 py-2 text-center text-xs text-faint">
            Demo: admin&#64;proppilot.dev · proppilot
          </p>
        </form>
      </section>
    </div>
  `,
})
export class Login {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  protected readonly features: TKey[] = ['login.feature1', 'login.feature2', 'login.feature3', 'login.feature4'];
  protected readonly year = new Date().getFullYear();
  protected email = 'admin@proppilot.dev';
  protected password = '';
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  async submit(event: Event) {
    event.preventDefault();
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.auth.login(this.email, this.password);
      await this.router.navigateByUrl('/');
    } catch (err) {
      this.error.set(errorMessage(err));
    } finally {
      this.loading.set(false);
    }
  }
}
