import { CstParser } from 'chevrotain';
import {
	allTokens,
	BelongTo,
	Colon,
	Conjunction,
	Disjunction,
	Equals,
	Exists,
	Forall,
	LeftRightarrow,
	LParen,
	Not,
	Replvar,
	Rightarrow,
	RParen,
} from './lexer.ts';
class PropositionParser extends CstParser {
	constructor() {
		super(allTokens);

		this.performSelfAnalysis();
	}

	public proposition = this.RULE('proposition', () => {
		this.OR([{ ALT: () => this.SUBRULE(this.iffProposition) }]);
	});
	public iffProposition = this.RULE('iffProposition', () => {
		this.SUBRULE(this.impliesProposition);
		this.OPTION(() => {
			this.CONSUME(LeftRightarrow);
			this.SUBRULE(this.proposition);
		});
	});
	public impliesProposition = this.RULE('impliesProposition', () => {
		this.SUBRULE(this.disjProposition);
		this.OPTION(() => {
			this.CONSUME(Rightarrow);
			this.SUBRULE(this.proposition);
		});
	});
	public disjProposition = this.RULE('disjProposition', () => {
		this.SUBRULE(this.conjProposition);
		this.MANY(() => {
			this.CONSUME(Disjunction);
			this.SUBRULE2(this.conjProposition);
		});
	});
	public conjProposition = this.RULE('conjProposition', () => {
		this.SUBRULE(this.notProposition);
		this.MANY(() => {
			this.CONSUME(Conjunction);
			this.SUBRULE2(this.notProposition);
		});
	});
	public notProposition = this.RULE('notProposition', () => {
		this.MANY(() => {
			this.CONSUME(Not);
		});
		this.SUBRULE(this.forallProposition);
	});
	public forallProposition = this.RULE('forallProposition', () => {
		this.OR3([
			{
				ALT: () => {
					this.OR1([
						{
							ALT: () => {
								this.CONSUME(Forall);
							},
						},
						{
							ALT: () => {
								this.CONSUME(Exists);
							},
						},
					]);
					this.SUBRULE(this.replvar);
					this.OPTION(() => this.CONSUME(Colon));
					this.SUBRULE(this.forallProposition);
				},
			},
			{
				ALT: () => {
					this.SUBRULE(this.belongToProposition);
				},
			},
		]);
	});
	public belongToProposition = this.RULE('belongToProposition', () => {
		this.SUBRULE(this.equalsProposition);
		this.OPTION(() => {
			this.CONSUME(BelongTo);
			this.SUBRULE2(this.equalsProposition);
		});
	});
	public equalsProposition = this.RULE('equalsProposition', () => {
		this.SUBRULE(this.propositionLowest);
		this.OPTION(() => {
			this.CONSUME(Equals);
			this.SUBRULE2(this.propositionLowest);
		});
	});
	public propositionLowest = this.RULE('propositionLowest', () => {
		this.OR([
			{ ALT: () => this.SUBRULE(this.replvar) },
			{
				ALT: () => {
					this.CONSUME(LParen);
					this.SUBRULE(this.proposition);
					this.CONSUME(RParen);
				},
			},
		]);
	});

	public term = this.RULE('term', () => {
		this.SUBRULE(this.termLowest);
	});
	public termLowest = this.RULE('termLowest', () => {
		this.OR([
			{
				ALT: () => {
					this.CONSUME(LParen);
					this.SUBRULE(this.term);
					this.CONSUME(RParen);
				},
			},
		]);
	});
	public replvar = this.RULE('replvar', () => {
		this.CONSUME(Replvar);
	});
}

export default new PropositionParser();
export { PropositionParser };
