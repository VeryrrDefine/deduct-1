import { ASTManager } from '../astmgr.ts';
import { fancyDisplay } from '../fancy.ts';
import { ASTNode } from '../parser/compiler.ts';
import { compileRules } from '../parser/index.ts';
import type { AssertionData, Deduction, DeductionStep, Proposition } from '../types/types.ts';
import { MetaruleGenerator } from './metarule.ts';

export class Workspace {
	propositions: Proposition[] = [];

	insertPropositionsBefore(props: Proposition[], index: number) {
		if (!Number.isInteger(index) || index < 0) {
			throw new Error(`index 必须是 >= 0 的整数，收到 ${index}`);
		}
		if (props.length === 0) return;
		if (index >= this.propositions.length) {
			this.propositions.push(...props);
			return;
		}
		for (let i = index; i < this.propositions.length; i++) {
			this.propositions[i].from.conditionIdxs = this.propositions[i].from.conditionIdxs.map(
				(x) => {
					if (x >= index) {
						return x + props.length;
					}
					return x;
				},
			);
		}
		this.propositions.splice(index, 0, ...props);
	}
	printWorkspace() {
		for (let i = 0; i < this.propositions.length; i++) {
			const prop = this.propositions[i];
			console.log(fancyDisplay(prop.value));
		}
	}
}
const RESERVED = new Set([
	'help',
	'exit',
	'serialize',
	'deserialize',
	'load',
	'parse',
	'match',
	'list',
	'export',
	'deduct',
	'hyp',
	'record',
	'verify',
	'clear',
]);

export class RuleManager {
	normalRules: [string, Deduction][] = compileRules([
		['mp', ['$0>$1', '$0'], '$1', [], '公理'],
		['a1', [], '$0>$1>$0', [], '公理'],
		['a2', [], '($0>$1>$2)>($0>$1)>$0>$2', [], '公理'],
		['a3', [], '(~$0>~$1)>$1>$0', [], '公理'],
		['d<>1', [], '($0<>$1)>~(($0>$1)>~($1>$0))', [], '逻辑符号定义'],
		['d<>2', [], '~(($0>$1)>~($1>$0))>($0<>$1)', [], '逻辑符号定义'],
		['d&', [], '($0&$1)<>~($0>~$1)', [], '逻辑符号定义'],
		['d|', [], '($0|$1)<>(~$0>$1)', [], '逻辑符号定义'],
	]).map((x) => (x.success ? x.data : (null as any)));
	preloads: [
		string,
		{
			variableNames: Set<string>;
			propositionNames: Set<string>;
		},
	][];
	constructor() {
		this.preloads = [];
	}
	metaruleSet: Set<string> = new Set();
	macros: string[] = [];
	preload() {
		const asserter = new ASTManager();
		for (const rule of this.normalRules) {
			const { termDifference, propDifference } = this.generatePayload(rule, asserter);
			this.preloads.push([
				rule[0],
				{
					variableNames: termDifference,
					propositionNames: propDifference,
				},
			]);
		}
	}
	generatePayload(rule: [string, Deduction], asserter: ASTManager = new ASTManager()) {
		const conditionData: AssertionData = {
			variableNames: new Set(),
			propositionNames: new Set(),
		};
		const conclusionData: AssertionData = {
			variableNames: new Set(),
			propositionNames: new Set(),
		};
		rule[1].conditions.forEach((x) =>
			asserter.check(x, conditionData, { astExpectedType: 'proposition' }, []),
		);
		asserter.check(rule[1].conclusion, conclusionData, { astExpectedType: 'proposition' }, []);
		const termDifference = conclusionData.variableNames.difference(conditionData.variableNames);
		const propDifference = conclusionData.propositionNames.difference(
			conditionData.propositionNames,
		);
		return { termDifference, propDifference };
	}
	async find(rulename: string, formal: FormalSystem) {
		let firstfind = this.normalRules.find((x) => x[0] == rulename);
		if (!firstfind) {
			console.log(`Try generating ${rulename}`);
			if (rulename.startsWith('<'))
				return [
					rulename,
					await new MetaruleGenerator().generateInvDeduct(rulename.slice(1), formal),
				] as [string, Deduction];
			if (rulename.startsWith('c'))
				return [
					rulename,
					await new MetaruleGenerator().generateCondDeduct(rulename.slice(1), formal),
				] as [string, Deduction];
		}
		return firstfind;
	}
}

export class FormalSystem {
	workspace: Workspace = new Workspace();
	rulemanager: RuleManager = new RuleManager();
	cacheList: string[] = [];
	async deduct(rulename: string, conditionIdxs: number[], playerMatchmap: Map<string, ASTNode>) {
		const asserter = new ASTManager();
		let rule = await this.rulemanager.find(rulename, this);
		if (!rule) {
			throw new Error(`Rule doesn't exists.`);
		}
		if (rule[1].conditions.length !== conditionIdxs.length) {
			throw new Error(`Conditions doesn't match rule's conditions.`);
		}
		// 1) 条件定理 -> 自动绑定（不要修改 conditionIdxs）
		const bindings: Record<string, ASTNode> = Object.create(null);
		for (let i = 0; i < conditionIdxs.length; i++) {
			const theoremID = conditionIdxs[i];
			const prop = this.workspace.propositions[theoremID];
			if (!prop) throw new Error(`Theorem ${theoremID} doesn't exists`);

			const errors: string[] = [];
			asserter.match(rule[1].conditions[i], bindings, prop.value, errors);
			if (errors.length) {
				throw new Error(
					`Condition ${i} (theorem #${theoremID}) mismatch:\n` +
						errors.map((e) => '* ' + e).join('\n'),
				);
			}
		}
		// 2) 合并玩家绑定，冲突检测
		for (const [k, v] of playerMatchmap) {
			if (Object.prototype.hasOwnProperty.call(bindings, k)) {
				const auto = bindings[k];
				if (!asserter.equals(auto, v)) {
					throw new Error(
						`Variable ${k} conflict: auto-bound to ${fancyDisplay(auto)}, ` +
							`but you gave ${fancyDisplay(v)}`,
					);
				}
				continue;
			}
			bindings[k] = v;
		}

		const data2: AssertionData = {
			propositionNames: new Set(),
			variableNames: new Set(),
		};
		// 4) 替换结论
		const result = asserter.executeReplace(
			rule[1].conclusion,
			Object.entries(bindings).map(([k, v]) => [new ASTNode('replvar', k), v]),
		);
		const errors: string[] = [];
		// 检查语法一致性
		asserter.check(result, data2, { astExpectedType: 'proposition' }, errors);
		if (errors.length !== 0) {
			throw new Error(`Generated proposition inconsistent: ${errors}`);
		}
		const from = {
			conditionIdxs: [...conditionIdxs], // 快照，避免调用者后续改动
			deductionIdx: rulename,
			replaceValues: { ...Object.fromEntries(playerMatchmap.entries()) },
		};
		const ws = { from, value: result } as Proposition;
		return [this.workspace.propositions.push(ws) - 1, ws] as [number, Proposition];
	}
	record(newrulename: string, skip = false, from = 'Recorded Macro') {
		if (!skip) {
			if (/^[0-9<>acdempuv#\.]/g.test(newrulename)) {
				throw new Error(`Recorded failed: reversed name.`);
			}
			if (/[\\\/:\*\?\:<>|]/g.test(newrulename)) {
				throw new Error(`Recorded failed: windows reversed characters.`);
			}
			if (this.rulemanager.normalRules.map((x) => x[0]).includes(newrulename)) {
				throw new Error(`Recorded failed: duplicate name.`);
			}
			if (RESERVED.has(newrulename))
				throw new Error(`Recorded failed: name collides with a command.`);
		}
		let sliceUntil = 0;
		while (
			sliceUntil < this.workspace.propositions.length &&
			this.workspace.propositions[sliceUntil].from.deductionIdx === 'hyp'
		)
			sliceUntil++;

		if (sliceUntil === this.workspace.propositions.length) {
			throw new Error(`Recorded failed: no derivation steps (only hypotheses).`);
		}

		const conditions = this.workspace.propositions.slice(0, sliceUntil).map((x) => x.value);
		const conclusion = this.workspace.propositions.at(-1);
		if (!conclusion) {
			throw new Error(`Recorded failed: empty conclusion.`);
		}
		const res: Deduction = {
			conditions,
			conclusion: conclusion.value,
			from: from,
			steps: this.workspace.propositions.slice(sliceUntil).map((x) => x.from),
		};

		this.rulemanager.normalRules.push([newrulename, res]);
		this.rulemanager.macros.push(newrulename);

		return res;
	}
}
