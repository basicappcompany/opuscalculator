import * as React from 'react';
import { cn } from '../../lib/utils';

/** Native <select> styled like shadcn's Select: accessible by default and adds no JavaScript. */
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn('h-10 w-full rounded-md border border-border-strong bg-card px-3 text-base text-fg disabled:opacity-50', className)}
    {...props}
  />
));
Select.displayName = 'Select';
