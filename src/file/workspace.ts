import { mkdir, readFile } from 'fs/promises';
import { checkDirectory, saveFile } from './file.ts';
import path from 'path';
import type { FormalSystem } from '../formal/system/formalsystem';
import type { Deserializer } from '../formal/exporter';
import { existsSync } from 'fs';

export async function initWorkspace(dir: string) {
	console.log(`Initializing workspace ${dir}...`);
	await mkdir(dir);
	await saveFile(
		JSON.stringify({
			version: 1,
			macros: [],
		}),
		path.join(dir, 'deduct.json'),
	);
}

export async function loadWorkspace(dir: string, formal: FormalSystem, ds: Deserializer) {
	if (!existsSync(dir)) {
		await initWorkspace(dir);
	}
	// 1. 描述符
	const descPath = path.join(dir, 'deduct.json');
	const desc = JSON.parse(await readFile(descPath, 'utf-8'));
	const macros: string[] = desc.macros ?? [];

	// 2. 宏（保留你原来的路径）
	for (const name of macros) {
		const macroPath = path.join(dir, 'macros', `${name}.json`);
		const macro = JSON.parse(await readFile(macroPath, 'utf-8'));
		formal.rulemanager.normalRules.push([name, ds.toDeduction(macro)]);
	}
	formal.rulemanager.macros = macros;

	// 3. 定理表：文件不存在 = 空
	const propPath = path.join(dir, 'propositions.json');
	if (existsSync(propPath)) {
		const arr = JSON.parse(await readFile(propPath, 'utf-8'));
		if (!Array.isArray(arr)) throw new Error(`propositions.json 不是数组`);
		formal.workspace.propositions = arr.map((x: any) => ds.toProposition(x));
	} else {
		formal.workspace.propositions = [];
	}
}

export async function savePropositions(dir: string, formal: FormalSystem, ds: Deserializer) {
	const data = formal.workspace.propositions.map((p) => ds.deserializeProposition(p));
	const finalPath = path.join(dir, 'propositions.json');

	await saveFile(JSON.stringify(data, null, 2), finalPath);
}

export async function saveDeduction(
	currentWorkspaceDir: string,
	formal: FormalSystem,
	ds: Deserializer,
	rulename: string,
) {
	const deduction = formal.rulemanager.normalRules.find((x) => x[0] === rulename);
	if (!deduction) throw new Error(`Save deduction failed: cannot find macro ${rulename}`);

	const data = ds.deserializeDeduction(deduction[1]);

	await saveDeductfile(currentWorkspaceDir, formal, ds);

	const finalPath = path.join(currentWorkspaceDir, 'macros', rulename + '.json');

	await checkDirectory(path.join(currentWorkspaceDir, 'macros'));

	await saveFile(JSON.stringify(data, null, 2), finalPath);
}

export async function saveDeductfile(
	currentWorkspaceDir: string,
	formal: FormalSystem,
	ds: Deserializer,
) {
	const data = {
		version: 1,
		macros: formal.rulemanager.macros,
	};
	const finalPath = path.join(currentWorkspaceDir, 'deduct.json');

	await saveFile(JSON.stringify(data, null, 2), finalPath);
}
