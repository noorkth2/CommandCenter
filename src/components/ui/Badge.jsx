/**
 * Badge component for status, priority, and label chips.
 *
 * @param {{ children: React.ReactNode, className?: string } & React.HTMLAttributes<HTMLSpanElement>} props
 */
export default function Badge({ children, className = '', ...props }) {
  return (
    <span className={`badge ${className}`} {...props}>
      {children}
    </span>
  );
}
