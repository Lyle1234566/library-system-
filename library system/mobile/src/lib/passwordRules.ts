export type PasswordRequirementId = "length" | "number" | "special";

type PasswordRequirementDefinition = {
  id: PasswordRequirementId;
  label: string;
  test: (value: string) => boolean;
};

export type PasswordRequirementState = {
  id: PasswordRequirementId;
  label: string;
  met: boolean;
};

const PASSWORD_REQUIREMENT_DEFINITIONS: PasswordRequirementDefinition[] = [
  {
    id: "length",
    label: "At least 8 characters",
    test: (value) => value.length >= 8,
  },
  {
    id: "number",
    label: "Contains a number",
    test: (value) => /\d/.test(value),
  },
  {
    id: "special",
    label: "Contains a special character",
    test: (value) => /[^A-Za-z0-9\s]/.test(value),
  },
];

export const PASSWORD_REQUIREMENTS_SUMMARY =
  "Use at least 8 characters, 1 number, and 1 special character.";

export function getPasswordRequirements(value: string): PasswordRequirementState[] {
  return PASSWORD_REQUIREMENT_DEFINITIONS.map((requirement) => ({
    id: requirement.id,
    label: requirement.label,
    met: requirement.test(value),
  }));
}

export function isValidPassword(value: string): boolean {
  return getPasswordRequirements(value).every((requirement) => requirement.met);
}

export function getPasswordValidationMessage(subject = "Password"): string {
  return `${subject} must be at least 8 characters and include at least 1 number and 1 special character.`;
}
