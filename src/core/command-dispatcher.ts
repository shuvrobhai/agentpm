import * as p from '@clack/prompts';

export interface ActionContext {
  isTTY: boolean;
  log(message: string): void;
  error(message: string): void;
  promptSelect<T extends string>(options: { message: string; options: { value: T; label: string }[] }): Promise<T | null>;
  promptMultiSelect<T extends string>(options: { message: string; options: { value: T; label: string }[] }): Promise<T[] | null>;
}

export type ActionHandler<T extends any[]> = (
  ctx: ActionContext,
  ...args: T
) => Promise<void>;

export function createDispatcher<T extends any[]>(
  handler: ActionHandler<T>
): (...args: T) => Promise<void> {
  return async (...args: T) => {
    const isTTY = Boolean(process.stdin.isTTY);

    const ctx: ActionContext = {
      isTTY,
      log(message: string) {
        console.log(message);
      },
      error(message: string) {
        console.error(message);
      },
      async promptSelect<TVal extends string>(options: { message: string; options: { value: TVal; label: string }[] }) {
        if (!isTTY) return null;
        const result = await p.select({
          message: options.message,
          options: options.options as any,
        });
        if (p.isCancel(result) || !result) return null;
        return result as TVal;
      },
      async promptMultiSelect<TVal extends string>(options: { message: string; options: { value: TVal; label: string }[] }) {
        if (!isTTY) return null;
        const result = await p.multiselect({
          message: options.message,
          options: options.options as any,
        });
        if (p.isCancel(result) || !result || (result as TVal[]).length === 0) return null;
        return result as TVal[];
      },
    };

    try {
      await handler(ctx, ...args);
    } catch (err: any) {
      console.error(`Error: ${err.message || err}`);
      process.exitCode = 1;
    }
  };
}
