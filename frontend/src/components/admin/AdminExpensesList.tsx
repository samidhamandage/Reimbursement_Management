"use client";

import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { MOCK_EXPENSES, Expense, MOCK_COMPANY_BASE_CURRENCY } from "@/lib/mock";
import { Settings2, ArrowDownUp, CheckCircle2, Search, XCircle, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AdminExpensesList() {
  const [expenses, setExpenses] = useState<Expense[]>(MOCK_EXPENSES);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [isOverriding, setIsOverriding] = useState(false);

  // Filtering
  const filtered = expenses.filter(e => {
    if (statusFilter !== "ALL" && e.status !== statusFilter) return false;
    if (search && !e.employee.toLowerCase().includes(search.toLowerCase()) && !e.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DRAFT": return <Badge variant="secondary" className="bg-gray-500/20 text-gray-300">Draft</Badge>;
      case "WAITING_APPROVAL": return <Badge variant="outline" className="border-amber-500/50 text-amber-500 bg-amber-500/10">Pending</Badge>;
      case "APPROVED": return <Badge variant="default" className="bg-green-500/20 text-green-400 hover:bg-green-500/30">Approved</Badge>;
      case "REJECTED": return <Badge variant="destructive" className="bg-destructive/20 text-destructive-foreground">Rejected</Badge>;
      default: return null;
    }
  };

  const handleOverride = async () => {
    if (!overrideStatus || !selectedExpense) return;
    setIsOverriding(true);
    try {
      await new Promise(r => setTimeout(r, 600));
      setExpenses(prev => prev.map(e => e.id === selectedExpense.id ? { ...e, status: overrideStatus } : e));
      toast.success("Expense forcefully overridden by ADMIN.");
      setSelectedExpense(null);
      setOverrideStatus(null);
    } finally {
      setIsOverriding(false);
    }
  };

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Global Expenses Ledger</h2>
          <p className="text-sm text-muted-foreground">Admin-level view of all company expenses.</p>
        </div>
      </div>

      <Card className="bg-card/40 backdrop-blur-xl border-white/5 h-full flex flex-col">
        <CardHeader className="p-4 border-b border-white/5 flex flex-row items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search employee or description..." 
              value={search} onChange={e => setSearch(e.target.value)} 
              className="pl-9 h-9 bg-background/50" 
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
            <SelectTrigger className="w-[180px] h-9 bg-background/50">
              <SelectValue placeholder="Filter Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="WAITING_APPROVAL">Pending</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
              <SelectItem value="DRAFT">Drafts</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-9">
            <Settings2 className="w-4 h-4 mr-2" />
            More Filters
          </Button>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto p-0 min-h-[500px]">
          <Table>
            <TableHeader className="bg-muted/50 sticky top-0 backdrop-blur-md">
              <TableRow className="border-border">
                <TableHead className="font-semibold px-4 py-3">Employee</TableHead>
                <TableHead className="font-semibold px-4">Subject</TableHead>
                <TableHead className="font-semibold">Date</TableHead>
                <TableHead className="font-semibold text-right">Amount</TableHead>
                <TableHead className="font-semibold text-center w-[120px]">Status</TableHead>
                <TableHead className="text-right w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                    No matching expenses.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((expense) => (
                  <TableRow key={expense.id} className="hover:bg-muted/50 border-border group transition-all">
                    <TableCell className="font-medium px-4 py-3">{expense.employee}</TableCell>
                    <TableCell>
                      <div className="font-medium">{expense.description}</div>
                      <div className="text-xs text-muted-foreground">{expense.category}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{format(new Date(expense.date), "MMM d, yyyy")}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium text-amber-500/90">
                      ${expense.convertedAmount.toFixed(2)} {MOCK_COMPANY_BASE_CURRENCY}
                    </TableCell>
                    <TableCell className="text-center">{getStatusBadge(expense.status)}</TableCell>
                    <TableCell className="text-right px-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuGroup>
                            <DropdownMenuLabel>Admin Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => { setSelectedExpense(expense); setOverrideStatus("APPROVED"); }} className="text-green-500 cursor-pointer">
                              <CheckCircle2 className="mr-2 h-4 w-4" /> Force Approve
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setSelectedExpense(expense); setOverrideStatus("REJECTED"); }} className="text-destructive cursor-pointer">
                              <XCircle className="mr-2 h-4 w-4" /> Force Reject
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!overrideStatus} onOpenChange={(v) => !v && setOverrideStatus(null)}>
        <DialogContent className="sm:max-w-md border-border bg-card/95 backdrop-blur-2xl">
          <DialogHeader>
            <DialogTitle className={overrideStatus === "APPROVED" ? "text-green-500" : "text-destructive"}>
              Confirm Admin Override
            </DialogTitle>
            <DialogDescription>
              Warning: This bypasses all approval tier rules and directly mutates the expense ledger.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 font-medium text-center">
            You are about to forcefully <span className={overrideStatus === "APPROVED" ? "text-green-500 uppercase" : "text-destructive uppercase"}>{overrideStatus?.toLowerCase()}</span> {selectedExpense?.employee}'s expense for ${selectedExpense?.convertedAmount.toFixed(2)}.
          </div>
          <DialogFooter>
             <Button variant="ghost" onClick={() => setOverrideStatus(null)}>Cancel</Button>
             <Button variant="default" onClick={handleOverride} disabled={isOverriding} className={overrideStatus === "APPROVED" ? "bg-green-600 hover:bg-green-700" : "bg-destructive hover:bg-destructive/90"}>
               {isOverriding ? "Processing..." : "Confirm Override"}
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
