import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type ShapeType = 'triangle' | 'square' | 'circle' | 'pentagon';

@Component({
    selector: 'app-answer-shape',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './answer-shape.html',
    styleUrls: ['./answer-shape.scss']
})
export class AnswerShapeComponent {
    @Input({ required: true }) shape!: ShapeType;
    @Input() selected: boolean = false;
}
