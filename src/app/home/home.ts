import { Component, OnInit, OnDestroy, ChangeDetectorRef, signal, inject } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService, AuthUser } from '../auth/auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './home.html',
  styleUrls: ['./home.css']
})
export class Home implements OnInit, OnDestroy {
  activeImageIndex: number = 0;
  private intervalId: any;

  private authService = inject(AuthService);
  private router = inject(Router);

  isLoggedIn = signal(this.authService.isLoggedIn());
  currentUser = signal<AuthUser | null>(this.authService.getUser());
  isDropdownOpen = signal(false);

  constructor(private cdr: ChangeDetectorRef) { }

  ngOnInit() {
    console.log('[Home] ngOnInit - checking auth state');
    const isLogged = this.authService.isLoggedIn();
    const user = this.authService.getUser();
    console.log('[Home] isLoggedIn:', isLogged);
    console.log('[Home] getUser():', user);
    console.log('[Home] localStorage.getItem("user"):', localStorage.getItem('user'));
    this.isLoggedIn.set(isLogged);
    this.currentUser.set(user);
    this.startAnimationLoop();
  }

  ngOnDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  toggleDropdown(): void {
    this.isDropdownOpen.update(v => !v);
  }

  closeDropdown(): void {
    this.isDropdownOpen.set(false);
  }

  logout(): void {
    this.authService.logout();
    this.isLoggedIn.set(false);
    this.currentUser.set(null);
    this.closeDropdown();
    this.router.navigate(['/']);
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
