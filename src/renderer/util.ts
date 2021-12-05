// eslint-disable-next-line import/prefer-default-export
export const timecodeToSeconds = (timecode: string): number => {
	let seconds = 0;
	const parts = timecode.split(':');
	parts.forEach((i, index) => {
		seconds += Number(i) * [3600, 60, 1][index];
	});

	return seconds;
};
