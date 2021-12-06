/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import 'core-js/stable';
import 'regenerator-runtime/runtime';
import path from 'path';
import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron';
import log from 'electron-log';
import { ChildProcess, spawn, spawnSync } from 'child_process';
import treeKill from 'tree-kill';
import psTree from 'ps-tree';
import { suspend, resume } from 'ntsuspend';
import { existsSync } from 'fs';
import { FFmpegParameters } from './interfaces';
import { pieceFilename, resolveHtmlPath, timecodeToSeconds } from './util';

let mainWindow: BrowserWindow | null = null;
let runningFFmpegProcess: ChildProcess | null = null;

if (process.env.NODE_ENV === 'production') {
	const sourceMapSupport = require('source-map-support');
	sourceMapSupport.install();
}

const isDevelopment =
	process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDevelopment) {
	require('electron-debug')();
}

const installExtensions = async () => {
	const installer = require('electron-devtools-installer');
	const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
	const extensions = ['REACT_DEVELOPER_TOOLS'];

	return installer
		.default(
			extensions.map((name) => installer[name]),
			forceDownload
		)
		.catch(console.log);
};

const createWindow = async () => {
	if (isDevelopment) {
		await installExtensions();
	}

	const RESOURCES_PATH = app.isPackaged
		? path.join(process.resourcesPath, 'assets')
		: path.join(__dirname, '../../assets');

	const getAssetPath = (...paths: string[]): string => {
		return path.join(RESOURCES_PATH, ...paths);
	};

	mainWindow = new BrowserWindow({
		show: false,
		width: 800,
		height: 725,
		icon: getAssetPath('icon.png'),
		webPreferences: {
			preload: path.join(__dirname, 'preload.js'),
		},
	});

	mainWindow.setMenu(null);

	mainWindow.loadURL(resolveHtmlPath('index.html'));

	mainWindow.on('ready-to-show', () => {
		if (!mainWindow) {
			throw new Error('"mainWindow" is not defined');
		}
		if (process.env.START_MINIMIZED) {
			mainWindow.minimize();
		} else {
			mainWindow.show();
		}
	});

	mainWindow.on('close', (e) => {
		if (runningFFmpegProcess && mainWindow) {
			const confirm = dialog.showMessageBoxSync(mainWindow, {
				message: `There is a job in progress. Kill the FFmpeg instance and close anyway?`,
				type: 'warning',
				buttons: ['Close', 'Resume'],
				noLink: true,
				defaultId: 1,
				title: 'Confirm close',
				cancelId: 1,
			});
			if (confirm === 1) {
				e.preventDefault();
			} else {
				// eslint-disable-next-line no-lonely-if
				if (runningFFmpegProcess.pid) {
					const { pid } = runningFFmpegProcess;
					treeKill(pid);
				}
			}
		}
	});

	mainWindow.on('closed', () => {
		mainWindow = null;
	});

	// Open urls in the user's browser
	mainWindow.webContents.setWindowOpenHandler((details) => {
		shell.openExternal(details.url);
		return { action: 'deny' };
	});
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
	// Respect the OSX convention of having the application in memory even
	// after all windows have been closed
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

app
	.whenReady()
	.then(() => {
		createWindow();
		app.on('activate', () => {
			// On macOS it's common to re-create a window in the app when the
			// dock icon is clicked and there are no other windows open.
			if (mainWindow === null) createWindow();
		});
	})
	.catch(console.log);

ipcMain.on('open-file-dialog', async (event) => {
	dialog
		.showOpenDialog({
			properties: ['openFile', 'multiSelections', 'dontAddToRecent'],
		})
		.then((result) => {
			if (result.canceled) {
				return;
			}
			event.reply('open-file-dialog', result.filePaths);
		})
		.catch((err) => {
			console.error(err);
			log.error(err);
		});
});

let pauseStatus = false;
ipcMain.on('pause-ffmpeg', async (event) => {
	if (runningFFmpegProcess?.pid) {
		psTree(runningFFmpegProcess.pid, (err, children) => {
			children.forEach((i) => {
				if (!i.COMMAND.match(/ffmpeg/)) {
					return;
				}

				if (!pauseStatus) {
					console.log(i.PID);
					suspend(Number(i.PID));
					pauseStatus = true;
				} else {
					resume(Number(i.PID));
					pauseStatus = false;
				}
			});
		});
	}
});

ipcMain.on('process-ffmpeg', async (event, args: FFmpegParameters) => {
	const next = (index: number) => {
		const promise = new Promise<number>((resolve, reject) => {
			if (!mainWindow) {
				reject();
				return;
			}

			const file = args.files[index];
			const workingDirectory = path.dirname(file);

			// Write output header
			event.reply('write-output', `${'='.repeat(40)}\r\n`);
			event.reply('write-output', `Processing ${file}...\r\n`);
			event.reply('write-output', `${'='.repeat(40)}\r\n`);

			// Determine destination filename and check
			const destination = pieceFilename(file, args.suffix, args.format);
			const destinationPath = path.join(workingDirectory, destination);
			if (existsSync(destinationPath)) {
				const confirm = dialog.showMessageBoxSync(mainWindow, {
					message: `Destination file ${destinationPath} already exists. Overwrite?`,
					type: 'question',
					buttons: ['Overwrite', 'Skip this file'],
					noLink: true,
					defaultId: 1,
					title: 'Confirm overwrite',
					cancelId: 1,
				});
				if (confirm === 1) {
					event.reply('write-output', 'File skipped.\r\n');
					resolve(index);
					return;
				}
			}

			// Determine progress by duration
			if (args.cut) {
				event.reply(
					'progress-total-duration',
					timecodeToSeconds(args.cut.to) - timecodeToSeconds(args.cut.from)
				);
			} else {
				const prober = spawnSync(
					'ffprobe',
					['-i', path.basename(file), '-show_format'],
					{
						cwd: path.resolve(workingDirectory),
					}
				);
				const matchResult = prober.stdout
					.toString()
					.match(/duration=([0-9.]+)/);
				let duration = 0;
				if (matchResult) {
					duration = Math.ceil(Number(matchResult[1]));
				}
				event.reply('progress-total-duration', duration);
			}

			// Piece together arguments
			const ffmpegArguments = new Array<string>();
			ffmpegArguments.push('-i');
			ffmpegArguments.push(path.basename(file));
			if (args.cut) {
				ffmpegArguments.push('-ss');
				ffmpegArguments.push(`${args.cut.from}`);
				ffmpegArguments.push('-to');
				ffmpegArguments.push(`${args.cut.to}`);
			}
			if (args.hardsub) {
				const subfile = pieceFilename(
					file,
					null,
					args.hardsub.subfileExtension
				);
				ffmpegArguments.push('-vf');
				ffmpegArguments.push(`subtitles=${subfile}`);
			}
			if (args.hevc) {
				ffmpegArguments.push('-c:v');
				ffmpegArguments.push('libx265');
				ffmpegArguments.push('-c:a');
				ffmpegArguments.push('copy');
				if (args.hevc.preset) {
					ffmpegArguments.push('-preset');
					ffmpegArguments.push(String(args.hevc.preset));
				}
				if (args.hevc.crf) {
					ffmpegArguments.push('-crf');
					ffmpegArguments.push(String(args.hevc.crf));
				}
			}
			if (args.additionalArguments) {
				const splitAdditionalArguments = args.additionalArguments.split(' ');
				ffmpegArguments.concat(splitAdditionalArguments);
			}
			ffmpegArguments.push('-y');
			ffmpegArguments.push(`${destination}`);

			pauseStatus = false;
			const child: ChildProcess = spawn('ffmpeg', ffmpegArguments, {
				detached: false,
				cwd: path.resolve(workingDirectory),
			});
			runningFFmpegProcess = child;
			child.stderr?.setEncoding('utf8');
			child.stderr?.on('data', (data) => {
				event.reply('write-output', data);
			});
			child.on('close', () => {
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				runningFFmpegProcess = null;
				return resolve(index);
			});
		});
		promise
			.then((finishedIndex) => {
				event.reply('one-done');
				// If next
				if (finishedIndex + 1 < args.files.length) {
					// eslint-disable-next-line promise/no-callback-in-promise
					next(finishedIndex + 1);
				} else {
					event.reply('all-done');
				}
			})
			.catch((err) => {
				throw err;
			});
	};

	next(0);
});
