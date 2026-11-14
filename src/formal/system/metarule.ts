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

		const b = formal.deduct(
			baserulename,
			range(0, newConditions.length - 1),
			new Map(
				[...payload.propDifference.entries(), ...payload.termDifference.entries()].map(
					(x) => [x[0], new ASTNode('replvar', x[1], [])],
				),
			),
		);
		formal.deduct('mp', [b[0], conditionIdx], new Map());

		const res = formal.record(`<${baserulename}`, true, 'Auto Generated Macro');
		formal.rulemanager.metaruleSet.add(`<${baserulename}`);
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
