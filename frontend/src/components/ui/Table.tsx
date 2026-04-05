import React from 'react';

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm" style={{ color: 'var(--text-secondary)' }}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ children }: { children: React.ReactNode }) {
  return (
    <thead style={{ borderBottom: '1px solid var(--border-color)' }}>
      {children}
    </thead>
  );
}

export function TableRow({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  return (
    <tr
      className={`transition-colors duration-200 ${className}`}
      style={{ borderBottom: '1px solid rgba(52, 211, 153, 0.05)' }}
    >
      {children}
    </tr>
  );
}

export function TableHead({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 font-medium text-[13px] tracking-wide uppercase" style={{ color: 'var(--text-muted)' }}>
      {children}
    </th>
  );
}

export function TableCell({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  return (
    <td className={`px-4 py-3 whitespace-nowrap ${className}`}>
      {children}
    </td>
  );
}
