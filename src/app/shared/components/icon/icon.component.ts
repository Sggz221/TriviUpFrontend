import { Component, Input } from '@angular/core';

export type IconName = 'check' | 'copy' | 'crown' | 'eye' | 'x';

@Component({
    selector: 'app-icon',
    standalone: true,
    template: `
        <svg
            [attr.width]="size"
            [attr.height]="size"
            viewBox="0 0 24 24"
            [attr.fill]="name === 'crown' ? 'currentColor' : 'none'"
            [attr.stroke]="name === 'crown' ? 'none' : 'currentColor'"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="app-icon"
            aria-hidden="true"
        >
            @switch (name) {
                @case ('check') {
                    <polyline points="20 6 9 17 4 12"></polyline>
                }
                @case ('copy') {
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                }
                @case ('x') {
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                }
                @case ('eye') {
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                }
                @case ('crown') {
                    <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"></path>
                }
            }
        </svg>
    `,
    styles: [`
        :host {
            display: inline-flex;
        }
        .app-icon {
            display: block;
        }
    `]
})
export class IconComponent {
    @Input() name: IconName = 'check';
    @Input() size = 16;
}
