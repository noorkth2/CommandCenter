/**
 * Card component.
 *
 * @param {{ elevated?: boolean, children: React.ReactNode, className?: string } & React.HTMLAttributes<HTMLDivElement>} props
 */
export default function Card({ elevated = false, children, className = '', ...props }) {
  return (
    <div className={`${elevated ? 'card-elevated' : 'card'} ${className}`} {...props}>
      {children}
    </div>
  );
}
