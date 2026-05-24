import { Sparkles } from 'lucide-react';
import Button from '../ui/Button';

/**
 * AI Generate button — consistent CTA for triggering Claude generation.
 *
 * @param {{ onClick: () => void, loading?: boolean, label?: string, disabled?: boolean, size?: 'sm'|'md' }} props
 */
export default function AIGenerateButton({
  onClick,
  loading = false,
  label = 'Generate with AI',
  disabled = false,
  size = 'sm',
}) {
  return (
    <Button
      variant="secondary"
      size={size}
      onClick={onClick}
      loading={loading}
      disabled={disabled || loading}
      className="border-brand-purple/30 text-brand-purple hover:bg-brand-purple/10 hover:border-brand-purple/50"
    >
      {!loading && <Sparkles size={13} className="text-brand-purple" />}
      {label}
    </Button>
  );
}
