import parser from './parser.ts';

export class ASTNode {
	type: string;
	name: string;
	nodes: ASTNode[];
	constructor(type: string, name: string, nodes?: ASTNode[]) {
		this.type = type;
		this.name = name;
		this.nodes = nodes ?? [];
	}
	toString() {
		return JSON.stringify(this);
	}
	clone(): ASTNode {
		return new ASTNode(
			this.type,
			this.name,
			this.nodes.map((x) => x.clone()),
		);
	}
}

class CstToAstVisitor extends parser.getBaseCstVisitorConstructor() {
	constructor() {
		super();
		this.validateVisitor();
	}
	proposition(ctx: any) {
		return this.visit(ctx.iffProposition[0]);
	}
	iffProposition(ctx: any) {
		const left = this.visit(ctx.impliesProposition[0]);
		if (!ctx.proposition) {
			return left;
		}
		const right = this.visit(ctx.proposition[0]);
		return new ASTNode('sym', '<>', [left, right]);
	}
	impliesProposition(ctx: any) {
		const left = this.visit(ctx.disjProposition[0]);
		if (!ctx.proposition) {
			return left;
		}
		const right = this.visit(ctx.proposition[0]);
		return new ASTNode('sym', '>', [left, right]);
	}
	disjProposition(ctx: any) {
		const left = this.visit(ctx.conjProposition[0]);
		if (!ctx.conjProposition[1]) {
			return left;
		}
		const right = ctx.conjProposition.map((x: any) => this.visit(x)) as any[];
		return right.reduce((prev, cur) => {
			return new ASTNode('sym', '|', [prev, cur]);
		});
	}
	conjProposition(ctx: any) {
		const left = this.visit(ctx.notProposition[0]);
		if (!ctx.notProposition[1]) {
			return left;
		}
		const right = ctx.notProposition.map((x: any) => this.visit(x)) as any[];
		return right.reduce((prev, cur) => {
			return new ASTNode('sym', '&', [prev, cur]);
		});
	}
	notProposition(ctx: any) {
		let notSymbols = ctx.Not?.length ?? 0;
		let visitResult = this.visit(ctx.forallProposition[0]);

		for (let i = 0; i < notSymbols; i++) {
			visitResult = new ASTNode('sym', '~', [visitResult]);
		}
		return visitResult;
	}
	belongToProposition(ctx: any) {
		if (ctx.BelongTo) {
			return new ASTNode('sym', '@', [
				this.visit(ctx.equalsProposition[0]),
				this.visit(ctx.equalsProposition[1]),
			]);
		}
		return this.visit(ctx.equalsProposition[0]);
	}
	equalsProposition(ctx: any) {
		if (ctx.Equals) {
			return new ASTNode('sym', '=', [
				this.visit(ctx.propositionLowest[0]),
				this.visit(ctx.propositionLowest[1]),
			]);
		}
		return this.visit(ctx.propositionLowest[0]);
	}
	propositionLowest(ctx: any) {
		if (ctx.proposition) {
			return this.visit(ctx.proposition[0]);
		}
		if (ctx.forallProposition) {
			return this.visit(ctx.forallProposition[0]);
		}
		return this.visit(ctx.replvar[0]);
	}
	forallProposition(ctx: any) {
		if (!ctx.replvar) {
			return this.visit(ctx.belongToProposition[0]);
		}
		return new ASTNode('sym', ctx.Forall ? 'V' : 'E', [
			this.visit(ctx.replvar[0]),
			this.visit(ctx.forallProposition[0]),
		]);
	}
	term(ctx: any) {
		return this.visit(ctx.termLowest[0]);
	}
	replvar(ctx: any) {
		return new ASTNode('replvar', ctx.Replvar[0].image);
	}
	termLowest(ctx: any) {
		if (!ctx.replvar) return this.visit(ctx.term[0]);
		return this.visit(ctx.replvar[0]);
	}
}

export { CstToAstVisitor };
