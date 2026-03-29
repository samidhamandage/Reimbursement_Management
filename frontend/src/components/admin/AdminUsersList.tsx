"use client";

import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { User, usersApi } from "@/lib/api";
import { Users, Plus, Pencil, Shield, BadgeCheck, User as UserIcon, Loader2 } from "lucide-react";

export function AdminUsersList() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddMode, setIsAddMode] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const data = await usersApi.list();
      setUsers(data.users);
    } catch (error) {
      console.error("Failed to fetch users:", error);
      toast.error("Failed to load users");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("EMPLOYEE");
  const [managerId, setManagerId] = useState("none");

  const managers = users.filter(u => u.role === "MANAGER" || u.role === "ADMIN");

  const resetForm = () => {
    setName("");
    setEmail("");
    setPassword("");
    setRole("EMPLOYEE");
    setManagerId("none");
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsAddMode(true);
    setEditingUser(null);
  };

  const handleOpenEdit = (user: User) => {
    setName(user.name);
    setEmail(user.email);
    setPassword(""); // don't show existing
    setRole(user.role);
    setManagerId(user.managerId || "none");
    setEditingUser(user);
    setIsAddMode(true);
  };

  const handleSave = async () => {
    if (!name || !email || (!editingUser && !password)) {
      toast.error("Please fill Name, Email and Password");
      return;
    }
    
    setIsSubmitting(true);
    try {
      if (editingUser) {
        await usersApi.update(editingUser.id, {
          name,
          email,
          role,
          managerId: managerId === "none" ? null : managerId || null
        });
        toast.success("User updated successfully");
      } else {
        await usersApi.create({
          name,
          email,
          password,
          role,
          managerId: managerId === "none" ? null : managerId || null
        });
        toast.success("User added successfully");
      }
      setIsAddMode(false);
      fetchUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save user");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Organization Users</h2>
          <p className="text-sm text-muted-foreground">Manage roles, hierarchies and workspace access.</p>
        </div>
        <Button onClick={handleOpenAdd}>
          <Plus className="w-4 h-4 mr-2" /> Add User
        </Button>
      </div>

      <Card className="bg-card/40 backdrop-blur-xl border-white/5">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50 border-border">
              <TableRow>
                <TableHead className="px-6 py-4">Employee</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Manager/Reports To</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right px-6">Manage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center text-muted-foreground">
                    <Loader2 className="w-10 h-10 mx-auto animate-spin opacity-20 mb-3" />
                    Loading users...
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center text-muted-foreground">
                   No users found.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id} className="hover:bg-muted/30 border-border">
                  <TableCell className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-semibold text-foreground">{user.name}</span>
                      <span className="text-sm text-muted-foreground">{user.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {user.role === "ADMIN" && <Badge className="bg-primary/20 text-primary hover:bg-primary/30"><Shield className="w-3 h-3 mr-1" /> Admin</Badge>}
                    {user.role === "MANAGER" && <Badge className="bg-amber-500/20 text-amber-500 hover:bg-amber-500/30"><BadgeCheck className="w-3 h-3 mr-1" /> Manager</Badge>}
                    {user.role === "EMPLOYEE" && <Badge variant="secondary" className="bg-muted text-muted-foreground"><UserIcon className="w-3 h-3 mr-1" /> Employee</Badge>}
                  </TableCell>
                  <TableCell>
                    {user.managerId ? (
                      <span className="text-sm text-muted-foreground">
                        {users.find(u => u.id === user.managerId)?.name || 'Unknown'}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground/50 italic">None</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.createdAt ? format(new Date(user.createdAt), "MMM d, yyyy") : "-"}
                  </TableCell>
                  <TableCell className="text-right px-6">
                    <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(user)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isAddMode} onOpenChange={setIsAddMode}>
        <DialogContent className="sm:max-w-md border-border bg-card/95 backdrop-blur-2xl">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Edit User" : "Add Workspace User"}</DialogTitle>
            <DialogDescription>
              Deploy a new invite or adjust existing permissions.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} className="bg-background/50 h-10" />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={role} onValueChange={(v) => v && setRole(v as UserRole)}>
                  <SelectTrigger className="bg-background/50 h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EMPLOYEE">Employee</SelectItem>
                    <SelectItem value="MANAGER">Manager</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} className="bg-background/50 h-10" />
            </div>

            {!editingUser && (
              <div className="space-y-2">
                <Label>Temporary Password</Label>
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} className="bg-background/50 h-10" />
              </div>
            )}

            <div className="space-y-2">
              <Label>Reports To (Manager)</Label>
              <Select value={managerId} onValueChange={(v) => v && setManagerId(v)}>
                <SelectTrigger className="bg-background/50 h-10">
                  <SelectValue placeholder="No Manager Selected">
                    {managerId && managerId !== "none" ? (
                      users.find(u => u.id === managerId)?.name
                    ) : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="text-muted-foreground italic">None</SelectItem>
                  {managers.filter(m => m.id !== editingUser?.id).map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.name} ({m.role})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter className="mt-4">
             <Button variant="ghost" onClick={() => setIsAddMode(false)} disabled={isSubmitting}>Cancel</Button>
             <Button className="font-semibold" onClick={handleSave} disabled={isSubmitting}>
               {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
               {editingUser ? "Save Changes" : "Create User"}
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
