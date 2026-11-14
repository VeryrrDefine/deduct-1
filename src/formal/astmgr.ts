/**
 * post-compiler.ts，检查AST的合法性
 */

import type { OK } from '../utils/ok';
import { ASTNode } from './parser/compiler.ts';
import { fancyDisplay } from './fancy.ts';
import type { AssertionData, AssertionData2, Deduction, MatchEntries } from './types/types.ts';

export class ASTManager {
	isConstant(replvarName: string) {
		if (/^\d+$/.test(replvarName)) return true;

		return false;
	}
	spreadError(x: string[], ...news: string[]) {
		x.push(...news);
		return news;
	}
	check(ast: ASTNode, out_data: AssertionData, data2: AssertionData2, spreadErrors: string[]) {
		if (data2.astExpectedType == 'pure-variable') {
			if (ast.type !== 'replvar') {
				return this.spreadError(
					spreadErrors,
					`Expected pure variable, but ${fancyDisplay(ast)}`,
				);
			}
			if (this.isConstant(ast.name)) {
				return this.spreadError(
					spreadErrors,
					`Expected pure variable, but ${fancyDisplay(ast)} is a constant.`,
				);
			}
		}
		if (ast.type === 'sym') {
			if (
				data2.astExpectedType == 'term' &&
				['V', '@', '&', '|', '>', '<>', '~', '='].includes(ast.name)
			) {
				return this.spreadError(
					spreadErrors,
					`Unexpected proposition symbol on term AST ${fancyDisplay(ast)}.`,
				);
			}
			if (ast.name == 'V' || ast.name == 'E') {
				this.check(
					ast.nodes[0],
					out_data,
					{ astExpectedType: 'pure-variable' },
					spreadErrors,
				);
				this.check(
					ast.nodes[1],
					out_data,
					{ astExpectedType: 'proposition' },
					spreadErrors,
				);
			}
			if (ast.name == '@' || ast.name == '=') {
				this.check(ast.nodes[0], out_data, { astExpectedType: 'term' }, spreadErrors);
				this.check(ast.nodes[1], out_data, { astExpectedType: 'term' }, spreadErrors);
			}
			if (['&', '|', '>', '<>', '~'].includes(ast.name)) {
				for (const node of ast.nodes) {
					this.check(node, out_data, { astExpectedType: 'proposition' }, spreadErrors);
				}
			}
		} else if (ast.type == 'replvar') {
			if (data2.astExpectedType == 'proposition') {
				if (out_data.variableNames.has(ast.name)) {
					return this.spreadError(
						spreadErrors,
						`The same name replvar ${ast.name} will be used both by proposition & [term].`,
					);
				}
				if (this.isConstant(ast.name)) {
					return this.spreadError(
						spreadErrors,
						`${ast.name} is a constant and cannot be used as a proposition.`,
					);
				}
				out_data.propositionNames.add(ast.name);
			} else {
				if (out_data.propositionNames.has(ast.name)) {
					return this.spreadError(
						spreadErrors,
						`The same name replvar ${ast.name} will be used both by [proposition] & term.`,
					);
				}
				if (!this.isConstant(ast.name)) {
					out_data.variableNames.add(ast.name);
				}
			}
		}
		return {
			errors: spreadErrors,
		};
	}
	equals(ast: ASTNode, ast2: ASTNode): boolean {
		if (ast.type !== ast2.type) return false;
		if (ast.name !== ast2.name) return false;
		if (ast.nodes.length !== ast2.nodes.length) return false;
		for (let i = 0; i < ast.nodes.length; i++) {
			if (!this.equals(ast.nodes[i], ast2.nodes[i])) return false;
		}
		return true;
	}
	collectReplvar(ast: ASTNode, out_set: Set<string>) {
		if (ast.type == 'replvar') {
			if (!this.isConstant(ast.name)) out_set.add(ast.name);

			return;
		}
		for (const node of ast.nodes) {
			this.collectReplvar(node, out_set);
		}
	}
	judgeReplvar(ast: ASTNode, scope: 'proposition' | 'term'): OK<AssertionData> {
		const outData = { variableNames: new Set<string>(), propositionNames: new Set<string>() };
		let errors: string[] = [];
		this.check(
			ast,
			outData,
			{
				astExpectedType: scope,
			},
			errors,
		);
		if (errors.length !== 0) return { success: false, reason: errors };
		return { success: true, data: outData };
	}
	cloneAST(x: ASTNode) {
		let z = new ASTNode(x.type, x.name, []);
		for (let i = 0; i < x.nodes.length; i++) {
			z.nodes.push(this.cloneAST(x.nodes[i]));
		}
		return z;
	}
	private _spreadReplace(ast: ASTNode, entries: MatchEntries) {
		let found = entries.findIndex((y) => this.equals(y[0], ast));
		if (found !== -1) {
			return entries[found][1];
		} else {
			for (let i = 0; i < ast.nodes.length; i++) {
				ast.nodes[i] = this._spreadReplace(ast.nodes[i], entries);
			}
		}

		return ast as ASTNode;
	}
	executeReplace(ast: ASTNode, entries: MatchEntries) {
		return this._spreadReplace(this.cloneAST(ast), entries);
	}
	match(object: ASTNode, replvarMap: Record<string, ASTNode>, ast: ASTNode, errors: string[]) {
		if (object.type === 'replvar' && object.name.startsWith('$')) {
			if (!replvarMap[object.name]) {
				replvarMap[object.name] = ast;
				return;
			} else if (!this.equals(replvarMap[object.name], ast)) {
				return this.spreadError(
					errors,
					`Matching failed[0]: Expected ${fancyDisplay(replvarMap[object.name])}, actual ${fancyDisplay(ast)}`,
				);
			} else {
				return;
			}
		}
		if (object.type !== ast.type)
			return this.spreadError(
				errors,
				`Matching failed[1]: ${fancyDisplay(object)} <==> ${fancyDisplay(ast)}`,
			);
		if (object.name !== ast.name)
			return this.spreadError(
				errors,
				`Matching failed[2]: ${fancyDisplay(object)} <==> ${fancyDisplay(ast)}`,
			);
		if (object.nodes.length !== ast.nodes.length)
			return this.spreadError(
				errors,
				`Matching failed[3]: ${fancyDisplay(object)} <==> ${fancyDisplay(ast)}`,
			);
		for (let i = 0; i < object.nodes.length; i++) {
			this.match(object.nodes[i], replvarMap, ast.nodes[i], errors);
		}
		return errors;
	}
	newReplvar(set: Set<string>): string {
		let i = 0;
		while (set.has(`$${i}`)) {
			i++;
		}

		return `$${i}`;
	}
	allReplvars(obj: Deduction) {
		const allData: AssertionData = {
			variableNames: new Set(),
			propositionNames: new Set(),
		};
		obj.conditions.forEach((x) =>
			this.check(x, allData, { astExpectedType: 'proposition' }, []),
		);
		this.check(obj.conclusion, allData, { astExpectedType: 'proposition' }, []);

		return new Set([...allData.propositionNames, ...allData.variableNames]);
	}
}

export const asserter = new ASTManager();
