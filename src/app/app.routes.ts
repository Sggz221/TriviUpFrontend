import { Routes } from '@angular/router';
import { Home } from './home/home';
import { Auth } from './auth/auth';
import { AuthCallback } from './auth/auth-callback';
import { CrearCuestionarioPage } from './cuestionarios/pages/crear-cuestionario/crear-cuestionario';
import { QuizListComponent } from './cuestionarios/components/quiz-list/quiz-list';
import { QuizDetailComponent } from './cuestionarios/components/quiz-detail/quiz-detail';

export const routes: Routes = [
    { path: '', component: Home },
    { path: 'auth', component: Auth },
    { path: 'auth/callback', component: AuthCallback },
    { path: 'cuestionarios/crear', component: CrearCuestionarioPage },
    { path: 'cuestionarios/mis-cuestionarios', component: QuizListComponent },
    { path: 'cuestionarios/:id', component: QuizDetailComponent },
    { path: '**', redirectTo: '' }
];
