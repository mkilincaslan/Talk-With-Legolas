type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogMessage {
  timestamp: string;
  level: LogLevel;
  message: string;
  requestId?: string;
  [key: string]: unknown;
}

class Logger {
  private formatMessage(
    level: LogLevel,
    message: string,
    requestId?: string,
    meta?: Record<string, unknown>,
  ): LogMessage {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      requestId,
      ...meta,
    };
  }

  private log(
    level: LogLevel,
    message: string,
    requestId?: string,
    meta?: Record<string, unknown>,
  ) {
    const logMessage = this.formatMessage(level, message, requestId, meta);
    console.log(JSON.stringify(logMessage));
  }

  info(message: string, requestId?: string, meta?: Record<string, unknown>) {
    this.log('info', message, requestId, meta);
  }

  warn(message: string, requestId?: string, meta?: Record<string, unknown>) {
    this.log('warn', message, requestId, meta);
  }

  error(message: string, requestId?: string, meta?: Record<string, unknown>) {
    this.log('error', message, requestId, meta);
  }

  debug(message: string, requestId?: string, meta?: Record<string, unknown>) {
    if (process.env.NODE_ENV !== 'production') {
      this.log('debug', message, requestId, meta);
    }
  }
}

export const logger = new Logger();

export const createRequestLogger = (requestId: string) => {
  return {
    info: (message: string, meta?: Record<string, unknown>) =>
      logger.info(message, requestId, meta),
    warn: (message: string, meta?: Record<string, unknown>) =>
      logger.warn(message, requestId, meta),
    error: (message: string, meta?: Record<string, unknown>) =>
      logger.error(message, requestId, meta),
    debug: (message: string, meta?: Record<string, unknown>) =>
      logger.debug(message, requestId, meta),
  };
};
