import { useState, useRef, useEffect } from "react";
import { CaretDown, Check } from "phosphor-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../../lib/utils";

export interface SelectOption {
    label: string;
    value: string;
    disabled?: boolean;
    detail?: string; // For extra info like balance
}

interface SelectProps {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    options: SelectOption[];
    placeholder?: string;
    className?: string;
    disabled?: boolean;
}

export function Select({ label, value, onChange, options, placeholder = "Select...", className, disabled }: SelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(o => o.value === value);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelect = (option: SelectOption) => {
        if (option.disabled || disabled) return;
        onChange(option.value);
        setIsOpen(false);
    };

    return (
        <div className={cn("flex flex-col gap-2 w-full relative", className)} ref={containerRef}>
            {label && <label className="text-xs font-bold uppercase tracking-wider text-muted ml-1">{label}</label>}

            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={cn(
                    "w-full px-4 py-3 bg-panel-strong/50 border border-white/5 rounded-xl flex items-center justify-between transition-all text-left",
                    "focus:outline-none focus:ring-2 focus:border-accent/50 focus:ring-accent/20",
                    isOpen ? "border-accent/50 ring-2 ring-accent/20" : "hover:bg-white/5",
                    disabled && "opacity-50 cursor-not-allowed",
                )}
            >
                <div>
                    {selectedOption ? (
                        <div className="flex flex-col items-start leading-tight">
                            <span className="font-medium text-sm block truncate">{selectedOption.label}</span>
                            {selectedOption.detail && <span className="text-[10px] text-muted font-mono">{selectedOption.detail}</span>}
                        </div>
                    ) : (
                        <span className="text-muted/50">{placeholder}</span>
                    )}
                </div>
                <CaretDown weight="bold" className={cn("text-muted transition-transform", isOpen && "rotate-180")} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className="absolute z-50 top-full mt-2 left-0 w-full min-w-[200px] bg-[#1a1e29] border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-[300px] overflow-y-auto backdrop-blur-xl"
                        style={{ boxShadow: "0 10px 40px rgba(0,0,0,0.5)" }}
                    >
                        <div className="p-1.5 space-y-0.5">
                            {options.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => handleSelect(option)}
                                    disabled={option.disabled}
                                    className={cn(
                                        "w-full px-3 py-2 rounded-lg flex items-center justify-between text-left transition-colors",
                                        option.value === value ? "bg-accent/10 text-accent" : "hover:bg-white/5 text-muted hover:text-white",
                                        option.disabled && "opacity-40 cursor-not-allowed hover:bg-transparent"
                                    )}
                                >
                                    <div className="flex flex-col gap-0.5 overflow-hidden">
                                        <span className={cn("text-sm font-medium truncate", option.value === value && "font-bold")}>{option.label}</span>
                                        {option.detail && <span className="text-[10px] opacity-70 font-mono truncate">{option.detail}</span>}
                                    </div>
                                    {option.value === value && <Check weight="bold" size={14} />}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
