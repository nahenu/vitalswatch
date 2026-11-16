/** Turn Better Auth errors into messages a person can act on. */
export function authErrorMessage(error: { status?: number; code?: string; message?: string } | null | undefined): string {
  if (!error) return "Something went wrong. Please try again.";
  if (error.status === 429) return "Too many attempts. Wait a minute, then try again.";
  switch (error.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "That email and password don't match.";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "An account with this email already exists.";
    case "PASSWORD_TOO_SHORT":
      return "Use at least 8 characters.";
    case "PASSWORD_TOO_LONG":
      return "That password is too long.";
    case "INVALID_EMAIL":
      return "Enter a valid email address.";
    case "INVALID_TOKEN":
      return "This reset link has expired or was already used.";
  }
  if (error.status === 401) return "That email and password don't match.";
  if (!error.status) return "Couldn't reach VitalsWatch. Check your connection and try again.";
  return error.message || "Something went wrong. Please try again.";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function emailError(email: string): string | null {
  if (!email.trim()) return "Enter your email address.";
  return EMAIL_RE.test(email.trim()) ? null : "That doesn't look like an email address.";
}

export function newPasswordError(password: string): string | null {
  if (!password) return "Choose a password.";
  if (password.length < 8) return `Use at least 8 characters (${8 - password.length} more).`;
  if (password.length > 128) return "Use at most 128 characters.";
  return null;
}
