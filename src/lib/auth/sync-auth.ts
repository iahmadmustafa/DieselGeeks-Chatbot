export function isAuthorizedSyncRequest(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    return false;
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  const syncSecret = request.headers.get("x-sync-secret");
  return syncSecret === cronSecret;
}
