export const SESSION_COOKIE = "trestle_token";

// Sections a signed-out visitor may open; every other page needs a session.
export const PUBLIC_SECTIONS = new Set(["login", "signup", "forgot-password", "reset-password"]);
