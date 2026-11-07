import { homedir } from 'os';
import { checkDirectory } from './file/file.ts';
import { replMain } from './repl/repl.ts';
import { HELP } from './utils/constants.ts';
import path from 'path';

if (process.argv.includes('-p') || process.argv.includes('--project')) {
	await checkDirectory(path.join(homedir(), '.deduct'));
	await checkDirectory(path.join(homedir(), '.deduct', 'projects'));
}
if (process.argv.includes('--repl')) {
	await replMain();
	process.exit(0);
}

console.log(HELP);
process.exit(0);
