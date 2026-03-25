"use client";

interface FormFieldProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

export function FormField({ label, children, className }: FormFieldProps) {
  return (
    <div className={className}>
      <label className="block text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

export const inputClass = "w-full border border-border rounded px-2 py-1.5 text-sm bg-background";
export const monoInputClass = `${inputClass} font-mono`;
