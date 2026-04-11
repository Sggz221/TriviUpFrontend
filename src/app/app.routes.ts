import { Routes } from '@angular/router';
import { Home } from './home/home';
import { Auth } from './auth/auth';
import { AuthCallback } from './auth/auth-callback';

export const routes: Routes = [
    { path: '', component: Home },
    { path: 'auth', component: Auth },
    { path: 'auth/callback', component: AuthCallback },
    { path: '**', redirectTo: '' }
];
