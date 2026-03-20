"use client";

import Editor from "@monaco-editor/react";
import { useEffect, useState } from "react";

interface CodeEditorProps {
	language: string;
	value: string;
	onChange: (value: string) => void;
}

export function CodeEditor({ language, value, onChange }: CodeEditorProps) {
	const [theme, setTheme] = useState<"vs-dark" | "light">("light");

	useEffect(() => {
		const updateTheme = () => {
			const isDark = document.documentElement.classList.contains("dark");
			setTheme(isDark ? "vs-dark" : "light");
		};

		updateTheme();

		const observer = new MutationObserver(updateTheme);
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});

		return () => {
			observer.disconnect();
		};
	}, []);

	return (
		<div className="overflow-hidden rounded-2xl border border-border">
			<Editor
				height="clamp(260px, 45vh, 420px)"
				language={language}
				value={value}
				theme={theme}
				onChange={(nextValue) => onChange(nextValue ?? "")}
				options={{
					minimap: { enabled: false },
					fontSize: 14,
					scrollBeyondLastLine: false,
					automaticLayout: true,
				}}
			/>
		</div>
	);
}
