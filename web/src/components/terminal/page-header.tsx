interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
}

export function PageHeader({ title, subtitle, badge }: PageHeaderProps) {
  return (
    <div className="mb-6 border-b border-void-border pb-2">
      <div className="flex items-center gap-3">
        <h1 className="font-mono text-xl text-text-primary uppercase tracking-widest inline-flex items-center">
          <span className="text-text-tertiary mr-2">&gt;_</span>
          {title}
          <span className="inline-block w-2.5 h-4 bg-terminal-amber animate-pulse ml-2 align-baseline translate-y-0.5" />
        </h1>
        {badge && (
          <span className="text-xs font-mono uppercase tracking-wider bg-terminal-amber-muted text-terminal-amber px-2 py-0.5 rounded-none border border-terminal-amber">
            {badge}
          </span>
        )}
      </div>
      {subtitle && (
        <p className="mt-1 text-sm text-text-secondary font-mono">{subtitle}</p>
      )}
    </div>
  );
}
