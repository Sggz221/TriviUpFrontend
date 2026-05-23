import { Component, OnInit, signal, inject } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService, AuthUser } from '../../../auth/auth.service';
import { ProfilePhotoComponent } from '../profile-photo/profile-photo';

@Component({
    selector: 'app-navbar',
    standalone: true,
    imports: [RouterLink, CommonModule, FormsModule, ProfilePhotoComponent],
    templateUrl: './navbar.html',
    styleUrls: ['./navbar.scss']
})
export class NavbarComponent implements OnInit {
    private authService = inject(AuthService);
    private router = inject(Router);

    isLoggedIn = signal(false);
    currentUser = signal<AuthUser | null>(null);

    ngOnInit(): void {
        this.checkAuthState();
    }

    private checkAuthState(): void {
        const isLogged = this.authService.isLoggedIn();
        const user = this.authService.getUser();
        this.isLoggedIn.set(isLogged);
        this.currentUser.set(user);
    }

    logout(): void {
        this.authService.logout();
        this.isLoggedIn.set(false);
        this.currentUser.set(null);
        this.router.navigate(['/']);
    }

    refreshAuth(): void {
        this.checkAuthState();
    }

    isAdmin(): boolean {
        const user = this.currentUser();
        return user !== null && user.role === 'ADMIN';
    }
}