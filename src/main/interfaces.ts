export interface FFmpegParameters {
	files: string[];
	cut?: {
		from: string;
		to: string;
	};
	hardsub?: {
		subfileExtension: string;
	};
	suffix?: string;
	additionalArguments?: string;
	format?: string;
}
