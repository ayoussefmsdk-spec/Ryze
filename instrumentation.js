// Runs once when the server boots — starts the in-process check scheduler.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startScheduler } = await import('./lib/scheduler.mjs');
    startScheduler();
  }
}
