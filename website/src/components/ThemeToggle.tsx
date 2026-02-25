"use client";

import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
    const [mounted, setMounted] = useState(false);
    const [dark, setDark] = useState(true);

    useEffect(() => {
        setMounted(true);
        const saved = localStorage.getItem("fireside-theme");
        if (saved === "light") {
            setDark(false);
            document.documentElement.classList.add("light");
        }
    }, []);

    if (!mounted) {
        return <div className="w-8 h-8" aria-hidden="true" />;
    }

    const toggle = () => {
        const next = !dark;
        setDark(next);
        if (next) {
            document.documentElement.classList.remove("light");
            localStorage.setItem("fireside-theme", "dark");
        } else {
            document.documentElement.classList.add("light");
            localStorage.setItem("fireside-theme", "light");
        }
    };

    return (
        <button
            onClick={toggle}
            className="p-1.5 rounded-md text-foreground/40 hover:text-foreground hover:bg-foreground/10 transition-colors"
            aria-label="Toggle theme"
        >
            {dark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
    );
}
