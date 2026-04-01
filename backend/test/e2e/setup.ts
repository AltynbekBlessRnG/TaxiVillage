function isIgnorableRedisCloseError(error: unknown) {
  const message = String((error as Error | undefined)?.message ?? error ?? '');
  return message.toLowerCase().includes('connection is closed');
}

process.on('unhandledRejection', (reason) => {
  if (isIgnorableRedisCloseError(reason)) {
    return;
  }
});

process.on('uncaughtException', (error) => {
  if (isIgnorableRedisCloseError(error)) {
    return;
  }
  throw error;
});
