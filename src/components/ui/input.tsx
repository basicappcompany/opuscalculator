import * as React from 'react';
import { cn } from '../../lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'h-10 w-full rounded-md border border-border-strong bg-card px-3 text-base text-fg placeholder:text-muted aria-[invalid=true]:border-danger disabled:opacity-50',
      className,
    )}
    {...props}
  />
));
Input.displayName = 'Input';
