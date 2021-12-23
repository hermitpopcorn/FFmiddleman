export interface FFmpegParameters {
	files: string[];
	cut?: {
		from: string;
		to: string;
	};
	hardsub?: {
		subfileExtension: string;
	};
	hevc?: {
		preset?: string;
		tune?: string;
		crf?: number;
		avgBitrate?: string;
		bufsize?: string;
	};
	prefix?: string;
	suffix?: string;
	additionalArguments?: string;
	format?: string;
}
