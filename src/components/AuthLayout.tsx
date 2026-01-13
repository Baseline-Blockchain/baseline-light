import { motion } from "framer-motion";

export function AuthLayout({ hero, children }: { hero: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="min-h-screen flex items-center justify-center p-4 md:p-8 overflow-y-auto bg-bg relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_var(--tw-gradient-stops))] from-accent/10 via-bg to-bg pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="relative w-full max-w-5xl grid lg:grid-cols-2 gap-8 md:gap-12 p-6 md:p-10 rounded-3xl bg-panel/30 backdrop-blur-xl border border-white/5 shadow-2xl"
            >
                <div className="flex flex-col gap-6 justify-center">
                    {hero}
                </div>
                <div className="flex flex-col justify-center">
                    <div className="bg-panel-strong/40 backdrop-blur-sm rounded-2xl p-6 border border-white/5 shadow-inner">
                        {children}
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
