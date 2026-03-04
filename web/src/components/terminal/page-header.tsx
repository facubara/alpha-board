interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
}

export function PageHeader({ title, subtitle, badge }: PageHeaderProps) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-sans font-semibold tracking-tight text-text-primary">
          {title}
        </h1>
        {badge && (
          <span className="text-xs font-mono uppercase tracking-wider bg-terminal-amber-muted text-terminal-amber px-2 py-0.5 rounded-none border border-terminal-amber">
            {badge}
          </span>
        )}
      </div>
      {subtitle && (
        <p className="mt-1 text-sm text-text-secondary font-sans">{subtitle}</p>
      )}
    </div>
  );
}
