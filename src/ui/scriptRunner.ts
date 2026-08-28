import type { Board } from "../vm/board";

export type ScriptContext = {
  board: Board;
  devices: Record<string, any>;
};

export type ScriptExample = {
  id: string;
  title: string;
  description: string;
  code: string;
};

type MainFn = (ctx: ScriptContext) => void | Promise<void>;

export class ScriptRunner {
  private currentAbort: AbortController | null = null;

  stop(): void {
    this.currentAbort?.abort();
    this.currentAbort = null;
  }

  async run(code: string, ctx: ScriptContext): Promise<void> {
    this.stop();
    const abort = new AbortController();
    this.currentAbort = abort;

    const wrapped = `"use strict";\n${code}\n;return (typeof main === 'function') ? main : null;`;
    const getMain = new Function(wrapped) as () => MainFn | null;
    const main = getMain();
    if (!main) throw new Error("Script must export function: main(ctx)");

    ctx.board.setAbortSignal(abort.signal);
    await main(ctx);
  }
}

