import { createToken, Lexer } from 'chevrotain';
export const Replvar = createToken({
	name: 'Replvar',
	pattern: /[a-zA-Z0-9$#][a-zA-Z0-9_$#]*/,
});

export const LeftRightarrow = createToken({
	name: 'LeftRightarrow',
	pattern: /<>|↔/,
});
export const Rightarrow = createToken({
	name: 'Rightarrow',
	pattern: />|→/,
});

export const LParen = createToken({ name: 'LParen', pattern: /\(/ });
export const RParen = createToken({ name: 'RParen', pattern: /\)/ });
export const Not = createToken({ name: 'Not', pattern: /~|¬/ });

export const Comma = createToken({ name: 'Comma', pattern: /,/ });
export const Disjunction = createToken({ name: 'Disjunction', pattern: /∨|\|/ });
export const Conjunction = createToken({ name: 'Conjunction', pattern: /∧|&/ });
export const Forall = createToken({ name: 'Forall', pattern: /forall|(\\a)|∀/ });
export const Exists = createToken({ name: 'Exists', pattern: /exists|(\\e)|∃/ });
export const VDash = createToken({ name: 'VDash', pattern: /⊢|\|-/ });
// export const VDashDouble = createToken({ name: 'VDashDouble', pattern: /⊨|\|=/ });
export const Colon = createToken({ name: 'colon', pattern: /:/ });
export const Equals = createToken({ name: 'Equals', pattern: /=/ });
export const BelongTo = createToken({ name: 'BelongTo', pattern: /∈|@|(\\in)/ });

const Whitespace = createToken({
	name: 'Whitespace',
	pattern: /\s+/,
	// This is normally computed automatically...
	line_breaks: true,
	group: Lexer.SKIPPED,
});

export const allTokens = [
	Whitespace,
	Forall,
	Exists,
	Replvar,
	VDash,
	Comma,
	LeftRightarrow,
	Rightarrow,
	Not,
	LParen,
	Colon,
	RParen,
	Disjunction,
	Conjunction,
	Equals,
	BelongTo,
];

export const PropositionLexer = new Lexer(allTokens);

export default PropositionLexer;
