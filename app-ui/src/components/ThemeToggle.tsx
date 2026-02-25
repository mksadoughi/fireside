import { useTheme } from "./ThemeProvider";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();

    const toggleTheme = () => {
        setTheme(theme === "dark" || theme === "system" ? "light" : "dark");
    };

    return (
        <button
            onClick={toggleTheme}
            title="Toggle theme"
            className="p-2 rounded-full text-muted hover:text-foreground hover:bg-surface transition-colors cursor-pointer"
        >
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
        </button>
    );
}
