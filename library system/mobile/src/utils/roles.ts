import { User, UserRole } from "../types";

type RoleUser = Pick<User, "role" | "is_working_student"> | null | undefined;

export const isWorkingStudent = (user: RoleUser): boolean =>
  Boolean(
    user &&
      (user.role === "WORKING" || (user.role === "STUDENT" && user.is_working_student))
  );

export const hasStaffDeskAccess = (user: RoleUser): boolean =>
  Boolean(user && (user.role === "STAFF" || user.role === "ADMIN" || isWorkingStudent(user)));

export const canOpenLibrarianDesk = (user: RoleUser): boolean =>
  Boolean(user && (user.role === "LIBRARIAN" || user.role === "ADMIN"));

export const getRoleLabel = (
  role?: UserRole | null,
  isWorkingStudentFlag?: boolean
): string => {
  if (!role) return "Reader";
  if (role === "WORKING" || (role === "STUDENT" && isWorkingStudentFlag)) {
    return "Working Student";
  }
  if (role === "STUDENT") return "Student";
  if (role === "TEACHER") return "Teacher";
  if (role === "LIBRARIAN") return "Librarian";
  if (role === "STAFF") return "Staff";
  return "Admin";
};

export const canBorrowAsPatron = (user: RoleUser): boolean =>
  Boolean(user && (user.role === "TEACHER" || user.role === "STUDENT" || isWorkingStudent(user)));

export const getDefaultAppTabForUser = (
  user: RoleUser
): "Dashboard" | "MyBooks" => {
  if (user && (canOpenLibrarianDesk(user) || hasStaffDeskAccess(user))) {
    return "Dashboard";
  }
  return "MyBooks";
};
