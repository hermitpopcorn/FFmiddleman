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
	};
	suffix?: string;
	additionalArguments?: string;
	format?: string;
}
