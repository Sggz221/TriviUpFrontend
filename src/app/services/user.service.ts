import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap, map, catchError, throwError } from 'rxjs';
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
    private readonly API_URL = '/api/users';

    private http = inject(HttpClient);
    private authService = inject(AuthService);

    private getAuthHeaders(): HttpHeaders {
        const token = this.authService.getToken();
        return new HttpHeaders({
            'Authorization': `Bearer ${token}`
        });
    }

    updateProfile(data: { username?: string; email?: string; password?: string }): Observable<AuthUser> {
        console.log('[UserService] updateProfile - data sent:', data);
        return this.http.put<{ user: UpdateProfileResponse; message: string }>(
            `${this.API_URL}/me`,
            data,
            {
                headers: this.getAuthHeaders()
            }
        ).pipe(
            tap(response => {
                console.log('[UserService] updateProfile - response received:', response);
                const userResponse = response.user;
                const updatedUser: AuthUser = {
                    id: userResponse.id,
                    username: userResponse.username,
                    email: userResponse.email,
                    role: userResponse.role,
                    createdAt: userResponse.createdAt,
                    profilePhotoUrl: userResponse.profilePhotoUrl
                };
                console.log('[UserService] updateProfile - updatedUser:', updatedUser);
                this.authService.updateStoredUser(updatedUser);
            }),
            map(response => response.user),
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
