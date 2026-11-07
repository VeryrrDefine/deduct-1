import { ASTNode } from '../parser/compiler.ts';
import type { Deduction, DeductionStep, Proposition } from '../types/types';

export class Deserializer {
	deserializeASTNode(x: ASTNode): object {
		return JSON.parse(JSON.stringify(x));
	}
	deserializeDeductionStep(x: DeductionStep): object {
		return {
			conditionIdxs: x.conditionIdxs,
			deductionIdx: x.deductionIdx,
			replaceValues: Object.fromEntries(
				Object.entries(x.replaceValues).map((x) => [x[0], this.deserializeASTNode(x[1])]),
			),
		};
	}
	deserializeProposition(x: Proposition): object {
		return {
			value: this.deserializeASTNode(x.value),
			from: this.deserializeDeductionStep(x.from),
		};
	}
	deserializeDeduction(y: Deduction) {
		return {
			conditions: y.conditions.map((x) => this.deserializeASTNode(x)),
			conclusion: this.deserializeASTNode(y.conclusion),
			from: y.from,
			steps: y.steps ? y.steps.map((x) => this.deserializeDeductionStep(x)) : null,
		};
	}
	toASTNode(x: object): ASTNode {
		if ('nodes' in x && 'name' in x && 'type' in x) {
			if (typeof x.type !== 'string') throw new Error(`type is not string`);
			if (typeof x.name !== 'string') throw new Error(`name is not string`);
			if (!Array.isArray(x.nodes)) throw new Error(`node is not array`);
			return new ASTNode(
				x.type,
				x.name,
				x.nodes.map((x) => this.toASTNode(x)),
			);
		}
		throw new Error('properties has not nodes, name, type');
	}
	toDeductionStep(x: object): DeductionStep {
		if ('conditionIdxs' in x && 'deductionIdx' in x && 'replaceValues' in x) {
			if (!Array.isArray(x.conditionIdxs)) throw new Error(`conditionIdxs is not array`);
			if (typeof x.deductionIdx !== 'string') throw new Error(`deductionIdx is not string`);
			if (typeof x.replaceValues !== 'object' || x.replaceValues === null)
				throw new Error(`replaceValues is not object`);
			return {
				conditionIdxs: x.conditionIdxs,
				deductionIdx: x.deductionIdx,
				replaceValues: Object.fromEntries(
					Object.entries(x.replaceValues).map((x) => [x[0], this.toASTNode(x[1])]),
				),
			};
		}
		throw new Error('x has not conditionIdxs, deductionIdx, replaceValues');
	}
	toProposition(x: object): Proposition {
		if ('value' in x && 'from' in x) {
			if (typeof x.value !== 'object' || typeof x.from !== 'object')
				throw new Error(`value or from is not object`);
			if (x.value && x.from)
				return {
					value: this.toASTNode(x.value),
					from: this.toDeductionStep(x.from),
				};
			throw new Error(`value or from is null.`);
		}
		throw new Error(`x has not value, from`);
	}
	toDeduction(y: object): Deduction {
		if ('conditions' in y && 'conclusion' in y && 'from' in y && 'steps' in y) {
			if (!Array.isArray(y.conditions)) throw new Error(`y.conditions is not array`);
			if (typeof y.conclusion !== 'object' || y.conclusion === null)
				throw new Error(`y.conclusion is not object`);
			if (typeof y.from !== 'string') throw new Error(`y.from is not string`);
			if (!Array.isArray(y.steps)) throw new Error(`y.steps is not array`);

			return {
				conditions: y.conditions.map((x) => this.toASTNode(x)),
				conclusion: this.toASTNode(y.conclusion),
				from: y.from,
				steps: y.steps ? y.steps.map((x) => this.toDeductionStep(x)) : undefined,
			};
		}
		throw new Error(`y has not conditions, conclusion,from,steps`);
	}
}
