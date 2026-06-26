export async function register() {
  if (
    process.env.NEXT_RUNTIME === 'nodejs' && 
    process.env.IS_BUILDING !== '1'
  ) {
    const { startScheduler } = await import('./lib/scheduler');
    startScheduler();
  }
}
