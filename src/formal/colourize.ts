export function colorEnabled(): boolean {
	if (process.env.NO_COLOR) return false;
	if (process.env.FORCE_COLOR === '0') return false;
	if (process.env.FORCE_COLOR === '1') return true;
	return !!process.stdout.isTTY;
}

function wrap(code: number, s: string): string {
	return colorEnabled() ? `\x1b[${code}m${s}\x1b[0m` : s;
}

export const red = (s: string) => wrap(31, s);
export const green = (s: string) => wrap(32, s);
export const blue = (s: string) => wrap(34, s);
export const cyan = (s: string) => wrap(36, s);
export const italic = (s: string) => wrap(3, s);
