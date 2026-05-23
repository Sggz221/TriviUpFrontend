import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

export type ProfilePhotoSize = 'sm' | 'md' | 'lg';

@Component({
    selector: 'app-profile-photo',
    standalone: true,
    imports: [CommonModule],
    template: `
        @if (photoUrl()) {
            <div class="avatar" [class]="sizeClasses()">
                <div class="rounded-full">
                    <img [src]="photoUrl()" [alt]="username()" />
                </div>
            </div>
        } @else {
            <div class="avatar placeholder" [class]="sizeClasses()">
                <div class="rounded-full flex items-center justify-center" [style.background-color]="placeholderBg()" [style.width]="sizePx()" [style.height]="sizePx()">
                    @if (showInitials()) {
                        <span class="font-bold" [style.font-size]="fontSize()" [style.color]="placeholderColor()">
                            {{ initials() }}
                        </span>
                    } @else {
                        <svg xmlns="http://www.w3.org/2000/svg" [class]="iconSizeClass()" viewBox="0 0 24 24" fill="currentColor" [style.color]="placeholderColor()">
                            <path fill-rule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clip-rule="evenodd" />
                        </svg>
                    }
                </div>
            </div>
        }
    `,
    styles: [`
        :host {
            display: inline-block;
            line-height: 0;
        }

        .avatar img {
            object-fit: cover;
        }

        .avatar.placeholder > div {
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .transition-all {
            transition: all 0.3s ease;
        }
    `]
})
export class ProfilePhotoComponent {
    photoUrl = input<string | null>(null);
    username = input<string>('');
    size = input<ProfilePhotoSize>('md');
    showInitials = input<boolean>(false);

    private sizeMap = {
        'sm': 'w-8 h-8',
        'md': 'w-12 h-12',
        'lg': 'w-24 h-24'
    };

    private iconSizeMap = {
        'sm': 'h-4 w-4',
        'md': 'h-6 w-6',
        'lg': 'h-10 w-10'
    };

    private pxMap = {
        'sm': '32px',
        'md': '48px',
        'lg': '96px'
    };

    private fontSizeMap = {
        'sm': '12px',
        'md': '18px',
        'lg': '32px'
    };

    sizeClasses = computed(() => this.sizeMap[this.size()]);
    iconSizeClass = computed(() => this.iconSizeMap[this.size()]);
    sizePx = computed(() => this.pxMap[this.size()]);
    fontSize = computed(() => this.fontSizeMap[this.size()]);

    initials = computed(() => {
        if (!this.username()) return '?';
        return this.username()
            .split(' ')
            .map(part => part.charAt(0).toUpperCase())
            .slice(0, 2)
            .join('');
    });

    private colors = [
        { bg: '#f87171', text: '#ffffff' }, // red
        { bg: '#fb923c', text: '#ffffff' }, // orange
        { bg: '#fbbf24', text: '#000000' }, // amber
        { bg: '#34d399', text: '#000000' }, // emerald
        { bg: '#60a5fa', text: '#ffffff' }, // blue
        { bg: '#a78bfa', text: '#ffffff' }, // violet
        { bg: '#f472b6', text: '#ffffff' }, // pink
    ];

    placeholderBg = computed(() => {
        const index = this.username().charCodeAt(0) % this.colors.length;
        return this.colors[index].bg;
    });

    placeholderColor = computed(() => {
        const index = this.username().charCodeAt(0) % this.colors.length;
        return this.colors[index].text;
    });
}
