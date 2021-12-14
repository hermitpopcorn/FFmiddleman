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
		crf?: number;
		avgBitrate?: string;
		bufsize?: string;
	};
	suffix?: string;
	additionalArguments?: string;
	format?: string;
}
