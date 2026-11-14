import { range } from '../../utils/range.ts';
import { ASTManager } from '../astmgr.ts';
import { ASTNode } from '../parser/compiler.ts';
import { Workspace, type FormalSystem } from './formalsystem.ts';

export class MetaruleGenerator {
	async generateInvDeduct(baserulename: string, formal: FormalSystem) {
		const asserter = new ASTManager();
		const baseRule = await formal.rulemanager.find(baserulename, formal);
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
		const baseRule = await formal.rulemanager.find(baserulename, formal);
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
					const r = await formal.rulemanager.find(`c${steps.deductionIdx}`, formal);
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
	async generateDeduct(baserulename: string, formal: FormalSystem) {}
	static serializeName(rulename: string) {
		return encodeURIComponent(rulename).replaceAll('%', '#');
	}
	static deserializeName(rulename: string) {
		return decodeURIComponent(rulename.replaceAll('#', '%'));
	}
}
