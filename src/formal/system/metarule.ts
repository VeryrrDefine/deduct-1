import { range } from '../../utils/range.ts';
import { ASTManager } from '../astmgr.ts';
import { ASTNode } from '../parser/compiler.ts';
import type { Proposition } from '../types/types.ts';
import { Workspace, type FormalSystem } from './formalsystem.ts';

export class MetaruleGenerator {
	async generateInvDeduct(baserulename: string, formal: FormalSystem) {
		const asserter = new ASTManager();
		const baseRule = await formal.find(baserulename);
		if (!baseRule) throw new Error(`Base rule doesn't exists.`);

		// Only accepts (x0,x1,x2,...|-y0->y1)
		const conclusion = baseRule[1].conclusion;
		if (conclusion.type !== 'sym' || conclusion.name !== '>') {
			throw new Error(`Conclusion is not A->B`);
		}

		const newConditions = baseRule[1].conditions.map((x) => asserter.cloneAST(x));
		const conditionIdx = newConditions.push(conclusion.nodes[0]) - 1;

		const a = formal.workspace;

		formal.workspace = new Workspace();
		formal.workspace.insertPropositionsBefore(
			newConditions.map((x) => {
				return {
					value: x,
					from: {
						deductionIdx: 'hyp',
						conditionIdxs: [],
						replaceValues: {},
					},
				};
			}),
			0,
		);

		let payload = formal.rulemanager.generatePayload(baseRule, asserter);

		const b = await formal.deduct(
			baserulename,
			range(0, newConditions.length - 1),
			new Map(
				[...payload.propDifference.entries(), ...payload.termDifference.entries()].map(
					(x) => [x[0], new ASTNode('replvar', x[1], [])],
				),
			),
		);
		await formal.deduct('mp', [b[0], conditionIdx], new Map());

		const res = formal.record(`<${baserulename}`, true, 'Auto Generated Macro', true);
		formal.rulemanager.metaruleSet.add(`<${baserulename}`);
		formal.workspace = a;

		return res;
	}
	async generateCondDeduct(baserulename: string, formal: FormalSystem) {
		const asserter = new ASTManager();
		const baseRule = await formal.find(baserulename);
		if (!baseRule) throw new Error(`Base rule doesn't exists.`);

		const conclusion = baseRule[1].conclusion;

		const newReplvarName = asserter.newReplvar(asserter.allReplvars(baseRule[1]));

		const newConditions = baseRule[1].conditions.map(
			(y) =>
				new ASTNode('sym', '>', [
					new ASTNode('replvar', newReplvarName, []),
					asserter.cloneAST(y),
				]),
		);

		let payload = formal.rulemanager.generatePayload(baseRule, asserter);
		const a = formal.workspace;

		formal.workspace = new Workspace();
		formal.workspace.insertPropositionsBefore(
			newConditions.map((x) => {
				return {
					value: x,
					from: {
						deductionIdx: 'hyp',
						conditionIdxs: [],
						replaceValues: {},
					},
				};
			}),
			0,
		);

		if (newConditions.length == 0) {
			const b = await formal.deduct(
				baserulename,
				[],
				new Map(
					[...payload.propDifference.entries(), ...payload.termDifference.entries()].map(
						(x) => [x[0], new ASTNode('replvar', x[1], [])],
					),
				),
			);
			await formal.deduct(
				'<a1',
				[b[0]],
				new Map([['$1', new ASTNode('replvar', newReplvarName)]]),
			);
		} else {
			if (baserulename == 'mp') {
				await formal.deduct('<<a2', [0, 1], new Map());
			} else {
				// 递归运行
				// 对每个规则添加上c,可能有一些规则在payload后有c，这时候就把c加到maps里
				if (!baseRule[1].steps) {
					throw new Error(`An axiom with condition?`);
				}
				for (const steps of baseRule[1].steps) {
					const replmap = new Map(Object.entries(steps.replaceValues));
					const r = await formal.find(`c${steps.deductionIdx}`);
					if (!r) throw new Error(`Generate c${steps.deductionIdx} failed.`);

					const pyld = formal.rulemanager.generatePayload(r);

					const q = r[1].conclusion.nodes[0].name;
					if (pyld.propDifference.has(q))
						replmap.set(q, new ASTNode('replvar', newReplvarName));
					await formal.deduct(`c${steps.deductionIdx}`, steps.conditionIdxs, replmap);
				}
			}
		}

		const res = formal.record(`c${baserulename}`, true, 'Auto Generated Macro', true);
		formal.rulemanager.metaruleSet.add(`c${baserulename}`);
		formal.workspace = a;

		return res;
	}
	async generateDeduct(baserulename: string, formal: FormalSystem) {
		const asserter = new ASTManager();
		const baseRule = await formal.find(baserulename);
		if (!baseRule) throw new Error(`Base rule doesn't exists.`);

		if (baseRule[1].conditions.length == 0) throw new Error(`No conditions.`);

		const conclusion = baseRule[1].conclusion;

		const orgConditionLength = baseRule[1].conditions.length;

		const newConditions = baseRule[1].conditions.slice(0, baseRule[1].conditions.length - 1);

		let payload = formal.rulemanager.generatePayload(baseRule, asserter);
		const a = formal.workspace;
		formal.workspace = new Workspace();
		formal.workspace.insertPropositionsBefore(
			newConditions.map((x) => {
				return {
					value: x,
					from: {
						deductionIdx: 'hyp',
						conditionIdxs: [],
						replaceValues: {},
					},
				};
			}),
			0,
		);

		const baseRule2 = baseRule;
		const lastHyp = baseRule[1].conditions.at(-1)!;

		/**
		 * 每一个证明步骤(包括假设)的到lastHyp->结论的映射
		 */
		const stepToCondIdx: Map<number, number> = new Map();

		async function genStep(
			originIndex: number,
			formal: FormalSystem,
		): Promise<[number, Proposition]> {
			console.log(`genStep(${originIndex})`);
			const check = stepToCondIdx.get(originIndex);
			if (check !== undefined) {
				return [check, formal.workspace.propositions[check]];
			}
			/**
			 * 原规则的一个证明过程
			 */
			const originStep = baseRule2[1].steps![originIndex - baseRule2[1].conditions.length];

			// 如果这个证明过程是假设（尝试读取假设越界到负数）
			if (originIndex - baseRule2[1].conditions.length < 0) {
				// 如果原证明过程是lastHyp
				if (originIndex === orgConditionLength - 1) {
					// 这里应该要用一个宏$0>$0代替
					const deduction1 = await formal.deduct(
						'a1',
						[],
						new Map([
							['$0', lastHyp],
							['$1', lastHyp],
						]),
					);
					const deduction2 = await formal.deduct(
						'a1',
						[],
						new Map([
							['$0', lastHyp],
							['$1', new ASTNode('sym', '>', [lastHyp, lastHyp])],
						]),
					);
					const deduction3 = await formal.deduct(
						'cmp',
						[deduction2[0], deduction1[0]],
						new Map(),
					);
					stepToCondIdx.set(originIndex, deduction3[0]);
					return deduction3;
				} else {
					const deduction = await formal.deduct(
						'<a1',
						[originIndex],
						new Map([['$1', lastHyp]]),
					);
					stepToCondIdx.set(originIndex, deduction[0]);
					return deduction;
				}
			}

			// 使用了规则的定理
			// 例如 .??? [一个假设,lastHypIdx,证明过程]
			// 这时候就转换成 c.??? [....].map(genStep...);
			// c.???会多出来一个占位符，替换成lastHyp

			const conditionRule = await formal.find(`c${originStep.deductionIdx}`);

			if (!conditionRule) throw new Error(`Deduction failed: c${originStep.deductionIdx}`);

			const condRuleWildcard = conditionRule[1].conclusion.nodes[0];
			const originalMap = Object.entries(originStep.replaceValues);
			const conditionIdxsnew: number[] = [];
			for (let i = 0; i < originStep.conditionIdxs.length; i++) {
				conditionIdxsnew.push((await genStep(originStep.conditionIdxs[i], formal))[0]);
			}
			const deduction = await formal.deduct(
				`c${originStep.deductionIdx}`,
				conditionIdxsnew,
				new Map([...originalMap, [condRuleWildcard.name, lastHyp]]),
			);

			stepToCondIdx.set(originIndex, deduction[0]);

			return deduction;
		}
		for (let i = 0; i < baseRule[1].steps!.length; i++) {
			await genStep(i + baseRule2[1].conditions.length, formal);
		}

		const res = formal.record(`>${baserulename}`, true, 'Auto Generated Macro', true);
		formal.rulemanager.metaruleSet.add(`>${baserulename}`);
		formal.workspace = a;

		return res;
	}
	static serializeName(rulename: string) {
		return encodeURIComponent(rulename).replaceAll('%', '#');
	}
	static deserializeName(rulename: string) {
		return decodeURIComponent(rulename.replaceAll('#', '%'));
	}
}
