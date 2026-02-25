import { useNavigate } from "react-router";
import { useAuthStore } from "@/stores/auth-store";
import * as api from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { LogOut, KeyRound } from "lucide-react";
import { useState, useRef, useEffect, type FormEvent } from "react";

export function UserDropdown() {
    const user = useAuthStore((s) => s.user);
    const logout = useAuthStore((s) => s.logout);
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [showPwModal, setShowPwModal] = useState(false);
    const [pwMsg, setPwMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    const handleLogout = async () => {
        await logout();
        navigate("/login");
    };

    const handleChangePassword = async (e: FormEvent) => {
        e.preventDefault();
        setPwMsg(null);

        const form = e.target as HTMLFormElement;
        const current = (form.elements.namedItem("currentPw") as HTMLInputElement).value;
        const newPw = (form.elements.namedItem("newPw") as HTMLInputElement).value;
        const confirmPw = (form.elements.namedItem("confirmPw") as HTMLInputElement).value;

        if (newPw !== confirmPw) {
            setPwMsg({ text: "Passwords do not match.", type: "error" });
            return;
        }

        const { resp, data } = await api.changeAdminPassword({
            current_password: current,
            new_password: newPw,
        });
        if (resp.ok) {
            setPwMsg({ text: "Password updated.", type: "success" });
            form.reset();
            setTimeout(() => {
                setShowPwModal(false);
                setPwMsg(null);
            }, 1500);
        } else {
            setPwMsg({
                text: (data as { error?: string }).error || "Failed to update.",
                type: "error",
            });
        }
    };

    if (!user) return null;

    return (
        <>
            <div className="relative" ref={menuRef}>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-3 w-full p-2 rounded-xl hover:bg-surface-hover transition-colors cursor-pointer group"
                >
                    <div className="w-8 h-8 rounded-full bg-fire-orange/20 text-fire-orange flex items-center justify-center shrink-0 font-medium text-sm">
                        {(user.display_name || user.username).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                        <div className="text-sm font-medium truncate">
                            {user.display_name || user.username}
                        </div>
                        <div className="text-xs text-muted truncate">{user.is_admin ? "Administrator" : "Member"}</div>
                    </div>
                </button>

                {isOpen && (
                    <div className="absolute bottom-full left-0 w-full mb-2 bg-background border border-border-strong rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200 z-50">
                        <div className="p-2 space-y-0.5">
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    setShowPwModal(true);
                                    setPwMsg(null);
                                }}
                                className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-muted hover:text-foreground hover:bg-surface-hover transition-colors cursor-pointer"
                            >
                                <KeyRound size={14} />
                                Change password
                            </button>
                            <button
                                onClick={handleLogout}
                                className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-danger hover:bg-danger/10 transition-colors cursor-pointer"
                            >
                                <LogOut size={14} />
                                Sign out
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Change Password Modal */}
            <Modal
                open={showPwModal}
                onClose={() => setShowPwModal(false)}
                title="Change password"
            >
                <form onSubmit={handleChangePassword} className="space-y-4">
                    {pwMsg && (
                        <div className={`text-sm border rounded-lg px-3 py-2 ${pwMsg.type === "success"
                                ? "text-success bg-success/10 border-success/20"
                                : "text-danger bg-danger/10 border-danger/20"
                            }`}>
                            {pwMsg.text}
                        </div>
                    )}
                    <Input
                        name="currentPw"
                        type="password"
                        label="Current password"
                        required
                        autoFocus
                    />
                    <Input
                        name="newPw"
                        type="password"
                        label="New password"
                        required
                    />
                    <Input
                        name="confirmPw"
                        type="password"
                        label="Confirm new password"
                        required
                    />
                    <Button type="submit" className="w-full">
                        Update password
                    </Button>
                </form>
            </Modal>
        </>
    );
}
