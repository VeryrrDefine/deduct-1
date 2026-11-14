import { asserter } from './astmgr.ts';
import { ASTNode } from './parser/compiler.ts';
import type { AssertionData, DeductionStep, Proposition } from './types/types.ts';
import { blue, green, italic, red } from './colourize.ts';

function braceadd(x: string, brace = 0) {
	if (brace == 1) return `(${x})`;
	return x;
}

export function renderAST(
	x: ASTNode,
	brace = 0,
	out_data: AssertionData = {
		variableNames: new Set(),
		propositionNames: new Set(),
	},
): string {
	if (out_data.variableNames.size == 0 && out_data.propositionNames.size == 0) {
		asserter.check(
			x,
			out_data,
			{
				astExpectedType: 'proposition',
			},
			[],
		);
	}

	if (x.type == 'sym') {
		if (['<>', '>', '|', '&', '@', '='].includes(x.name)) {
			return braceadd(
				`${renderAST(x.nodes[0], 1, out_data)} ${blue(x.name)} ${renderAST(x.nodes[1], 1, out_data)}`,
				brace,
			);
		}
		if (x.name == '~') {
			return `~${renderAST(x.nodes[0], 1, out_data)}`;
		}
		if (x.name == 'V') {
			return braceadd(
				`${blue('\\a')} ${renderAST(x.nodes[0], 1, out_data)}: ${renderAST(x.nodes[1], 1, out_data)}`,
				brace,
			);
		}
		if (x.name == 'E') {
			return braceadd(
				`${blue('\\e')} ${renderAST(x.nodes[0], 1, out_data)}: ${renderAST(x.nodes[1], 1, out_data)}`,
				brace,
			);
		}
	}
	if (x.type == 'replvar') {
		const name = out_data.variableNames.has(x.name) ? italic(x.name) : x.name;
		return x.name.startsWith('$') ? green(name) : name;
	}
	return '???';
}

export function displayProposition(x: Proposition, index: number) {
	const rule = red(x.from.deductionIdx);
	const conds = x.from.conditionIdxs.length ? ' ' + green(x.from.conditionIdxs.join(',')) : '';
	return `[${index}] ${renderAST(x.value)}    ${rule}${conds}`;
}
export function displayDeductionStep(x: DeductionStep, index: number) {
	const rule = red(x.deductionIdx);
	const conds = x.conditionIdxs.length ? ' ' + green(x.conditionIdxs.join(',')) : '';
	return `[${index}] ?????    ${rule}${conds}`;
}

export function fancyDisplay(x: unknown, brace = 0, out?: AssertionData): string {
	// 1. 空值安全
	if (x == null) return String(x);
	// 2. unwrap {result: ASTNode}
	if (typeof x === 'object' && !Array.isArray(x) && (x as any).result instanceof ASTNode) {
		return fancyDisplay((x as any).result, brace, out);
	}
	// 3. 数组
	if (Array.isArray(x)) {
		return x
			.map((e) => '* ' + (e instanceof ASTNode ? renderAST(e, 0, out) : String(e)))
			.join('\n');
	}
	// 4. ASTNode
	if (x instanceof ASTNode) return renderAST(x, brace, out);
	// 5. 兜底
	try {
		return JSON.stringify(x);
	} catch {
		return String(x);
	}
}
