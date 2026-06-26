export async function register() {
  const isBuild = process.argv.includes('build') || process.env.npm_lifecycle_event === 'build';
  if (
    process.env.NEXT_RUNTIME === 'nodejs' && 
    !isBuild
  ) {
    const { startScheduler } = await import('./lib/scheduler');
    startScheduler();
  }
}
