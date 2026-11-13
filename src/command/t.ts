import { cmdparser } from './commandparser.ts';

export function getInitialWorkspaceDir(ram = true) {
	const ws = cmdparser.flags.get('workspace');
	const p = cmdparser.flags.get('project');
	if (ws && p) {
		throw new Error(`Conflict arguments: workspace & project.`);
	}
	if (ws === true) throw new Error(`Workspace path is not specified.`);
	if (p === true) throw new Error(`Project name is not specified.`);
	if (ws) {
		return ws;
	}
	if (p) {
		return p;
	}
	if (!ram) throw new Error(`Path is not specified.`);
	return '';
}
