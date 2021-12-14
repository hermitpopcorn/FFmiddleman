import Store from 'electron-store';

// Init store
const store = new Store({
	schema: {
		window: {
			type: 'object',
			properties: {
				width: {
					type: 'number',
					minimum: 1,
				},
				height: {
					type: 'number',
					minimum: 1,
				},
			},
		},
		input: {
			type: 'object',
			properties: {
				cut: {
					type: 'object',
					properties: {
						from: {
							type: 'string',
						},
						to: {
							type: 'string',
						},
					},
				},
				hardsub: {
					type: 'object',
					properties: {
						subfileExtension: {
							type: 'string',
						},
					},
				},
				hevc: {
					type: 'object',
					properties: {
						preset: {
							type: 'string',
						},
						crf: {
							type: 'number',
						},
						avgBitrate: {
							type: 'string',
						},
						bufsize: {
							type: 'string',
						},
					},
				},
				suffix: {
					type: 'string',
				},
				additionalArguments: {
					type: 'string',
				},
				format: {
					type: 'string',
				},
			},
		},
	},
});

export default store;
