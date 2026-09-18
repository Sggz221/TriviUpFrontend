import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SessionKeepAlive } from './auth/session-keepalive';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('TriviUp');

  constructor() {
    inject(SessionKeepAlive).start();
  }
}
