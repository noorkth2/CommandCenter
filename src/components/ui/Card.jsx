/**
 * Card component.
 *
 * @param {{ elevated?: boolean, children: React.ReactNode, className?: string } & React.HTMLAttributes<HTMLDivElement>} props
 */
export default function Card({ children, className = '', ...props }) {
  return (
    <div className={`card ${className}`} {...props}>
      {children}
    </div>
  );
}
