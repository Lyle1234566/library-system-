import type { User } from '@/lib/auth';

type RoleUser = Pick<User, 'role' | 'is_working_student'> | null | undefined;

export function isWorkingStudent(user: RoleUser): boolean {
  return Boolean(
    user &&
      (user.role === 'WORKING' || (user.role === 'STUDENT' && user.is_working_student))
  );
}

export function hasStaffDeskAccess(user: RoleUser): boolean {
  return Boolean(user && (user.role === 'STAFF' || user.role === 'ADMIN' || isWorkingStudent(user)));
}

export function getUserRoleLabel(user: RoleUser): string {
  if (!user) {
    return 'Guest';
  }
  if (isWorkingStudent(user)) {
    return 'Working Student';
  }
  if (user.role === 'LIBRARIAN') {
    return 'Librarian';
  }
  if (user.role === 'TEACHER') {
    return 'Teacher';
  }
  if (user.role === 'STAFF') {
    return 'Staff';
  }
  if (user.role === 'ADMIN') {
    return 'Admin';
  }
  return 'Student';
}

export function canBorrowAsPatron(user: RoleUser): boolean {
  return Boolean(user && (user.role === 'TEACHER' || user.role === 'STUDENT' || isWorkingStudent(user)));
}

export function getDefaultSignedInRoute(user: RoleUser): string {
  if (!user) {
    return '/';
  }
  if (user.role === 'LIBRARIAN' || user.role === 'ADMIN') {
    return '/librarian';
  }
  if (hasStaffDeskAccess(user)) {
    return '/staff';
  }
  return '/my-books';
}

export function resolveSignedInRedirect(user: RoleUser, requestedPath?: string | null): string {
  const defaultRoute = getDefaultSignedInRoute(user);

  if (!requestedPath || !requestedPath.startsWith('/')) {
    return defaultRoute;
  }

  if (requestedPath === '/staff' || requestedPath.startsWith('/staff/')) {
    return hasStaffDeskAccess(user) ? requestedPath : defaultRoute;
  }

  if (requestedPath === '/librarian' || requestedPath.startsWith('/librarian/')) {
    return user?.role === 'LIBRARIAN' || user?.role === 'ADMIN' ? requestedPath : defaultRoute;
  }

  if (requestedPath === '/my-books') {
    return canBorrowAsPatron(user) ? requestedPath : defaultRoute;
  }

  if (
    requestedPath === '/' ||
    requestedPath === '/dashboard' ||
    requestedPath === '/teacher' ||
    requestedPath === '/login' ||
    requestedPath === '/register'
  ) {
    return defaultRoute;
  }

  return requestedPath;
}

export function hasRequiredRole(
  user: RoleUser,
  requiredRoles: Array<'STUDENT' | 'TEACHER' | 'LIBRARIAN' | 'WORKING' | 'ADMIN' | 'STAFF'>
): boolean {
  if (!user) {
    return false;
  }

  return requiredRoles.some((role) => {
    if (role === user.role) {
      return true;
    }
    if (role === 'WORKING') {
      return isWorkingStudent(user);
    }
    if (role === 'STUDENT') {
      return user.role === 'STUDENT' || isWorkingStudent(user);
    }
    return false;
  });
}
