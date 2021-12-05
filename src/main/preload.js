const { contextBridge, ipcRenderer } = require('electron');

// valid ipc channels
const validChannels = [
	'add-files',
	'open-file-dialog',
	'process-ffmpeg',
	'progress-total-duration',
	'write-output',
	'one-done',
	'all-done',
];

contextBridge.exposeInMainWorld('electron', {
	api: {
		addFiles(files) {
			ipcRenderer.send('add-files', files);
		},
		openFileDialog() {
			ipcRenderer.send('open-file-dialog');
		},
		process(parameters) {
			if (!parameters) {
				return;
			}
			ipcRenderer.send('process-ffmpeg', parameters);
		},
		on(channel, func) {
			if (validChannels.includes(channel)) {
				// Deliberately strip event as it includes `sender`
				const subscription = (event, ...args) => func(...args);
				ipcRenderer.on(channel, subscription);
				return () => {
					ipcRenderer.removeListener(channel, subscription);
				};
			}
			return undefined;
		},
		once(channel, func) {
			if (validChannels.includes(channel)) {
				// Deliberately strip event as it includes `sender`
				const subscription = (event, ...args) => func(...args);
				ipcRenderer.once(channel, subscription);
				return () => {
					ipcRenderer.removeListener(channel, subscription);
				};
			}
			return undefined;
		},
	},
});
