// eslint-disable-next-line import/prefer-default-export
export const timecodeToSeconds = (timecode: string): number => {
	let seconds = 0;
	const parts = timecode.split(':');
	parts.forEach((i, index) => {
		seconds += Number(i) * [3600, 60, 1][index];
	});

	return seconds;
};

export const formatOutputMessage = (
	existingData: string,
	newMessage: string
): string => {
	if (!newMessage.match(/^frame=/)) {
		return existingData + newMessage;
	}

	const splitData = existingData.split(/\r?\n/);
	if (!splitData.lastItem && splitData.length > 2) {
		splitData.pop();
	}
	if (!splitData.lastItem.match(/^frame=/)) {
		return existingData + newMessage;
	}

	splitData.pop();
	splitData.push(newMessage);

	return splitData.join('\r\n');
};
