// Browsers post Content-Security-Policy violations here while the policy is in report-only mode. They are
// logged for now; point this at an error-monitoring service when there is one.
export async function POST(request: Request) {
  const body = (await request.text().catch(() => "")).slice(0, 2000);
  console.warn(`[csp-report] ${body.replace(/\s+/g, " ")}`);
  return new Response(null, { status: 204 });
}
