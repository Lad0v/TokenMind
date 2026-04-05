import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
}

export function Card({ children, className = '', padding = 'md', interactive = false, ...props }: CardProps) {
  const paddingMap = {
    none: 'p-0',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <div
      className={`
        rounded-2xl border transition-all duration-300
        ${paddingMap[padding]}
        ${interactive ? 'hover:-translate-y-1 hover:shadow-lg cursor-pointer hover:border-emerald-500/30' : ''}
        ${className}
      `}
      style={{
        backgroundColor: 'var(--bg-card)',
        borderColor: 'var(--border-color)',
        boxShadow: interactive ? undefined : '0 4px 20px -2px rgba(0, 0, 0, 0.5)',
      }}
      {...props}
    >
      {children}
    </div>
  );
}
