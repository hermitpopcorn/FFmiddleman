/* eslint import/prefer-default-export: off, import/no-mutable-exports: off */
import { URL } from 'url';
import path from 'path';

export let resolveHtmlPath: (htmlFileName: string) => string;

if (process.env.NODE_ENV === 'development') {
	const port = process.env.PORT || 1212;
	resolveHtmlPath = (htmlFileName: string) => {
		const url = new URL(`http://localhost:${port}`);
		url.pathname = htmlFileName;
		return url.href;
	};
} else {
	resolveHtmlPath = (htmlFileName: string) => {
		return `file://${path.resolve(__dirname, '../renderer/', htmlFileName)}`;
	};
}

export const pieceFilename = (
	filename: string,
	prefix?: string | null,
	suffix?: string | null,
	extension?: string | null
): string => {
	const pieces = new Array<string>();

	if (prefix) {
		pieces.push(prefix);
	}

	pieces.push(path.parse(filename).name);

	if (suffix) {
		pieces.push(suffix);
	}

	let newExtension;
	if (!extension) {
		newExtension = path.parse(filename).ext;
	} else {
		newExtension = extension.startsWith('.') ? extension : `.${extension}`;
	}
	pieces.push(newExtension);

	return pieces.join('');
};
