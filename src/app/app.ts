import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SessionKeepAlive } from './auth/session-keepalive';
import { RejoinToastComponent } from './shared/components/rejoin-toast/rejoin-toast.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RejoinToastComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('TriviUp');

  constructor() {
    inject(SessionKeepAlive).start();
  }
}
