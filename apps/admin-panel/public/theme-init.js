// Applies the saved theme before the first paint, so a dark-mode user never sees a light flash. It is a file
// rather than an inline script so the Content-Security-Policy can require scripts to come from this origin.
try {
  if (localStorage.getItem("trestle-admin-theme") === "dark") document.documentElement.classList.add("dark");
} catch (e) {}
