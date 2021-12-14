/* eslint-disable react-hooks/exhaustive-deps */
import { MemoryRouter as Router, Switch, Route } from 'react-router-dom';
import { useState, useEffect, useRef, KeyboardEvent, ChangeEvent } from 'react';
import { timecodeToSeconds } from './util';
import { FFmpegParameters } from '../main/interfaces';
import './App.scss';

declare global {
	interface Window {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		electron: any;
	}
}

const Main = () => {
	const [files, setFiles] = useState(new Array<string>());
	const [actions, setActions] = useState(new Array<string>());
	const [inputValues, setInputValues] = useState({
		from: '00:00:00',
		to: '00:00:00',
		subfileExtension: 'ass',
		preset: 'medium',
		crf: undefined,
		avgBitrate: undefined,
		bufsize: undefined,
		suffix: '.processed',
		additionalArguments: '',
		format: 'mp4',
	});
	const [output, setOutput] = useState('');
	const outputTextArea = useRef<HTMLTextAreaElement>(null);
	const [processing, setProcessing] = useState(false);
	const [progress, setProgress] = useState({
		fileProgress: 0,
		fileMax: 0,
		jobProgress: 0,
		jobMax: 0,
	});

	// Attach ip listeners (and remove old ones)
	useEffect(() => {
		// Handle opened files
		const removeEventListeners = new Array<() => void>();
		removeEventListeners.push(
			window.electron.api.on('open-file-dialog', (arg: string[]) => {
				arg.forEach((path) => {
					if (!files.includes(path)) {
						setFiles((prevData) => [...prevData, path]);
					}
				});
			})
		);

		// Handle progress report
		removeEventListeners.push(
			window.electron.api.on('progress-total-duration', (duration: number) => {
				setProgress({ ...progress, fileMax: duration });
			})
		);

		// Write output to textarea
		removeEventListeners.push(
			window.electron.api.on('write-output', (message: string) => {
				setOutput((prevData) => prevData + message);

				// Check for progress
				const checkProgress = message.match(
					/time=([0-9]+:[0-5][0-9]:[0-5][0-9])(.[0-9]+)?/
				);
				if (checkProgress) {
					checkProgress.shift();
					const currentDuration = Math.ceil(
						timecodeToSeconds(checkProgress.join(''))
					);
					setProgress({ ...progress, fileProgress: currentDuration });
				}

				// Scroll
				const area: HTMLTextAreaElement | null = outputTextArea.current;
				if (area) {
					area.scrollTop = area.scrollHeight;
				}
			})
		);

		// Finished one job
		removeEventListeners.push(
			window.electron.api.on('one-done', () => {
				setProgress({ ...progress, jobProgress: progress.jobProgress + 1 });
			})
		);

		// Finished all jobs
		removeEventListeners.push(
			window.electron.api.on('all-done', () => {
				setProcessing(false);
			})
		);

		return () => {
			// Remove old listener on subsequent re-renders
			removeEventListeners.forEach((remover) => {
				remover();
			});
		};
	});

	// Allow dropping files
	window.ondragover = (e) => e.preventDefault();
	// Handle drop
	window.ondrop = (e) => {
		e.preventDefault();
		if (e.dataTransfer == null) {
			return;
		}
		if (e.dataTransfer.files.length > 0) {
			Array.from(e.dataTransfer.files).forEach((i) => {
				if (!files.includes(i.path)) {
					setFiles((prevData) => [...prevData, i.path]);
				}
			});
		}
	};

	const handleDeletion = (e: KeyboardEvent<HTMLSelectElement>) => {
		if (['delete', 'backspace'].includes(e.key.toLowerCase())) {
			Array.from((e.target as HTMLSelectElement).selectedOptions).map(
				(selectedOption: HTMLOptionElement) => {
					return setFiles((prevData) =>
						prevData.filter((i) => i !== selectedOption.value)
					);
				}
			);
		}
	};

	// eslint-disable-next-line prettier/prettier
	const handleInputChange = (e: ChangeEvent<HTMLInputElement> | ChangeEvent<HTMLSelectElement>) => {
		const { name, value } = e.target;
		setInputValues({ ...inputValues, [name]: value });
	};

	const handleTimecodeInputBlur = (e: ChangeEvent<HTMLInputElement>) => {
		const { name, value } = e.target;
		let timecode = value;

		if (timecode.length < 1) {
			timecode = '00:00:00';
		} else {
			let result = '';
			const split = timecode.split(':');
			for (
				let missingSegments = 3 - split.length;
				missingSegments > 0;
				missingSegments -= 1
			) {
				result += '00:';
			}
			split.forEach((i) => {
				const pad = Number(i) < 10;
				result += `${pad ? '0' : ''}${Number(i)}:`;
			});
			// Remove trailing :
			timecode = result.substr(0, result.length - 1);
		}

		// Check against regex
		// eslint-disable-next-line prettier/prettier
		const testRegex = new RegExp(/^([0-9]+):([0-5][0-9]):([0-5][0-9])(\.[0-9]+)?$/);
		if (!testRegex.test(timecode)) {
			timecode = '00:00:00';
		}

		e.target.value = timecode;
		setInputValues({ ...inputValues, [name]: timecode });
	};

	const compileParameters = (): FFmpegParameters | null => {
		const parameters: FFmpegParameters = {
			files,
			suffix: inputValues.suffix,
			additionalArguments: inputValues.additionalArguments,
			format: inputValues.format,
		};

		if (actions.includes('cut')) {
			parameters.cut = {
				from: inputValues.from,
				to: inputValues.to,
			};
		}
		if (actions.includes('hardsub')) {
			parameters.hardsub = {
				subfileExtension: inputValues.subfileExtension,
			};
		}
		if (actions.includes('hardsub')) {
			parameters.hardsub = {
				subfileExtension: inputValues.subfileExtension,
			};
		}
		if (actions.includes('hevc')) {
			parameters.hevc = {
				preset: inputValues.preset,
				crf: inputValues.crf,
				avgBitrate: inputValues.avgBitrate,
				bufsize: inputValues.bufsize,
			};
		}

		return parameters;
	};

	const toggleAction = (action: string) => {
		if (actions.includes(action)) {
			setActions(actions.filter((el) => el !== action));
		} else {
			setActions([...actions, action]);
		}
	};

	const readyProcessUI = () => {
		setProcessing(true);
		setProgress({
			fileProgress: 0,
			fileMax: 1,
			jobProgress: 0,
			jobMax: files.length,
		});
	};

	return (
		<div className="container">
			<div className="v-fixed">
				<fieldset className="file-selector">
					<select multiple onKeyUp={handleDeletion}>
						{files.map((file, index) => {
							// eslint-disable-next-line react/no-array-index-key
							return <option key={index}>{file}</option>;
						})}
					</select>
					<button
						type="button"
						onClick={() => {
							window.electron.api.openFileDialog();
						}}
					>
						Select File
					</button>
				</fieldset>

				<nav className="tabs">
					<button
						type="button"
						onClick={() => toggleAction('cut')}
						className={actions.includes('cut') ? 'active' : ''}
					>
						Cut
					</button>
					<button
						type="button"
						onClick={() => toggleAction('hardsub')}
						className={actions.includes('hardsub') ? 'active' : ''}
					>
						Hardsub
					</button>
					<button
						type="button"
						onClick={() => toggleAction('hevc')}
						className={actions.includes('hevc') ? 'active' : ''}
					>
						HEVC Conversion
					</button>
				</nav>

				<section
					id="tab-cut"
					style={
						actions.includes('cut') ? { display: 'block' } : { display: 'none' }
					}
				>
					<fieldset className="cut-from-to">
						<label htmlFor="cut-from">
							<span>From</span>
							<input
								name="from"
								id="cut-from"
								type="text"
								value={inputValues.from}
								onChange={handleInputChange}
								onBlur={handleTimecodeInputBlur}
							/>
						</label>
						<label htmlFor="cut-to">
							<span>To</span>
							<input
								name="to"
								id="cut-to"
								type="text"
								value={inputValues.to}
								onChange={handleInputChange}
								onBlur={handleTimecodeInputBlur}
							/>
						</label>
					</fieldset>
				</section>

				<section
					id="tab-hardsub"
					style={
						actions.includes('hardsub')
							? { display: 'block' }
							: { display: 'none' }
					}
				>
					<fieldset>
						<label htmlFor="hardsub-extension">
							Subtitle file extension
							<input
								name="subfileExtension"
								id="hardsub-subfile-extension"
								type="text"
								value={inputValues.subfileExtension}
								onChange={handleInputChange}
							/>
						</label>
					</fieldset>
				</section>

				<section
					id="tab-hevc"
					style={
						actions.includes('hevc')
							? { display: 'block' }
							: { display: 'none' }
					}
				>
					<fieldset className="hevc-settings">
						<label htmlFor="hevc-preset">
							<span>Preset</span>
							<select
								name="preset"
								id="hevc-preset"
								value={inputValues.preset}
								onChange={handleInputChange}
							>
								<option value="ultrafast">ultrafast</option>
								<option value="superfast">superfast</option>
								<option value="veryfast">veryfast</option>
								<option value="faster">faster</option>
								<option value="fast">fast</option>
								<option value="medium">medium</option>
								<option value="slow">slow</option>
								<option value="slower">slower</option>
								<option value="veryslow ">veryslow </option>
							</select>
						</label>
						<label htmlFor="hevc-crf">
							<span>CRF</span>
							<input
								name="crf"
								id="hevc-crf"
								type="text"
								value={inputValues.crf}
								onChange={handleInputChange}
							/>
						</label>
						<label htmlFor="hevc-avgBitrate">
							<span>Average Bitrate</span>
							<input
								name="avgBitrate"
								id="hevc-avgBitrate"
								type="text"
								value={inputValues.avgBitrate}
								onChange={handleInputChange}
							/>
						</label>
						<label htmlFor="hevc-bufsize">
							<span>Buffer Size</span>
							<input
								name="bufsize"
								id="hevc-bufsize"
								type="text"
								value={inputValues.bufsize}
								onChange={handleInputChange}
							/>
						</label>
					</fieldset>
				</section>

				<fieldset>
					<label htmlFor="suffix">
						<span>Suffix</span>
						<input
							name="suffix"
							id="suffix"
							type="text"
							value={inputValues.suffix}
							onChange={handleInputChange}
						/>
					</label>
				</fieldset>

				<fieldset>
					<label htmlFor="additional-arguments">
						Additional arguments
						<input
							name="additionalArguments"
							id="additional-arguments"
							type="text"
							value={inputValues.additionalArguments}
							onChange={handleInputChange}
						/>
					</label>
				</fieldset>

				<fieldset>
					<label htmlFor="format">
						Format
						<input
							name="format"
							id="format"
							type="text"
							value={inputValues.format}
							onChange={handleInputChange}
						/>
					</label>
				</fieldset>
			</div>

			<div className="v-fit">
				<fieldset className="v-fit">
					<textarea
						readOnly
						ref={outputTextArea}
						className="output"
						value={output}
					/>
				</fieldset>
			</div>

			<div className="v-fixed">
				<fieldset className="submit">
					<button
						id="pause"
						type="button"
						onClick={() => {
							window.electron.api.pauseResume();
						}}
					>
						⏯
					</button>
					<progress value={progress.fileProgress} max={progress.fileMax} />
					<progress value={progress.jobProgress} max={progress.jobMax} />
					<button
						id="process"
						type="button"
						disabled={files.length < 1 || processing}
						onClick={() => {
							readyProcessUI();
							window.electron.api.process(compileParameters());
						}}
					>
						Process
					</button>
				</fieldset>
			</div>
		</div>
	);
};

export default function App() {
	return (
		<Router>
			<Switch>
				<Route path="/" component={Main} />
			</Switch>
		</Router>
	);
}
