import { compileProposition } from '../formal/parser/index.ts';

type FlagKind = 'boolean' | 'value';
interface FlagSpec {
	name: string;
	kind: FlagKind;
}

class CommandParser {
	args: string[];
	flags: Map<string, string | true> = new Map();
	flagmap: Map<string, FlagSpec> = new Map([
		['-p', { name: 'project', kind: 'value' }],
		['--project', { name: 'project', kind: 'value' }],
		['-w', { name: 'workspace', kind: 'value' }],
		['--workspace', { name: 'workspace', kind: 'value' }],
		['--repl', { name: 'repl', kind: 'boolean' }],
		['--deduct', { name: 'deduct', kind: 'boolean' }],
		['--rule-name', { name: 'rulename', kind: 'value' }],
		['--conditions', { name: 'conditions', kind: 'value' }],
		['--bind-json', { name: 'bindjson', kind: 'value' }],
	]);
	xor: string[][] = [
		['project', 'workspace'],
		['repl', 'deduct'],
	];

	constructor(args = process.argv.slice(2)) {
		this.args = args;
		this.parse();
		this.checkXor();
	}

	parse() {
		let pending: { spec: FlagSpec; token: string } | null = null;

		const flush = () => {
			if (!pending) return;
			const { spec, token } = pending;
			if (spec.kind === 'value') {
				throw new Error(`Argument ${token} requires a value`);
			}
			this.setFlag(spec.name, true, token);
			pending = null;
		};

		for (const token of this.args) {
			if (token.startsWith('--') && token.includes('=')) {
				const eq = token.indexOf('=');
				const key = token.slice(0, eq);
				const val = token.slice(eq + 1);
				const spec = this.flagmap.get(key);
				if (!spec) {
					console.error(`Unknown argument: ${token}`);
					flush();
					continue;
				}
				if (spec.kind === 'boolean') {
					throw new Error(`Argument ${key} invalid: ${val}`);
				}
				flush();
				this.setFlag(spec.name, val, key);
				continue;
			}

			if (token.startsWith('-')) {
				const spec = this.flagmap.get(token);
				if (!spec) {
					console.error(`Unknown argument: ${token}`);
					flush();
					continue;
				}
				flush();
				pending = { spec, token };
				continue;
			}

			if (pending) {
				if (pending.spec.kind === 'boolean') {
					throw new Error(`Argument ${pending.token} invalid: ${token}`);
				}
				this.setFlag(pending.spec.name, token, pending.token);
				pending = null;
			} else {
				throw new Error(`Redunant argument: ${token}`);
			}
		}
		flush();
	}

	private setFlag(name: string, value: string | true, token: string) {
		if (this.flags.has(name)) {
			throw new Error(`Duplicated argument: ${token}`);
		}
		this.flags.set(name, value);
	}

	private checkXor() {
		for (const group of this.xor) {
			const present = group.filter((n) => this.flags.has(n));
			if (present.length > 1) {
				throw new Error(`Arguments conflict: ${present.map((n) => '--' + n).join(' & ')}`);
			}
		}
	}

	getString(name: string): string | undefined {
		const v = this.flags.get(name);
		if (v === true) throw new Error(`Argument ${name} should be provided: string`);
		return v;
	}

	getBool(name: string): boolean {
		return this.flags.get(name) === true;
	}

	getReplaceTableData(termDifference: Set<string>, propDifference: Set<string>) {
		let jsonstr = this.getString('bindjson') ?? '{}';
		let y = JSON.parse(jsonstr) as Record<string, string>;
		return new Map(
			Object.entries(y).map((x) => {
				let result = compileProposition(
					x[1],
					termDifference.has(x[0]) ? 'term' : 'proposition',
				);
				if (!result.success) throw new Error(`Parse ${x[1]} failed.`);

				return [x[0], result.data.result];
			}),
		);
	}
}

export const cmdparser = new CommandParser();
