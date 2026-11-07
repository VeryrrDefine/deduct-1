import { replMain } from './repl/repl.ts';
import { HELP } from './utils/constants.ts';

if (process.argv.includes('--repl')) {
	await replMain();
	process.exit(0);
}

console.log(HELP);
process.exit(0);
