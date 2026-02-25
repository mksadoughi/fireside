import { Card } from "@/components/ui/Card";
import React from "react";
import { cn } from "@/lib/utils";

/**
 * A simple stacked layout component for Settings.
 */
export function SettingCard({
    title,
    description,
    children,
    className,
    danger,
}: {
    title: string;
    description: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    danger?: boolean;
}) {
    return (
        <Card className={cn("mb-6 overflow-hidden shadow-sm", danger && "border-danger/20 bg-danger/5", className)}>
            <div className="px-5 py-4 border-b border-border/50">
                <h2 className={cn("text-base font-semibold mb-1", danger ? "text-danger" : "text-foreground")}>{title}</h2>
                <div className="text-sm text-muted">{description}</div>
            </div>
            <div className="px-5 py-4 flex flex-col gap-4">
                {children}
            </div>
        </Card>
    );
}
