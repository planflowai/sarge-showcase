/**
 * Circuit Breaker Implementation
 *
 * Prevents repeated attempts to failing services.
 * States: CLOSED (normal) → OPEN (failing) → HALF_OPEN (testing recovery)
 */

enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Failing, reject immediately
  HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

interface CircuitMetrics {
  failures: number;
  successes: number;
  lastFailureTime: number;
  lastSuccessTime: number;
  state: CircuitState;
}

export class CircuitBreaker {
  private metrics: Map<string, CircuitMetrics> = new Map();

  constructor(
    private failureThreshold: number,
    private resetTimeoutMs: number,
    private halfOpenMaxAttempts: number
  ) {}

  /**
   * Check if request should be allowed
   * Returns true if allowed, false if circuit is open
   */
  canAttempt(key: string): boolean {
    const metrics = this.getMetrics(key);

    if (metrics.state === CircuitState.OPEN) {
      // Check if reset timeout has elapsed
      if (Date.now() - metrics.lastFailureTime >= this.resetTimeoutMs) {
        // Transition to HALF_OPEN
        metrics.state = CircuitState.HALF_OPEN;
        metrics.successes = 0;
        return true;
      }
      return false;
    }

    return true;
  }

  /**
   * Record successful request
   */
  recordSuccess(key: string): void {
    const metrics = this.getMetrics(key);
    metrics.successes++;
    metrics.lastSuccessTime = Date.now();

    if (metrics.state === CircuitState.HALF_OPEN) {
      // Sufficient successes in half-open state, close circuit
      if (metrics.successes >= this.halfOpenMaxAttempts) {
        metrics.state = CircuitState.CLOSED;
        metrics.failures = 0;
      }
    } else if (metrics.state === CircuitState.CLOSED) {
      // Reset failure count on success
      metrics.failures = 0;
    }
  }

  /**
   * Record failed request
   */
  recordFailure(key: string): void {
    const metrics = this.getMetrics(key);
    metrics.failures++;
    metrics.lastFailureTime = Date.now();

    if (metrics.state === CircuitState.HALF_OPEN) {
      // Failure in half-open state, back to open
      metrics.state = CircuitState.OPEN;
    } else if (metrics.state === CircuitState.CLOSED) {
      // Threshold exceeded, open circuit
      if (metrics.failures >= this.failureThreshold) {
        metrics.state = CircuitState.OPEN;
      }
    }
  }

  /**
   * Get current circuit state for a key
   */
  getState(key: string): CircuitState {
    return this.getMetrics(key).state;
  }

  private getMetrics(key: string): CircuitMetrics {
    if (!this.metrics.has(key)) {
      this.metrics.set(key, {
        failures: 0,
        successes: 0,
        lastFailureTime: 0,
        lastSuccessTime: 0,
        state: CircuitState.CLOSED
      });
    }
    return this.metrics.get(key)!;
  }

  /**
   * Reset circuit for a specific key
   */
  reset(key: string): void {
    this.metrics.delete(key);
  }

  /**
   * Get all circuit metrics (for debugging/monitoring)
   */
  getAllMetrics(): Map<string, CircuitMetrics> {
    return new Map(this.metrics);
  }
}
