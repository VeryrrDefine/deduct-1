import { existsSync } from 'fs';
import { mkdir, rename, stat, unlink, writeFile } from 'fs/promises';
import path from 'path';

export async function saveFile(data: string, finalPath: string) {
	const tmpPath = finalPath + '.tmp';
	await writeFile(tmpPath, data, 'utf-8');

	// POSIX: rename 原子覆盖；Windows: rename 到已存在文件会 EEXIST/EPERM
	try {
		await rename(tmpPath, finalPath);
	} catch (e: any) {
		if (e.code === 'EEXIST' || e.code === 'EPERM') {
			await unlink(finalPath).catch(() => {});
			await rename(tmpPath, finalPath);
		} else {
			throw e;
		}
	}
}

export async function checkDirectory(dir: string) {
	if (!existsSync(dir)) {
		await mkdir(dir);
		return true;
	}
	if (!(await stat(dir)).isDirectory()) {
		return false;
	}
	return true;
}
