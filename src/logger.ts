
import type { Env } from "./auth";

export class Logger {
    private isDebug: boolean;

    constructor(env: Env) {
        this.isDebug = env.DEBUG === "true" || env.DEBUG === "1";
    }

    debug(message: string, ...args: any[]) {
        if (this.isDebug) {
            console.log(`[DEBUG] ${message}`, ...args);
        }
    }

    info(message: string, ...args: any[]) {
        console.log(`[INFO] ${message}`, ...args);
    }

    warn(message: string, ...args: any[]) {
        console.warn(`[WARN] ${message}`, ...args);
    }

    error(message: string, ...args: any[]) {
        console.error(`[ERROR] ${message}`, ...args);
    }
}
