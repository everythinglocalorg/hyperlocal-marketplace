import type { AuthError } from "@supabase/supabase-js";

// Maps Supabase auth error codes to messages a non-technical user can act on.
export function friendlyAuthError(error: AuthError): string {
  switch (error.code) {
    case "email_address_invalid":
      return "That email address was rejected. Double-check it for typos and try again.";
    case "invalid_credentials":
      return "Incorrect email or password. If you signed up with Google, use “Continue with Google” instead.";
    case "email_not_confirmed":
      return "Your email hasn't been confirmed yet. Check your inbox (and spam folder) for the confirmation link.";
    case "user_already_exists":
    case "email_exists":
      return "An account with this email already exists — try logging in instead.";
    case "weak_password":
      return "That password is too weak — use at least 8 characters.";
    case "over_email_send_rate_limit":
      return "We've sent too many emails to this address recently. Wait a few minutes and try again.";
    case "over_request_rate_limit":
      return "Too many attempts right now. Wait a minute and try again.";
    case "signup_disabled":
      return "New signups are temporarily disabled. Please try again later.";
    default:
      return error.message;
  }
}
