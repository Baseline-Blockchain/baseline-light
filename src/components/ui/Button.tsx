import { motion, HTMLMotionProps } from "framer-motion";
import { CircleNotch } from "phosphor-react";
import { cn } from "../../lib/utils";

interface ButtonProps extends HTMLMotionProps<"button"> {
    variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
    size?: "sm" | "md" | "lg";
    loading?: boolean;
}

export function Button({
    className,
    variant = "primary",
    size = "md",
    loading,
    children,
    disabled,
    ...props
}: ButtonProps) {
    const variants = {
        primary: "bg-gradient-to-br from-accent-strong to-accent text-bg font-bold shadow-lg shadow-accent/20 border border-white/20 hover:brightness-110",
        secondary: "bg-panel-strong border border-white/5 hover:bg-white/5",
        ghost: "bg-transparent hover:bg-white/5 text-muted hover:text-text",
        danger: "bg-danger text-bg font-bold hover:brightness-110",
        outline: "border border-border/50 bg-transparent hover:border-accent/50 hover:bg-accent/5"
    };

    const sizes = {
        sm: "px-3 py-1.5 text-xs rounded-lg",
        md: "px-5 py-2.5 text-sm rounded-xl",
        lg: "px-6 py-3.5 text-base rounded-2xl",
    };

    return (
        <motion.button
            whileTap={{ scale: 0.98 }}
            whileHover={{ scale: 1.02 }}
            className={cn(
                "inline-flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed",
                variants[variant],
                sizes[size],
                className
            )}
            disabled={loading || disabled}
            {...props}
        >
            {loading && <CircleNotch className="animate-spin" size={18} weight="bold" />}
            {children}
        </motion.button>
    );
}
