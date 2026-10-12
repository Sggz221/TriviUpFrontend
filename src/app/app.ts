import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SessionKeepAlive } from './auth/session-keepalive';
import { RejoinToastComponent } from './shared/components/rejoin-toast/rejoin-toast.component';
import { TutorialPlayerComponent } from './tutorial/player/tutorial-player';
import { TutorialService } from './tutorial/tutorial.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RejoinToastComponent, TutorialPlayerComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('TriviUp');
  protected readonly tutorial = inject(TutorialService);

  constructor() {
    inject(SessionKeepAlive).start();
  }
}
