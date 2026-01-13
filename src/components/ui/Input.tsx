import { forwardRef } from "react";
import { cn } from "../../lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, error, ...props }, ref) => {
        return (
            <div className="flex flex-col gap-2 w-full">
                {label && <label className="text-xs font-bold uppercase tracking-wider text-muted ml-1">{label}</label>}
                <input
                    className={cn(
                        "w-full px-4 py-3 bg-panel-strong/50 border border-white/5 rounded-xl focus:outline-none focus:ring-2 focus:border-accent/50 focus:ring-accent/20 transition-all placeholder:text-muted/50",
                        error && "border-danger/50 focus:border-danger focus:ring-danger/20",
                        className
                    )}
                    ref={ref}
                    {...props}
                />
                {error && <span className="text-xs text-danger ml-1">{error}</span>}
            </div>
        );
    }
);
Input.displayName = "Input";
