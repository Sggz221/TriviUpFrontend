import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminService } from '../../services/admin.service';
import { AdminStats } from '../../models/admin.models';
import { interval, Subscription } from 'rxjs';
import { NavbarComponent } from '../../../shared/components/navbar/navbar.component';

@Component({
    selector: 'app-admin-dashboard',
    standalone: true,
    imports: [CommonModule, RouterLink, NavbarComponent],
    templateUrl: './admin-dashboard.html',
    styleUrls: ['./admin-dashboard.scss']
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
    private adminService = inject(AdminService);
    private refreshSubscription: Subscription | null = null;

    stats = signal<AdminStats | null>(null);
    isLoading = signal(true);
    error = signal<string | null>(null);

    ngOnInit(): void {
        this.loadStats();
        // Refresh every 10 seconds
        this.refreshSubscription = interval(10000).subscribe(() => {
            this.loadStats();
        });
    }

    ngOnDestroy(): void {
        this.refreshSubscription?.unsubscribe();
    }

    loadStats(): void {
        this.adminService.getStats().subscribe({
            next: (data) => {
                this.stats.set(data);
                this.isLoading.set(false);
                this.error.set(null);
            },
            error: (err) => {
                console.error('Error loading admin stats:', err);
                this.error.set('Error al cargar las estadísticas');
                this.isLoading.set(false);
            }
        });
    }

    formatDate(dateStr: string): string {
        const date = new Date(dateStr);
        return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    }

    getMaxCount(items: { count: number }[]): number {
        if (!items || items.length === 0) return 0;
        return Math.max(...items.map(item => item.count));
    }
}
