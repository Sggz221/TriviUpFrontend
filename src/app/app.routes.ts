import { Routes } from '@angular/router';
import { Home } from './home/home';
import { Auth } from './auth/auth';
import { AuthCallback } from './auth/auth-callback';
import { CrearCuestionarioPage } from './cuestionarios/pages/crear-cuestionario/crear-cuestionario';
import { QuizListComponent } from './cuestionarios/components/quiz-list/quiz-list';
import { QuizDetailComponent } from './cuestionarios/components/quiz-detail/quiz-detail';
import { QuizzesPublicComponent } from './cuestionarios/components/quizzes-public/quizzes-public.component';
import { Profile } from './user/pages/profile/profile';
import { ProfileEdit } from './user/pages/profile-edit/profile-edit';
import { GameRoomComponent } from './game/pages/game-room/game-room';
import { GameHistoryComponent } from './game/pages/game-history/game-history';
import { GameDetailsComponent } from './game/pages/game-details/game-details';
import { JoinRoomComponent } from './game/pages/join-room/join-room';
import { AdminDashboardComponent } from './admin/pages/admin-dashboard/admin-dashboard';
import { isAdminGuard } from './admin/guards/is-admin.guard';
import { InformacionComponent } from './shared/pages/informacion/informacion';
import { ContactoComponent } from './shared/pages/contacto/contacto';

export const routes: Routes = [
    { path: '', component: Home },
    { path: 'auth', component: Auth },
    { path: 'auth/callback', component: AuthCallback },
    { path: 'perfil', component: Profile },
    { path: 'perfil/editar', component: ProfileEdit },
    { path: 'cuestionarios/crear', component: CrearCuestionarioPage },
    { path: 'cuestionarios/mis-cuestionarios', component: QuizListComponent },
    { path: 'quizzes/public', component: QuizzesPublicComponent },
    { path: 'cuestionarios/:id', component: QuizDetailComponent },
    { path: 'game/history', component: GameHistoryComponent },
    { path: 'game/history/:gameId', component: GameDetailsComponent },
    { path: 'unirse', component: JoinRoomComponent },
    { path: 'game/:roomCode', component: GameRoomComponent },
    { path: 'admin', component: AdminDashboardComponent, canActivate: [isAdminGuard] },
    { path: 'informacion', component: InformacionComponent },
    { path: 'contacto', component: ContactoComponent },
    { path: '**', redirectTo: '' }
];
