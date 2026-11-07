import type { OK } from '../../utils/ok.ts';
import { asserter } from '../astmgr.ts';
import { ASTNode, CstToAstVisitor } from '../parser/compiler.ts';
import PropositionLexer from '../parser/lexer.ts';
import { PropositionParser } from '../parser/parser.ts';
import type { AssertionData, Deduction } from '../types/types.ts';

export function compileProposition(
	b: string,
	type: 'proposition' | 'term' = 'proposition',
): OK<{ result: ASTNode; spreadDatas: AssertionData }> {
	const tokenResult = PropositionLexer.tokenize(b);
	if (tokenResult.errors.length != 0)
		return { success: false, reason: tokenResult.errors.map((x) => x.message) as string[] };
	const parser = new PropositionParser();
	parser.input = tokenResult.tokens;

	const parserResult = type == 'proposition' ? parser.proposition() : parser.term();
	if (parser.errors.length != 0)
		return { success: false, reason: parser.errors.map((x) => x.toString()) as string[] };
	const visitor = new CstToAstVisitor();
	const visitorResult = visitor.visit(parserResult) as ASTNode;
	const errors = [] as any[];
	const spreadDatas = { variableNames: new Set<string>(), propositionNames: new Set<string>() };
	const assertResult = asserter.check(
		visitorResult,
		spreadDatas,
		{ astExpectedType: type },
		errors,
	);

	if (errors.length !== 0) return { success: false, reason: errors as string[] };
	return {
		success: true,
		data: {
			result: visitorResult,
			spreadDatas,
		},
	};
}

export function compileRules(
	x: [string, string[], string, [string, Record<string, string>, number[]][], string][],
): OK<[string, Deduction]>[] {
	let result: OK<[string, Deduction]>[] = [];

	for (const rules of x) {
		let conclusion = compileProposition(rules[2]);
		if (!conclusion.success) {
			result.push({
				success: false,
				reason: conclusion.reason,
			});
			continue;
		}
		let conditions = rules[1].map((x) => compileProposition(x));
		if (conditions.filter((x) => !x.success).length !== 0) {
			result.push({
				success: false,
				reason: conditions.filter((x) => !x.success)[0].reason,
			});
			continue;
		}
		result.push({
			success: true,
			data: [
				rules[0],
				{
					conclusion: conclusion.data.result,
					conditions: (
						conditions as {
							success: true;
							data: { result: ASTNode; spreadDatas: AssertionData };
						}[]
					).map((x) => x.data.result),
					from: rules[4],
					steps: [],
				},
			],
		});
	}
	return result;
}
