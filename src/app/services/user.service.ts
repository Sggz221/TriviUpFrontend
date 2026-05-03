import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { AuthService, AuthUser } from '../auth/auth.service';

export interface UpdateProfilePhotoResponse {
    profilePhotoUrl: string;
}

export interface UserProfileUpdate {
    username?: string;
    email?: string;
}

export interface UpdateProfileResponse {
    id: number;
    username: string;
    email: string;
    role: string;
    createdAt: string;
    profilePhotoUrl: string | null;
}

@Injectable({
    providedIn: 'root'
})
export class UserService {
    private readonly API_URL = 'http://localhost:5164/users';

    private http = inject(HttpClient);
    private authService = inject(AuthService);

    private getAuthHeaders(): HttpHeaders {
        const token = this.authService.getToken();
        return new HttpHeaders({
            'Authorization': `Bearer ${token}`
        });
    }

    updateProfile(data: { username?: string; email?: string; password?: string }): Observable<AuthUser> {
        return this.http.put<UpdateProfileResponse>(
            `${this.API_URL}/me`,
            data,
            {
                headers: this.getAuthHeaders()
            }
        ).pipe(
            tap(response => {
                const updatedUser: AuthUser = {
                    id: response.id,
                    username: response.username,
                    email: response.email,
                    role: response.role,
                    createdAt: response.createdAt,
                    profilePhotoUrl: response.profilePhotoUrl
                };
                this.authService.updateStoredUser(updatedUser);
            }),
            catchError(error => {
                console.error('[UserService] Error updating profile:', error);
                return throwError(() => error);
            })
        );
    }

    deleteProfilePhoto(): Observable<void> {
        return this.http.delete<void>(
            `${this.API_URL}/profile-photo`,
            {
                headers: this.getAuthHeaders()
            }
        ).pipe(
            tap(() => {
                const currentUser = this.authService.getUser();
                if (currentUser) {
                    const updatedUser: AuthUser = {
                        ...currentUser,
                        profilePhotoUrl: null
                    };
                    this.authService.updateStoredUser(updatedUser);
                }
            }),
            catchError(error => {
                console.error('[UserService] Error deleting profile photo:', error);
                return throwError(() => error);
            })
        );
    }

    updateProfilePhoto(file: File): Observable<UpdateProfilePhotoResponse> {
        console.log('[UserService] updateProfilePhoto - archivo:', file.name, file.type, file.size);
        console.log('[UserService] updateProfilePhoto - headers:', this.getAuthHeaders().get('Authorization'));

        const formData = new FormData();
        formData.append('file', file);

        // Log del contenido de formData
        console.log('[UserService] FormData creada, entries:');
        formData.forEach((value, key) => {
            console.log(`  ${key}:`, value);
        });

        return this.http.put<UpdateProfilePhotoResponse>(
            `${this.API_URL}/profile-photo`,
            formData,
            {
                headers: this.getAuthHeaders()
            }
        ).pipe(
            tap(response => {
                console.log('[UserService] Upload exitoso, response:', response);
                if (response && response.profilePhotoUrl) {
                    this.updateUserProfilePhoto(response.profilePhotoUrl);
                }
            }),
            catchError(error => {
                console.error('[UserService] Error uploading profile photo:', error);
                console.error('[UserService] Error status:', error.status);
                console.error('[UserService] Error message:', error.message);
                console.error('[UserService] Error error:', error.error);
                return throwError(() => error);
            })
        );
    }

    private updateUserProfilePhoto(profilePhotoUrl: string): void {
        const currentUser = this.authService.getUser();
        if (currentUser) {
            const updatedUser: AuthUser = {
                ...currentUser,
                profilePhotoUrl
            };
            this.authService.updateStoredUser(updatedUser);
        }
    }

    getProfilePhotoUrl(user: AuthUser | null): string | null {
        return user?.profilePhotoUrl ?? null;
    }

    getInitials(username: string): string {
        return username
            .split(' ')
            .map(part => part.charAt(0).toUpperCase())
            .slice(0, 2)
            .join('');
    }
}
