export class ScriptRunner {
    constructor() {
        this.currentAbort = null;
    }
    stop() {
        this.currentAbort?.abort();
        this.currentAbort = null;
    }
    async run(code, ctx) {
        this.stop();
        const abort = new AbortController();
        this.currentAbort = abort;
        const wrapped = `"use strict";\n${code}\n;return (typeof main === 'function') ? main : null;`;
        const getMain = new Function(wrapped);
        const main = getMain();
        if (!main)
            throw new Error("Script must export function: main(ctx)");
        ctx.board.setAbortSignal(abort.signal);
        await main(ctx);
    }
}
