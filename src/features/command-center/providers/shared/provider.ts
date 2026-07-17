export interface BIProviderDependencies<TInput> {
  load: () => Promise<TInput> | TInput;
}

export interface BIProvider<TContract> {
  getContract: () => Promise<TContract>;
}

/**
 * Connects an injected data source to a pure adapter.
 * Loading and adaptation remain external, explicit dependencies.
 */
export function createBIProvider<TInput, TContract>(
  dependencies: BIProviderDependencies<TInput>,
  adapt: (input: TInput) => TContract,
): BIProvider<TContract> {
  return {
    async getContract() {
      const input = await dependencies.load();
      return adapt(input);
    },
  };
}
