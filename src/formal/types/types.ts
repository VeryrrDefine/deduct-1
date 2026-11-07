import type { ASTManager } from '../astmgr';
import type { ASTNode } from '../parser/compiler';

export type DeductionStep = {
	conditionIdxs: number[];
	deductionIdx: string;
	replaceValues: Record<string, ASTNode>;
};
export type Proposition = {
	value: ASTNode;
	from: DeductionStep;
};

export type Deduction = {
	conditions: ASTNode[];
	conclusion: ASTNode;
	from: string;
	steps?: DeductionStep[];
};

export type AssertionData = {
	variableNames: Set<string>;
	propositionNames: Set<string>;
};

export type AssertionData2 = {
	astExpectedType: 'proposition' | 'term' | 'pure-variable';
};

export type MatchEntries = [ASTNode, ASTNode][];
