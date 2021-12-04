/* eslint-disable react-hooks/exhaustive-deps */
import { MemoryRouter as Router, Switch, Route } from 'react-router-dom';
import { useState, useEffect, useRef, KeyboardEvent, ChangeEvent } from 'react';
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
	const [visibleTab, setVisibleTab] = useState('cut');
	const [inputValues, setInputValues] = useState({
		from: '00:00:00',
		to: '00:00:00',
		cutSuffix: '.cut1',
		subfileExtension: 'ass',
		hardsubSuffix: '.hardsub',
		additionalArguments: '',
		format: '',
	});
	const [output, setOutput] = useState('');
	const outputTextArea = useRef<HTMLTextAreaElement>(null);
	const [processing, setProcessing] = useState(false);

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

		removeEventListeners.push(
			window.electron.api.on('write-output', (message: string) => {
				setOutput((prevData) => prevData + message);
				const area: HTMLTextAreaElement | null = outputTextArea.current;
				if (area) {
					area.scrollTop = area.scrollHeight;
				}
			})
		);

		removeEventListeners.push(
			window.electron.api.on('all-done', () => {
				setProcessing(false);
			})
		);

		return () => {
			// remove old listener on subsequent re-renders
			removeEventListeners.forEach((remover) => {
				remover();
			});
		};
	}, [files]);

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

	const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
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
				result += `${i}:`;
			});
			timecode = result.substr(0, result.length - 1);
		}

		e.target.value = timecode;
		setInputValues({ ...inputValues, [name]: timecode });
	};

	const compileParameters = (): FFmpegParameters | null => {
		let parameters: FFmpegParameters;

		switch (visibleTab) {
			case 'cut': {
				parameters = {
					files,
					cut: {
						from: inputValues.from,
						to: inputValues.to,
					},
					suffix: inputValues.cutSuffix,
					additionalArguments: inputValues.additionalArguments,
					format: inputValues.format,
				};
				return parameters;
			}
			case 'hardsub': {
				parameters = {
					files,
					hardsub: {
						subfileExtension: inputValues.subfileExtension,
					},
					suffix: inputValues.hardsubSuffix,
					additionalArguments: inputValues.additionalArguments,
					format: inputValues.format,
				};
				return parameters;
			}
			default: {
				return null;
			}
		}
	};

	return (
		<div>
			<h1>FFmiddleman</h1>
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
				<button type="button" onClick={() => setVisibleTab('cut')}>
					Cut
				</button>
				<button type="button" onClick={() => setVisibleTab('hardsub')}>
					Hardsub
				</button>
			</nav>

			<section
				id="tab-cut"
				style={
					visibleTab === 'cut' ? { display: 'block' } : { display: 'none' }
				}
			>
				<fieldset className="cut-from-to">
					<label htmlFor="cut-from">
						<span>From</span>
						<input
							name="from"
							id="cut-from"
							type="text"
							defaultValue={inputValues.from}
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
							defaultValue={inputValues.to}
							onChange={handleInputChange}
							onBlur={handleTimecodeInputBlur}
						/>
					</label>
				</fieldset>
				<fieldset>
					<label htmlFor="cut-suffix">
						<span>Suffix</span>
						<input
							name="cutSuffix"
							id="cut-suffix"
							type="text"
							defaultValue={inputValues.cutSuffix}
							onChange={handleInputChange}
						/>
					</label>
				</fieldset>
			</section>

			<section
				id="tab-hardsub"
				style={
					visibleTab === 'hardsub' ? { display: 'block' } : { display: 'none' }
				}
			>
				<fieldset>
					<label htmlFor="hardsub-extension">
						Subtitle file extension
						<input
							name="subfileExtension"
							id="hardsub-subfile-extension"
							type="text"
							defaultValue={inputValues.subfileExtension}
							onChange={handleInputChange}
						/>
					</label>
				</fieldset>
				<fieldset>
					<label htmlFor="hardsub-suffix">
						Suffix
						<input
							name="hardsubSuffix"
							id="hardsub-suffix"
							type="text"
							defaultValue={inputValues.hardsubSuffix}
							onChange={handleInputChange}
						/>
					</label>
				</fieldset>
			</section>

			<fieldset>
				<label htmlFor="additional-arguments">
					Additional arguments
					<input
						name="additionalArguments"
						id="additional-arguments"
						type="text"
						defaultValue={inputValues.additionalArguments}
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
						defaultValue={inputValues.format}
						onChange={handleInputChange}
					/>
				</label>
			</fieldset>

			<textarea
				readOnly
				ref={outputTextArea}
				className="output"
				value={output}
			/>

			<fieldset className="submit">
				<button
					type="button"
					disabled={files.length < 1 || processing}
					onClick={() => {
						setProcessing(true);
						window.electron.api.process(compileParameters());
					}}
				>
					Process
				</button>
			</fieldset>
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