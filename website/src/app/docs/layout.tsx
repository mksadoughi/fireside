"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Logo } from "../../components/Logo";
import { ThemeToggle } from "../../components/ThemeToggle";

const docs = [
    { title: "What is Fireside", href: "/docs/what-is-fireside" },
    { title: "Getting Started", href: "/docs/getting-started" },
    { title: "FAQ", href: "/docs/faq" },
];

const guides = [
    { title: "Chatbot in 5 Minutes", href: "/guides/quickstart" },
    { title: "Connect Open WebUI", href: "/guides/open-webui" },
    { title: "Build with LangChain", href: "/guides/langchain" },
];

export default function DocsLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isDesktop, setIsDesktop] = useState(true); // Default high to avoid flash of mobile menu on SSR if possible, but effect will correct it

    // Ensure the mobile menu closes automatically when scaling window back up to desktop
    // and track desktop state for conditional rendering
    useEffect(() => {
        const handleResize = () => {
            const desktop = window.innerWidth >= 768;
            setIsDesktop(desktop);
            if (desktop) {
                setIsMobileMenuOpen(false);
            }
        };
        // Set initial state
        handleResize();

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    return (
        <div className="min-h-screen bg-background text-foreground font-sans selection:bg-fire-orange/30">
            {/* Top nav */}
            <nav className="border-b border-black/5 bg-background/80 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                        <Logo className="w-7 h-7" />
                        <span className="font-bold text-lg tracking-tight">Fireside</span>
                    </Link>
                    <div className="flex items-center gap-3 sm:gap-6 text-sm font-medium text-foreground/60">
                        <Link href="/docs" className="hidden sm:block flex-shrink-0 hover:text-foreground transition-colors">Docs</Link>
                        <a href="https://github.com/mksadoughi/fireside" target="_blank" rel="noreferrer" className="flex-shrink-0 hover:text-foreground transition-colors">
                            <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" /><path d="M9 18c-4.51 2-5-2-7-2" /></svg>
                        </a>
                        <div className="flex-shrink-0">
                            <ThemeToggle />
                        </div>

                        {/* Mobile Menu Toggle Button */}
                        {!isDesktop && (
                            <div className="flex items-center pl-4 ml-2 border-l border-foreground/10">
                                <button
                                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                    className="p-1.5 -mr-1.5 rounded-md text-foreground/70 hover:text-foreground hover:bg-foreground/5 transition-colors"
                                    aria-label="Toggle Navigation Menu"
                                >
                                    {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </nav>

            {/* Mobile Dropdown Menu */}
            {!isDesktop && isMobileMenuOpen && (
                <div className="bg-background border-b border-black/5 dark:border-white/5 sticky top-16 z-30 max-h-[calc(100vh-4rem)] overflow-y-auto shadow-2xl">
                    <div className="px-6 py-6 pb-12">
                        <div className="mb-8">
                            <p className="text-xs font-semibold uppercase tracking-widest text-foreground/40 mb-3 px-2">Docs</p>
                            <ul className="space-y-1.5">
                                {docs.map((doc) => (
                                    <li key={doc.href}>
                                        <Link
                                            href={doc.href}
                                            onClick={() => setIsMobileMenuOpen(false)}
                                            className={`block text-[15px] py-3 px-4 rounded-xl transition-colors ${pathname === doc.href
                                                ? "text-foreground bg-foreground/5 font-medium"
                                                : "text-foreground/60 hover:text-foreground hover:bg-foreground/[0.03]"
                                                }`}
                                        >
                                            {doc.title}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-widest text-foreground/40 mb-3 px-2">Guides</p>
                            <ul className="space-y-1.5">
                                {guides.map((guide) => (
                                    <li key={guide.href}>
                                        <Link
                                            href={guide.href}
                                            onClick={() => setIsMobileMenuOpen(false)}
                                            className={`block text-[15px] py-3 px-4 rounded-xl transition-colors ${pathname === guide.href
                                                ? "text-foreground bg-foreground/5 font-medium"
                                                : "text-foreground/60 hover:text-foreground hover:bg-foreground/[0.03]"
                                                }`}
                                        >
                                            {guide.title}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row">
                {/* Sidebar */}
                <aside className="w-56 flex-shrink-0 py-10 pr-8 border-r border-foreground/5 hidden md:block sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
                    <div className="mb-6">
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-foreground/30 mb-3">Docs</p>
                        <ul className="space-y-1">
                            {docs.map((doc) => (
                                <li key={doc.href}>
                                    <Link
                                        href={doc.href}
                                        className={`block text-sm py-1.5 px-3 rounded-md transition-colors ${pathname === doc.href
                                            ? "text-foreground bg-foreground/[0.06] font-medium"
                                            : "text-foreground/45 hover:text-foreground hover:bg-foreground/[0.03]"
                                            }`}
                                    >
                                        {doc.title}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-foreground/30 mb-3">Guides</p>
                        <ul className="space-y-1">
                            {guides.map((guide) => (
                                <li key={guide.href}>
                                    <Link
                                        href={guide.href}
                                        className={`block text-sm py-1.5 px-3 rounded-md transition-colors ${pathname === guide.href
                                            ? "text-foreground bg-foreground/[0.06] font-medium"
                                            : "text-foreground/45 hover:text-foreground hover:bg-foreground/[0.03]"
                                            }`}
                                    >
                                        {guide.title}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </aside>

                {/* Content */}
                <main className="flex-1 min-w-0 py-8 md:py-10 md:pl-10">
                    <article className="prose-fireside max-w-3xl">
                        {children}
                    </article>
                </main>
            </div>

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
