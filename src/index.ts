import { homedir } from 'os';
import { checkDirectory } from './file/file.ts';
import { replMain } from './repl/repl.ts';
import { HELP } from './utils/constants.ts';
import path from 'path';
import { cmdparser } from './command/commandparser.ts';
import { loadWorkspace, savePropositions } from './file/workspace.ts';
import { FormalSystem } from './formal/system/formalsystem.ts';
import { Deserializer } from './formal/exporter/index.ts';
import { getInitialWorkspaceDir } from './command/t.ts';
import { renderAST } from './formal/fancy.ts';
if (cmdparser.getString('project')) {
	await checkDirectory(path.join(homedir(), '.deduct'));
	await checkDirectory(path.join(homedir(), '.deduct', 'projects'));
}
if (cmdparser.getBool('repl')) {
	await replMain();
	process.exit(0);
} else {
	if (cmdparser.getBool('deduct')) {
		const rulename = cmdparser.getString('rulename');

		if (!rulename) {
			console.error(`Rulename not specified.`);
			process.exit(2);
		}
		const formal = new FormalSystem();
		const ds = new Deserializer();
		const dir = getInitialWorkspaceDir(false);
		await loadWorkspace(dir, formal, ds);
		const rule = await formal.rulemanager.find(rulename, formal);
		if (!rule) {
			console.error(`Rule doesn't exists.`);
			process.exit(2);
		}
		const conditions = JSON.parse(cmdparser.getString('conditions') ?? '[]') ?? [];

		if (conditions.length !== rule[1].conditions.length) {
			console.error(`Argument condition length doesn't match rule conditions.`);
			process.exit(2);
		}

		const payload = formal.rulemanager.preloads.find((x) => x[0] == rulename);

		let termDifference = payload ? payload[1].variableNames : undefined;
		let propDifference = payload ? payload[1].propositionNames : undefined;

		if (!termDifference || !propDifference) {
			const a = formal.rulemanager.generatePayload(rule);
			termDifference = a.termDifference;
			propDifference = a.propDifference;
		}

		const tabledata = cmdparser.getReplaceTableData(termDifference, propDifference);

		const rest = new Set([...termDifference, ...propDifference]).difference(tabledata);
		if (rest.size !== 0) {
			console.error(`Replvar ungiven: ${new Array(...rest)}`);
			process.exit(2);
		}
		const a = formal.deduct(rulename, conditions, tabledata);

		await savePropositions(dir, formal, ds);
		console.log(renderAST(a[1].value));
		process.exit(0);
	}
}

console.log(HELP);
process.exit(0);
