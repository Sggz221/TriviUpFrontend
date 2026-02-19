import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrls: ['./home.css']
})
export class Home implements OnInit, OnDestroy {
  activeImageIndex: number = 0;
  private intervalId: any;

  constructor(private cdr: ChangeDetectorRef) { }

  ngOnInit() {
    this.startAnimationLoop();
  }

  ngOnDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  private startAnimationLoop() {
    this.intervalId = setInterval(() => {
      if (this.activeImageIndex === 0) {
        // Switch to a random image (1-4)
        this.activeImageIndex = Math.floor(Math.random() * 4) + 1;
      } else {
        // Switch back to base image (0)
        this.activeImageIndex = 0;
      }
      this.cdr.detectChanges(); // Manually trigger change detection just in case
    }, 2200); // Change every 2.2 seconds
  }
}
