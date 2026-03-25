interface CardProps {
  children: React.ReactNode;
  className?: string;
  selected?: boolean;
  onClick?: () => void;
}

export function Card({ children, className = '', selected, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        bg-white rounded-2xl border
        ${selected ? 'border-gray-900 border-2' : 'border-gray-100'}
        ${onClick ? 'cursor-pointer hover:shadow-md transition-all duration-200' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
