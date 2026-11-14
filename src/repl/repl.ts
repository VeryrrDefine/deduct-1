import readline from 'node:readline';
import { compileProposition } from '../formal/parser/index.ts';
import { displayProposition, fancyDisplay, renderAST } from '../formal/fancy.ts';
import { asserter, ASTManager } from '../formal/astmgr.ts';
import { ASTNode } from '../formal/parser/compiler.ts';
import { HELP } from '../utils/constants.ts';
import { FormalSystem, Workspace } from '../formal/system/formalsystem.ts';
import { Deserializer } from '../formal/exporter/index.ts';
import { loadWorkspace, saveDeduction, savePropositions } from '../file/workspace.ts';
import { cmdparser } from '../command/commandparser.ts';
import { getInitialWorkspaceDir } from '../command/t.ts';
import { MetaruleGenerator } from '../formal/system/metarule.ts';
import path from 'node:path';
import { checkDirectory, saveFile } from '../file/file.ts';
import { readFile } from 'node:fs/promises';
const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});
const ds = new Deserializer();
const formal = new FormalSystem();

async function deduct(rulename: string, currentWorkspaceDir: string) {
	if (
		formal.cacheList.includes(`${rulename}.json`) &&
		!formal.rulemanager.normalRules.find((x) => x[0] == rulename)
	) {
		const loads = (
			await readFile(
				path.join(
					currentWorkspaceDir,
					'cache',
					`${MetaruleGenerator.serializeName(rulename)}.json`,
				),
			)
		).toString('utf-8');
		formal.rulemanager.normalRules.push([rulename, ds.toDeduction(JSON.parse(loads))]);
	}

	let rule = await formal.rulemanager.find(rulename, formal);
	if (!rule) {
		throw new Error(`Rule doesn't exists.`);
	}
	let conditionIdxs: number[] = [];
	if (rule[1].conditions.length !== 0) {
		for (let i = 0; i < rule[1].conditions.length; i++) {
			const theoremID = Number(await ask(`Theorem id for ${i}th condition: `));
			const prop = formal.workspace.propositions[theoremID];
			if (!prop) {
				throw new Error(`Theorem ${theoremID} doesn't exists`);
			}
			conditionIdxs.push(theoremID);
		}
	}

	const payload = formal.rulemanager.preloads.find((x) => x[0] == rulename);

	let termDifference = payload ? payload[1].variableNames : undefined;
	let propDifference = payload ? payload[1].propositionNames : undefined;

	if (!termDifference || !propDifference) {
		const a = formal.rulemanager.generatePayload(rule);
		termDifference = a.termDifference;
		propDifference = a.propDifference;
	}

	let matchmapSet: Record<string, ASTNode> = {};
	for (const x of termDifference) {
		const termString = compileProposition(await ask(`${x} is `), 'term');
		if (!termString.success) {
			throw new Error(`Term matching failed: ${fancyDisplay(termString.reason)}`);
		}
		matchmapSet[x] = termString.data.result;
	}
	for (const x of propDifference) {
		const propString = compileProposition(await ask(`${x} is `), 'proposition');
		if (!propString.success) {
			throw new Error(`Proposition matching failed: ${fancyDisplay(propString.reason)}`);
		}
		matchmapSet[x] = propString.data.result;
	}

	const r = await formal.deduct(rulename, conditionIdxs, new Map(Object.entries(matchmapSet)));
	const result = r[1].value;
	console.log(fancyDisplay(result));
}

async function replQuestion() {
	const currentWorkspaceDir = getInitialWorkspaceDir();
	if (!currentWorkspaceDir) console.log(`Memory-only mode (changes will not be saved).`);
	else {
		await loadWorkspace(currentWorkspaceDir, formal, ds);
	}
	while (true) {
		try {
			const answer = await ask(`${formal.workspace.propositions.length}|`);
			const command = answer.trim();
			if (command === 'help') {
				console.log(HELP);
				continue;
			}
			if (command === 'exit') break;
			if (command === 'serialize') {
				console.log(
					JSON.stringify(
						formal.workspace.propositions.map((x) => ds.deserializeProposition(x)),
					),
				);
				continue;
			}
			if (command === 'deserialize') {
				const j = await ask('what to deserialize? ==');
				formal.workspace.propositions = JSON.parse(j).map((x: any) => ds.toProposition(x));
				continue;
			}
			if (command === 'scrcl') {
				console.clear();
				continue;
			}
			if (command === 'clear') {
				formal.workspace.propositions = [];
				console.log(
					`Your proposition has been cleared (unsaved changes), if you did this accidentaly, please exit immediately and restart this program.`,
				);
				console.log(`Your saves will not be saved until next deduct/hyp.`);
				continue;
			}
			if (command === 'pop') {
				formal.workspace.propositions.pop();
				if (currentWorkspaceDir) {
					await savePropositions(currentWorkspaceDir, formal, ds);
				}
				console.log(`Action done.`);
				continue;
			}

			if (command === 'distinct') continue;

			if (command === 'parse') {
				// 测试功能的指令
				const string2 = await ask('string==');
				let compileResult = compileProposition(string2);
				if (compileResult.success) {
					console.log(
						`Success. \n${fancyDisplay(compileResult.data, 0, compileResult.data.spreadDatas)}\n${compileResult.data.result}`,
					);
				} else {
					console.log(`Failed. \n${fancyDisplay(compileResult.reason)}`);
				}
				continue;
			}
			if (command === 'hyp') {
				const proposition_str = await ask('Proposition ==');
				const proposition = compileProposition(proposition_str);
				if (!proposition.success)
					throw new Error(
						`Proposition parse failed: ${fancyDisplay(proposition.reason)}`,
					);
				let insertAt = 0;
				while (
					insertAt < formal.workspace.propositions.length &&
					formal.workspace.propositions[insertAt].from.deductionIdx === 'hyp'
				)
					insertAt++;

				formal.workspace.insertPropositionsBefore(
					[
						{
							value: proposition.data.result,
							from: { conditionIdxs: [], deductionIdx: 'hyp', replaceValues: {} },
						},
					],
					insertAt,
				);

				if (currentWorkspaceDir) {
					await savePropositions(currentWorkspaceDir, formal, ds);
				}
				continue;
			}

			if (command === 'list rules') {
				console.log(
					formal.rulemanager.normalRules
						.map(
							(x) =>
								`${x[0]}: ${x[1].conditions.map((x) => fancyDisplay(x)).join(', ')}${x[1].conditions.length ? ' =>' : ''} ${fancyDisplay(x[1].conclusion)}  [${x[1].from}]`,
						)
						.join('\n'),
				);
				continue;
			}
			if (command === 'record') {
				const rulename = await ask('To rulename === ');
				formal.record(rulename);

				if (currentWorkspaceDir) {
					await saveDeduction(currentWorkspaceDir, formal, ds, rulename);
				}
				continue;
			}
			if (command === 'save metarule cache') {
				if (!currentWorkspaceDir) {
					console.log('Not available in memory-only mode.');
					continue;
				}
				for (const s of formal.rulemanager.metaruleSet) {
					const ded = await formal.rulemanager.find(s, formal);
					if (!ded) continue;
					const normalizedname = MetaruleGenerator.serializeName(ded[0]);

					const data = ds.deserializeDeduction(ded[1]);

					const finalPath = path.join(
						currentWorkspaceDir,
						'cache',
						normalizedname + '.json',
					);

					await checkDirectory(path.join(currentWorkspaceDir, 'cache'));

					await saveFile(JSON.stringify(data, null, 2), finalPath);
				}
				continue;
			}

			if (command === 'list rules nameonly') {
				console.log('All rules:');
				console.log(formal.rulemanager.normalRules.map((x) => x[0]).join(' '));
				console.log('');
				console.log('User macros:');
				console.log(
					formal.rulemanager.macros.length == 0
						? 'N/A'
						: formal.rulemanager.macros.join(' '),
				);
				continue;
			}
			if (command === 'list props') {
				if (formal.workspace.propositions.length == 0) {
					console.log(`No any propositions.`);
					continue;
				}
				console.log(
					formal.workspace.propositions
						.map((x, i: number) => displayProposition(x, i))
						.join('\n'),
				);
				continue;
			}
			if (command === 'verify' || command === 'verify all') {
				const rulenames =
					command === 'verify'
						? formal.rulemanager.macros
						: formal.rulemanager.normalRules.map((x) => x[0]);
				console.log(
					`Verifing ${rulenames.length} rule${rulenames.length >= 2 ? 's' : ''}...`,
				);
				const failedMacros: string[] = [];

				const oldworkspace = formal.workspace;
				const asserter = new ASTManager();
				try {
					for (const macro of rulenames) {
						const rule = await formal.rulemanager.find(macro, formal);
						if (!rule) {
							throw new Error(`Macro ${macro} is lost.`);
						}

						const deduction = rule[1];
						const errs: string[] = [];
						for (const [i, c] of deduction.conditions.entries()) {
							asserter.check(
								c,
								{ variableNames: new Set(), propositionNames: new Set() },
								{ astExpectedType: 'proposition' },
								errs,
							);
							if (errs.length)
								throw new Error(
									`Condition ${i} of ${macro} invalid:\n${errs.join('\n')}`,
								);
						}
						asserter.check(
							deduction.conclusion,
							{ variableNames: new Set(), propositionNames: new Set() },
							{ astExpectedType: 'proposition' },
							errs,
						);
						if (errs.length)
							throw new Error(`Conclusion of ${macro} invalid:\n${errs.join('\n')}`);

						formal.workspace = new Workspace();
						if (!deduction.steps) {
							console.error(`The proof of macro ${macro} is lost.`);
							console.error(`It may be a axiom, skipped.`);
							continue;
						}
						if (deduction.steps.length === 0) {
							console.error(`The length of the proof of macro ${macro} is 0.`);
							console.error(`It may be a axiom, skipped.`);
							continue;
						}
						formal.workspace.insertPropositionsBefore(
							deduction.conditions.map((x) => {
								return {
									value: x,
									from: {
										conditionIdxs: [],
										deductionIdx: 'hyp',
										replaceValues: {},
									},
								};
							}),
							0,
						);
						for (const deductstep of deduction.steps) {
							if (deductstep.deductionIdx === 'hyp') {
								continue;
							}
							await formal.deduct(
								deductstep.deductionIdx,
								deductstep.conditionIdxs,
								new Map(Object.entries(deductstep.replaceValues)),
							);
						}
						const prop = formal.workspace.propositions.at(-1);
						if (!prop) {
							throw new Error(`Final result of ${macro} is invalid: undefined. `);
						}
						if (!asserter.equals(prop.value, rule[1].conclusion)) {
							throw new Error(
								`Final result of ${macro} doesn't match conclusion: Expected ${renderAST(rule[1].conclusion)}, actual ${renderAST(prop.value)}. `,
							);
						}
					}
				} catch (e) {
					console.error(e);
				} finally {
					formal.workspace = oldworkspace;
				}
				console.log(
					`${formal.rulemanager.macros.length} verified, ${failedMacros.length} failed, ${formal.rulemanager.macros.length - failedMacros.length} succeed.`,
				);
				console.log();
				console.log(`Detail information: ${failedMacros.join(', ')}`);
				formal.workspace = oldworkspace;
				console.log(`Check circular reference... [WIP]`);
				continue;
			}
			if (command === 'deduct') {
				const rulename = await ask('For ');
				await deduct(rulename, currentWorkspaceDir);
				if (currentWorkspaceDir) {
					await savePropositions(currentWorkspaceDir, formal, ds);
				}
				continue;
			}
			if (command === 'match') {
				// 测试功能的指令
				const string2 = await ask('string1==');
				const string3 = await ask('string2==');
				let compileResult = compileProposition(string2);
				if (compileResult.success) {
					console.log(
						`Success. [1]\n${fancyDisplay(compileResult.data, 0, compileResult.data.spreadDatas)}`,
					);
				} else {
					console.log(`Failed. [1]\n${fancyDisplay(compileResult.reason)}`);
					continue;
				}
				let compileResult2 = compileProposition(string3);
				if (compileResult2.success) {
					console.log(
						`Success. [2]\n${fancyDisplay(compileResult2.data, 0, compileResult2.data.spreadDatas)}`,
					);
				} else {
					console.log(`Failed. [2]\n${fancyDisplay(compileResult2.reason)}`);
					continue;
				}

				let errors: string[] = [];
				let matchmap: Record<string, ASTNode> = {};
				asserter.match(
					compileResult.data.result,
					matchmap,
					compileResult2.data.result,
					errors,
				);
				if (errors.length !== 0) {
					console.log(`Failed. [ω]\n${errors.map((x) => '* ' + x).join('\n')}`);
				} else {
					console.log(
						`Success. [ω]\n${Object.entries(matchmap)
							.map((x) => `${x[0]} <=> ${fancyDisplay(x[1])}`)
							.join('\n')}`,
					);
				}
				continue;
			}

			await deduct(command, currentWorkspaceDir);
		} catch (e) {
			console.error(e);
		}
	}
	rl.close();
	process.exit(0);
}

function ask(question: string): Promise<string> {
	return new Promise((resolve) => rl.question(question, resolve));
}

export async function replMain() {
	await replQuestion();
}
