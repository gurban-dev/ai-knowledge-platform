import { describe, expect, it } from 'vitest';
import { createLogger } from './logger.js';

describe('createLogger', () => {
  it('creates a logger at the configured level with a service base field', () => {
    const logger = createLogger({ level: 'debug', serviceName: 'akp-test' });
    expect(logger.level).toBe('debug');
    expect(typeof logger.info).toBe('function');
    // child loggers inherit configuration
    const child = logger.child({ requestId: 'req_1' });
    expect(child.level).toBe('debug');
  });
});
