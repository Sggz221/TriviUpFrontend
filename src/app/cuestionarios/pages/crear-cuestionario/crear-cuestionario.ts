import { Component } from '@angular/core';
import { QuizFormComponent } from '../../components/quiz-form/quiz-form';

@Component({
    selector: 'app-crear-cuestionario',
    standalone: true,
    imports: [QuizFormComponent],
    template: '<app-quiz-form></app-quiz-form>'
})
export class CrearCuestionarioPage {}
