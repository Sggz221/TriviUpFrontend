import { Component, OnInit, OnDestroy, ChangeDetectorRef, signal, inject } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../auth/auth.service';
import { NavbarComponent } from '../shared/components/navbar/navbar.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, CommonModule, NavbarComponent],
  templateUrl: './home.html',
  styleUrls: ['./home.css']
})
export class Home implements OnInit, OnDestroy {
  activeImageIndex: number = 0;
  private intervalId: any;

  private authService = inject(AuthService);
  private router = inject(Router);

  isLoggedIn = signal(this.authService.isLoggedIn());

  constructor(private cdr: ChangeDetectorRef) { }

  ngOnInit() {
    console.log('[Home] ngOnInit - checking auth state');
    const isLogged = this.authService.isLoggedIn();
    console.log('[Home] isLoggedIn:', isLogged);
    console.log('[Home] localStorage.getItem("user"):', localStorage.getItem('user'));
    this.isLoggedIn.set(isLogged);
    this.startAnimationLoop();
  }

  ngOnDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  crearConcurso(): void {
    this.router.navigate(['/cuestionarios/crear']);
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
