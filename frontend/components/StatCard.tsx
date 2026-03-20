interface StatCardProps {
	label: string;
	value: number;
}

export function StatCard({ label, value }: StatCardProps) {
	return (
		<div className="card relative overflow-hidden p-5">
			<div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-brand to-brand-strong" />
			<p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
			<p className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl">{value}</p>
		</div>
	);
}
