import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../services/admin.service';
import { UserResponse, UpdateUserRequest } from '../../models/admin.models';
import { NavbarComponent } from '../../../shared/components/navbar/navbar.component';

@Component({
    selector: 'app-admin-users',
    standalone: true,
    imports: [CommonModule, FormsModule, NavbarComponent],
    templateUrl: './admin-users.html',
    styleUrls: ['./admin-users.scss']
})
export class AdminUsersComponent implements OnInit {
    private adminService = inject(AdminService);

    users = signal<UserResponse[]>([]);
    loading = signal(true);
    saving = signal(false);
    error = signal<string | null>(null);
    successMessage = signal<string | null>(null);

    editingUserId = signal<number | null>(null);
    editForm = signal<UpdateUserRequest>({});

    showBanConfirm = signal(false);
    banTarget = signal<UserResponse | null>(null);
    banning = signal(false);

    ngOnInit(): void {
        this.loadUsers();
    }

    loadUsers(): void {
        this.loading.set(true);
        this.error.set(null);

        this.adminService.getUsers().subscribe({
            next: (users) => {
                this.users.set(users);
                this.loading.set(false);
            },
            error: (err) => {
                console.error('[AdminUsers] Error loading users:', err);
                this.error.set('Error al cargar los usuarios');
                this.loading.set(false);
            }
        });
    }

    startEdit(user: UserResponse): void {
        this.editingUserId.set(user.id);
        this.editForm.set({
            username: user.username,
            email: user.email,
            role: user.role
        });
    }

    cancelEdit(): void {
        this.editingUserId.set(null);
        this.editForm.set({});
    }

    saveEdit(userId: number): void {
        this.saving.set(true);
        this.successMessage.set(null);
        this.error.set(null);

        const data = this.editForm();

        this.adminService.updateUser(userId, data).subscribe({
            next: (updatedUser) => {
                this.users.update(users =>
                    users.map(u => u.id === userId ? updatedUser : u)
                );
                this.editingUserId.set(null);
                this.editForm.set({});
                this.saving.set(false);
                this.successMessage.set('Usuario actualizado correctamente');
                setTimeout(() => this.successMessage.set(null), 3000);
            },
            error: (err) => {
                console.error('[AdminUsers] Error updating user:', err);
                this.error.set('Error al actualizar el usuario');
                this.saving.set(false);
            }
        });
    }

    isEditing(userId: number): boolean {
        return this.editingUserId() === userId;
    }

    formatDate(dateString: string): string {
        return new Date(dateString).toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    confirmBan(user: UserResponse): void {
        this.banTarget.set(user);
        this.showBanConfirm.set(true);
    }

    cancelBan(): void {
        this.showBanConfirm.set(false);
        this.banTarget.set(null);
    }

    executeBan(): void {
        const user = this.banTarget();
        if (!user) return;

        this.banning.set(true);
        this.successMessage.set(null);
        this.error.set(null);

        this.adminService.banUser(user.id).subscribe({
            next: () => {
                this.users.update(users =>
                    users.map(u => u.id === user.id ? { ...u, isBanned: true } : u)
                );
                this.banning.set(false);
                this.cancelBan();
                this.successMessage.set(`Usuario ${user.username} baneado correctamente`);
                setTimeout(() => this.successMessage.set(null), 3000);
            },
            error: (err) => {
                console.error('[AdminUsers] Error banning user:', err);
                this.error.set('Error al banear el usuario');
                this.banning.set(false);
                this.cancelBan();
            }
        });
    }

    activateUser(userId: number): void {
        this.successMessage.set(null);
        this.error.set(null);

        this.adminService.activateUser(userId).subscribe({
            next: () => {
                this.users.update(users =>
                    users.map(u => u.id === userId ? { ...u, isBanned: false } : u)
                );
                this.successMessage.set('Usuario activado correctamente');
                setTimeout(() => this.successMessage.set(null), 3000);
            },
            error: (err) => {
                console.error('[AdminUsers] Error activating user:', err);
                this.error.set('Error al activar el usuario');
            }
        });
    }
}
