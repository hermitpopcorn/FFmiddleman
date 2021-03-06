const { contextBridge, ipcRenderer } = require('electron');

// valid ipc channels
const validChannels = [
	'add-files',
	'open-file-dialog',
	'open-destination-dialog',
	'process-ffmpeg',
	'pause-ffmpeg',
	'progress-total-duration',
	'write-output',
	'one-done',
	'all-done',
	'set-fields',
	'save-fields',
];

contextBridge.exposeInMainWorld('electron', {
	api: {
		addFiles(files) {
			ipcRenderer.send('add-files', files);
		},
		openFileDialog() {
			ipcRenderer.send('open-file-dialog');
		},
		openDestinationDialog() {
			ipcRenderer.send('open-destination-dialog');
		},
		process(parameters) {
			if (!parameters) {
				return;
			}
			ipcRenderer.send('process-ffmpeg', parameters);
		},

		pauseResume() {
			ipcRenderer.send('pause-ffmpeg');
		},
		sendFields(parameters) {
			if (!parameters) {
				return;
			}
			ipcRenderer.send('save-fields', parameters);
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
