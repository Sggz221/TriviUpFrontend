import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../../auth/auth.service';

export const isAdminGuard: CanActivateFn = () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    const user = authService.getUser();

    if (user && user.role === 'ADMIN') {
        return true;
    }

    router.navigate(['/']);
    return false;
};
