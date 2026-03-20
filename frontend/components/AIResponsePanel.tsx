"use client";

interface AIResponsePanelProps {
	title: string;
	content: unknown;
}

function renderValue(value: unknown): React.ReactNode {
	if (Array.isArray(value)) {
		return (
			<ul className="space-y-2">
				{value.map((item, index) => (
					<li key={index} className="rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm">
						{String(item)}
					</li>
				))}
			</ul>
		);
	}

	if (value !== null && typeof value === "object") {
		return (
			<pre className="mono overflow-x-auto rounded-xl bg-surface-alt p-3 text-[11px] sm:text-xs">
				{JSON.stringify(value, null, 2)}
			</pre>
		);
	}

	return <p className="text-sm">{String(value)}</p>;
}

export function AIResponsePanel({ title, content }: AIResponsePanelProps) {
	const objectContent = content && typeof content === "object" ? (content as Record<string, unknown>) : null;

	return (
		<section className="card p-4 sm:p-5">
			<h3 className="text-base font-semibold text-foreground">{title}</h3>

			{objectContent ? (
				<div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
					{Object.entries(objectContent).map(([key, value]) => (
						<div key={key} className="rounded-xl border border-border p-3">
							<p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{key}</p>
							{renderValue(value)}
						</div>
					))}
				</div>
			) : (
				<div className="mt-4 rounded-xl border border-border p-3">{renderValue(content)}</div>
			)}
		</section>
	);
}
