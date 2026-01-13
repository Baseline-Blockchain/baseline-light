import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "../../lib/utils";

interface CardProps extends HTMLMotionProps<"div"> {
    glass?: boolean;
}

export function Card({ className, glass = true, children, ...props }: CardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
                "p-6 rounded-2xl border", // Base layout
                glass
                    ? "bg-panel/40 backdrop-blur-xl border-white/5 shadow-2xl"
                    : "bg-panel border-border shadow-xl",
                className
            )}
            {...props}
        >
            {children}
        </motion.div>
    );
}
