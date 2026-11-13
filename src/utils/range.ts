export function range(min: number, max: number, step = 1) {
	const res: number[] = [];
	for (let i = min; i < max; i += step) {
		res.push(i);
	}
	return res;
}
