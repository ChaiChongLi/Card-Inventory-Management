import { Routes } from '@angular/router';
import { authGuard, noAuthGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { LoginComponent } from './features/login/login.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { CalculatorComponent } from './features/calculator/calculator.component';
import { AdminShellComponent } from './features/admin/admin-shell.component';
import { UsersComponent } from './features/admin/users/users.component';
import { PlatformsComponent } from './features/admin/platforms/platforms.component';
import { PartnersComponent } from './features/admin/partners/partners.component';
import { BatchesComponent } from './features/admin/batches/batches.component';
import { BatchDetailComponent } from './features/admin/batches/batch-detail.component';
import { ShopPurchasesComponent } from './features/admin/shop-purchases/shop-purchases.component';

export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [noAuthGuard],
  },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authGuard],
  },
  {
    path: 'calculator',
    component: CalculatorComponent,
    canActivate: [authGuard],
  },
  {
    path: 'admin',
    component: AdminShellComponent,
    canActivate: [adminGuard],
    children: [
      { path: '', redirectTo: 'users', pathMatch: 'full' },
      { path: 'users', component: UsersComponent },
      { path: 'platforms', component: PlatformsComponent },
      { path: 'partners', component: PartnersComponent },
      { path: 'batches', component: BatchesComponent },
      { path: 'batches/:id', component: BatchDetailComponent },
      { path: 'shop-purchases', component: ShopPurchasesComponent },
    ],
  },
  { path: '**', redirectTo: '/dashboard' },
];
