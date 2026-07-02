/**
 * Base class for future application use cases.
 *
 * It defines a consistent execution flow while keeping validation and business
 * behavior in subclasses. No current ERP module extends this class in Sprint
 * 9.2.
 */
class BaseUseCase {
  /**
   * Executes the conceptual use case flow.
   *
   * @param {unknown} input
   * @param {Record<string, unknown>} [context]
   * @returns {Promise<unknown>}
   */
  async execute(input, context = {}) {
    try {
      await this.beforeExecute(input, context);
      await this.validate(input, context);
      const result = await this.run(input, context);
      await this.afterExecute(result, input, context);
      return result;
    } catch (error) {
      return this.onError(error, input, context);
    }
  }

  /**
   * @param {unknown} _input
   * @param {Record<string, unknown>} _context
   * @returns {Promise<void>}
   */
  async beforeExecute(_input, _context) {}

  /**
   * @param {unknown} _input
   * @param {Record<string, unknown>} _context
   * @returns {Promise<void>}
   */
  async validate(_input, _context) {}

  /**
   * @param {unknown} _input
   * @param {Record<string, unknown>} _context
   * @returns {Promise<unknown>}
   */
  async run(_input, _context) {
    return undefined;
  }

  /**
   * @param {unknown} _result
   * @param {unknown} _input
   * @param {Record<string, unknown>} _context
   * @returns {Promise<void>}
   */
  async afterExecute(_result, _input, _context) {}

  /**
   * @param {unknown} error
   * @param {unknown} _input
   * @param {Record<string, unknown>} _context
   * @returns {Promise<never>}
   */
  async onError(error, _input, _context) {
    throw error;
  }
}

module.exports = {
  BaseUseCase,
};
