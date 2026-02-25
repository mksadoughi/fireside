import { useEffect, useState, useCallback, type FormEvent } from "react";
import * as api from "@/lib/api";
import type { User, Invite } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { UserPlus, Trash2, KeyRound, Copy, Check } from "lucide-react";

export function UsersTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [expiresIn, setExpiresIn] = useState("7d");
  const [newInviteUrl, setNewInviteUrl] = useState<string | null>(null);
  const [newInviteToken, setNewInviteToken] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Reset password modal
  const [resetModal, setResetModal] = useState<{ userId: number; username: string } | null>(null);
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");

  const loadUsers = useCallback(async () => {
    const resp = await api.getAdminUsers();
    if (resp.ok) {
      const data = (await resp.json()) as { users: User[] };
      setUsers(data.users || []);
    }
  }, []);

  const loadInvites = useCallback(async () => {
    const resp = await api.getAdminInvites();
    if (resp.ok) {
      const data = (await resp.json()) as { invites: Invite[] };
      setInvites(data.invites || []);
    }
  }, []);

  useEffect(() => {
    loadUsers();
    loadInvites();
  }, [loadUsers, loadInvites]);

  const handleRevoke = async (id: number) => {
    if (!confirm("Revoke this user? They will lose access immediately and all their history will be deleted.")) return;
    await api.deleteUser(id);
    loadUsers();
  };

  const handleCreateInvite = async () => {
    setCreating(true);
    const { resp, data } = await api.createInvite({ max_uses: 1, expires_in: expiresIn });
    if (resp.ok) {
      setNewInviteUrl(data.url);
      // Extract token from URL path: /invite/TOKEN#key=...
      const match = data.url.match(/\/invite\/([^#?]+)/);
      setNewInviteToken(match?.[1] ?? null);
      await loadInvites();
    }
    setCreating(false);
  };

  const handleRevokeInvite = async (id: number) => {
    await api.deleteInvite(id);
    loadInvites();
  };

  const handleCopyInvite = (token: string) => {
    // Find the matching invite URL — if it's the newly created one, use the full URL
    // Otherwise construct from window.location
    let url = newInviteUrl && newInviteToken === token ? newInviteUrl : `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!resetModal) return;
    setResetError("");
    setResetSuccess("");

    const form = e.target as HTMLFormElement;
    const newPw = (form.elements.namedItem("newPw") as HTMLInputElement).value;
    const confirmPw = (form.elements.namedItem("confirmPw") as HTMLInputElement).value;

    if (newPw !== confirmPw) {
      setResetError("Passwords do not match");
      return;
    }

    try {
      const { resp, data } = await api.resetUserPassword(resetModal.userId, newPw);
      if (resp.ok) {
        setResetSuccess("Password has been reset.");
        setTimeout(() => setResetModal(null), 1500);
      } else {
        setResetError((data as { error?: string }).error || "Failed to reset password.");
      }
    } catch {
      setResetError("Connection failed.");
    }
  };

  const getInviteStatus = (inv: Invite) => {
    if (inv.uses >= inv.max_uses) return { label: "Used", variant: "default" as const };
    if (inv.expires_at && new Date(inv.expires_at) < new Date()) return { label: "Expired", variant: "default" as const };
    return { label: "Pending", variant: "warning" as const };
  };

  return (
    <div>
      <p className="text-sm text-muted mb-6">Manage who has access to your Fireside server and invite new people.</p>

      {/* Users section */}
      <h2 className="text-sm font-semibold text-foreground mb-3">Members</h2>
      {users.length === 0 ? (
        <p className="text-muted text-sm mb-8">No users yet. Create an invite below to get started.</p>
      ) : (
        <div className="overflow-x-auto mb-8">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="pb-2 font-medium">User</th>
                <th className="pb-2 font-medium">Role</th>
                <th className="pb-2 font-medium">Joined</th>
                <th className="pb-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border/50">
                  <td className="py-2.5">{u.display_name || u.username}</td>
                  <td className="py-2.5">
                    {u.is_admin ? (
                      <Badge variant="info">Admin</Badge>
                    ) : (
                      <Badge>User</Badge>
                    )}
                  </td>
                  <td className="py-2.5 text-muted">{formatDate(u.created_at)}</td>
                  <td className="py-2.5 text-right">
                    {!u.is_admin && (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setResetModal({ userId: u.id, username: u.username });
                            setResetError("");
                            setResetSuccess("");
                          }}
                        >
                          <KeyRound size={13} />
                          Reset
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-danger hover:text-danger"
                          onClick={() => handleRevoke(u.id)}
                        >
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Invites section */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground">Invite Links</h2>
        <div className="flex items-center gap-2">
          <Select
            value={expiresIn}
            onChange={(e) => setExpiresIn(e.target.value)}
            className="w-32 text-xs"
          >
            <option value="1h">1 hour</option>
            <option value="24h">24 hours</option>
            <option value="7d">7 days</option>
            <option value="30d">30 days</option>
            <option value="never">Never</option>
          </Select>
          <Button onClick={handleCreateInvite} disabled={creating} size="sm">
            <UserPlus size={14} />
            Invite a Friend
          </Button>
        </div>
      </div>

      {invites.length === 0 ? (
        <p className="text-muted text-sm">No invites yet. Click "Invite a Friend" to generate a shareable link.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="pb-2 font-medium">Link</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Expires</th>
                <th className="pb-2 font-medium">Created</th>
                <th className="pb-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((inv) => {
                const status = getInviteStatus(inv);
                const isActive = status.label === "Pending";
                const justCopied = copiedToken === inv.token;
                return (
                  <tr key={inv.id} className="border-b border-border/50">
                    <td className="py-2.5">
                      {isActive ? (
                        <button
                          onClick={() => handleCopyInvite(inv.token)}
                          className="inline-flex items-center gap-1.5 text-xs font-mono text-fire-orange hover:text-fire-orange/80 cursor-pointer transition-colors"
                        >
                          {justCopied ? (
                            <>
                              <Check size={12} className="text-success" />
                              <span className="text-success">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy size={12} />
                              {inv.token.substring(0, 10)}… · Copy link
                            </>
                          )}
                        </button>
                      ) : (
                        <span className="font-mono text-xs text-muted">
                          {inv.token.substring(0, 10)}…
                        </span>
                      )}
                    </td>
                    <td className="py-2.5">
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </td>
                    <td className="py-2.5 text-muted">
                      {inv.expires_at ? formatDate(inv.expires_at) : "Never"}
                    </td>
                    <td className="py-2.5 text-muted">{formatDate(inv.created_at)}</td>
                    <td className="py-2.5 text-right">
                      {isActive && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-danger hover:text-danger"
                          onClick={() => handleRevokeInvite(inv.id)}
                        >
                          Revoke
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Reset Password Modal */}
      <Modal
        open={resetModal !== null}
        onClose={() => setResetModal(null)}
        title={`Reset password for ${resetModal?.username || ""}`}
      >
        <form onSubmit={handleResetPassword} className="space-y-4">
          {resetError && (
            <div className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
              {resetError}
            </div>
          )}
          {resetSuccess && (
            <div className="text-sm text-success bg-success/10 border border-success/20 rounded-lg px-3 py-2">
              {resetSuccess}
            </div>
          )}
          <Input
            name="newPw"
            type="password"
            label="New password"
            required
            autoFocus
          />
          <Input
            name="confirmPw"
            type="password"
            label="Confirm password"
            required
          />
          <Button type="submit" className="w-full">
            Reset password
          </Button>
        </form>
      </Modal>
    </div>
  );
}
