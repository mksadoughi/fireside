"use client";

import { motion } from "framer-motion";
import { Shield, Heart, Cpu, Check, Copy, Download } from "lucide-react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Logo } from "../components/Logo";
import { ThemeToggle } from "../components/ThemeToggle";

export default function Home() {
    const [copied, setCopied] = useState(false);
    const [downloads, setDownloads] = useState<number | null>(null);

    useEffect(() => {
        fetch("https://api.github.com/repos/mksadoughi/fireside/releases")
            .then(res => res.ok ? res.json() : [])
            .then((releases: Array<{ assets: Array<{ download_count: number }> }>) => {
                const total = releases.reduce((sum: number, r: { assets: Array<{ download_count: number }> }) =>
                    sum + r.assets.reduce((s: number, a: { download_count: number }) => s + a.download_count, 0), 0);
                if (total > 0) setDownloads(total);
            })
            .catch(() => {});
    }, []);

    const copyCommand = () => {
        navigator.clipboard.writeText("curl -fsSL https://fireside.run/install | sh");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="min-h-screen bg-background text-foreground selection:bg-fire-orange/30 overflow-hidden font-sans">

            {/* Navigation */}
            <nav className="fixed top-0 w-full z-50 border-b border-black/5 bg-background/80 backdrop-blur-md">
                <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                        <Logo className="w-7 h-7" />
                        <span className="font-bold text-lg tracking-tight">Fireside</span>
                    </Link>
                    <div className="flex items-center gap-3 sm:gap-6 text-sm font-medium text-foreground/60">
                        <Link href="/docs" className="flex-shrink-0 hover:text-foreground transition-colors">Docs</Link>
                        <a href="https://github.com/mksadoughi/fireside" target="_blank" rel="noreferrer" className="flex-shrink-0 hover:text-foreground transition-colors">
                            <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" /><path d="M9 18c-4.51 2-5-2-7-2" /></svg>
                        </a>
                        <ThemeToggle />
                    </div>
                </div>
            </nav>

            <main className="pt-32 pb-24 relative">
                {/* Abstract Background Glows */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[400px] opacity-20 pointer-events-none">
                    <div className="absolute inset-0 bg-fire-orange blur-[120px] rounded-full mix-blend-screen transform -translate-y-1/2" />
                    <div className="absolute inset-0 bg-cyan-glow blur-[120px] rounded-full mix-blend-screen scale-75 transform translate-y-1/4 translate-x-1/4" />
                </div>

                {/* Hero Section */}
                <div className="max-w-6xl mx-auto px-6 relative z-10 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <h1 className="text-4xl md:text-6xl font-extrabold tracking-[-0.03em] leading-tight mb-8">
                            A private AI server you can <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-fire-orange to-amber-400">
                                securely share with a link.
                            </span>
                        </h1>

                        <p className="text-xl text-foreground/60 max-w-2xl mx-auto mb-20 leading-relaxed">
                            A free, open-source platform that lets you host AI models locally. Turn your computer into a private server your family and friends can securely access from anywhere—in under 5 minutes.
                        </p>

                        {/* Terminal Block */}
                        <div className="max-w-xl mx-auto">
                            <p className="text-sm text-foreground/50 mb-4 font-medium">
                                Available for macOS and Linux. Run this command to install:
                            </p>
                            <div className="rounded-xl overflow-hidden border border-foreground/10 bg-[#050505] shadow-2xl shadow-fire-orange/5 relative group text-white">
                                {/* Mac OS Window Controls */}
                                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-white/[0.02]">
                                    <div className="w-3 h-3 rounded-full bg-white/10" />
                                    <div className="w-3 h-3 rounded-full bg-white/10" />
                                    <div className="w-3 h-3 rounded-full bg-white/10" />
                                    <div className="flex-1 text-center text-xs text-white/40 font-mono">Terminal</div>
                                </div>

                                {/* Command Line */}
                                <div className="p-6 flex items-center justify-between text-left">
                                    <code className="text-sm md:text-base font-mono text-cyan-glow">
                                        <span className="text-white/40 select-none mr-4">$</span>
                                        <span className="text-white">curl -fsSL https://fireside.run/install | sh</span>
                                    </code>

                                    <button
                                        onClick={copyCommand}
                                        className="p-2 -mr-2 text-white/40 hover:text-white transition-colors bg-white/5 hover:bg-white/10 rounded-lg flex-shrink-0"
                                        aria-label="Copy command"
                                    >
                                        {copied ? <Check size={18} className="text-green-400" /> : <Copy size={18} />}
                                    </button>
                                </div>
                            </div>
                            {downloads !== null && (
                                <p className="mt-4 text-sm text-foreground/40 flex items-center justify-center gap-1.5">
                                    <Download size={14} />
                                    {downloads.toLocaleString()} downloads
                                </p>
                            )}
                        </div>
                    </motion.div>
                </div>

                {/* Features Grid */}
                <div className="max-w-6xl mx-auto px-6 mt-32 relative z-10">
                    <div className="grid md:grid-cols-3 gap-6">
                        <FeatureCard
                            icon={<Heart className="text-fire-orange" size={24} />}
                            title="100% Free & Open Source"
                            description="Fireside is completely free. There are no subscriptions, no locked features, and no usage limits. You own the platform and can verify the code yourself."
                            delay={0.1}
                        />
                        <FeatureCard
                            icon={<Shield className="text-cyan-glow" size={24} />}
                            title="Private & Secure First"
                            description="Your data stays on your machine. Messages are encrypted before they even leave the browser, and the AI runs entirely on your hardware — nothing is sent to a third party."
                            delay={0.2}
                        />
                        <FeatureCard
                            icon={<Cpu className="text-amber-400" size={24} />}
                            title="Your Hardware, Their Access"
                            description="The people you share with don't need a powerful computer. They just open a link on their phone or laptop. Your machine does all the thinking — they just enjoy the answers."
                            delay={0.3}
                        />
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-foreground/5 mt-12 py-12 text-center text-foreground/40 text-sm">
                <p>Built for privacy. Open source under <a href="https://github.com/mksadoughi/fireside/blob/main/LICENSE" target="_blank" rel="noreferrer" className="underline hover:text-foreground transition-colors">AGPL-3.0</a>.</p>
                <div className="flex flex-wrap gap-x-6 gap-y-2 justify-center mt-4">
                    <Link href="/docs" className="hover:text-foreground transition-colors">Docs</Link>
                    <a href="https://github.com/mksadoughi/fireside" target="_blank" rel="noreferrer" className="hover:text-foreground transition-colors">GitHub</a>
                    <a href="https://github.com/mksadoughi/fireside/issues/new?template=bug_report.md" target="_blank" rel="noreferrer" className="hover:text-foreground transition-colors">Report a Bug</a>
                    <a href="https://github.com/mksadoughi/fireside/issues/new?template=feature_request.md" target="_blank" rel="noreferrer" className="hover:text-foreground transition-colors">Suggest a Feature</a>
                </div>
            </footer>
        </div>
    );
}

function FeatureCard({ icon, title, description, delay }: { icon: React.ReactNode, title: string, description: string, delay: number }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay }}
            className="p-6 rounded-2xl bg-foreground/[0.02] border border-foreground/5 hover:bg-foreground/[0.04] transition-colors"
        >
            <div className="w-12 h-12 rounded-xl bg-foreground/[0.05] flex items-center justify-center mb-6">
                {icon}
            </div>
            <h3 className="text-xl font-bold mb-3">{title}</h3>
            <p className="text-foreground/60 leading-relaxed text-sm">
                {description}
            </p>
        </motion.div>
    );
}
