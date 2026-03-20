export function LoadingSpinner({ label = "Loading..." }: { label?: string }) {
	return (
		<div className="inline-flex items-center gap-3 rounded-2xl border border-border bg-secondary px-4 py-3 text-[15px] font-medium text-foreground shadow-sm">
			<span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-border border-t-brand" />
			<span>{label}</span>
		</div>
	);
}
